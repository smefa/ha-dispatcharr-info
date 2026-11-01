"""Standalone coordinator checks without requiring a Home Assistant install."""

import ast
import asyncio
import logging
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock
from uuid import UUID


CHANNEL_UUID = "d38e10b4-b864-42c2-a3a6-5d377646db87"
OTHER_UUID = "fb06bc4f-b27a-4a59-8820-dc7bd23e9a24"
SOURCE = Path(__file__).resolve().parents[1] / "custom_components/dispatcharr_info/coordinator.py"


class ClientError(Exception):
    pass


class UpdateFailed(Exception):
    pass


def coordinator_functions():
    """Load the real methods in isolation from Home Assistant's runtime imports."""
    tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
    methods = []
    for node in tree.body:
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "async_fetch":
            methods.append(node)
        if isinstance(node, ast.ClassDef) and node.name == "DispatcharrCoordinator":
            methods.extend(
                method for method in node.body
                if isinstance(method, (ast.FunctionDef, ast.AsyncFunctionDef))
                and method.name in ("_parse", "_async_update_data")
            )
    namespace = {
        "asyncio": asyncio,
        "aiohttp": SimpleNamespace(ClientError=ClientError),
        "UUID": UUID,
        "UpdateFailed": UpdateFailed,
        "_LOGGER": logging.getLogger(__name__),
        "REQUEST_TIMEOUT": 15,
    }
    module = ast.Module(body=[
        ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0),
        *methods,
    ], type_ignores=[])
    exec(compile(ast.fix_missing_locations(module), str(SOURCE), "exec"), namespace)
    return namespace


def stats():
    return {"live": {"channels": [{
        "channel_id": CHANNEL_UUID,
        "channel_name": "Eurosport 1",
        "client_count": 2,
        "clients": [{"user_id": 1}, {"user_id": 2}],
    }]}}


def program(channel_uuid=CHANNEL_UUID):
    return {
        "channel_uuid": channel_uuid,
        "title": "Live cycling",
        "start_time": "2026-11-01T12:00:00Z",
        "end_time": "2026-11-01T14:00:00Z",
        "description": "Not copied into sensor attributes",
    }


class CoordinatorTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.functions = coordinator_functions()
        self.coordinator = SimpleNamespace(
            hass=object(), _host="localhost", _port=9191, _api_key="test",
            _parse=self.functions["_parse"],
        )

    async def update(self, live_stats, epg_result=None, epg_error=None):
        async def fetch(hass, host, port, api_key, path, **kwargs):
            if path == "/proxy/stats/":
                return live_stats
            if path == "/api/epg/current-programs/":
                if epg_error:
                    raise epg_error
                return epg_result
            return []

        mock = AsyncMock(side_effect=fetch)
        self.functions["async_fetch"] = mock
        result = await self.functions["_async_update_data"](self.coordinator)
        return result, mock

    async def test_current_program_is_shared_by_channel_viewers(self):
        data, fetch = await self.update(stats(), [program(), program(OTHER_UUID)])
        self.assertEqual(data["live_viewers"], 2)
        for session in data["sessions"]:
            self.assertEqual(session["program"], {
                "title": "Live cycling",
                "start_time": "2026-11-01T12:00:00Z",
                "end_time": "2026-11-01T14:00:00Z",
            })
        self.assertEqual(fetch.call_args.kwargs["payload"], {"channel_uuids": [CHANNEL_UUID]})

    async def test_missing_program_keeps_sessions(self):
        data, _ = await self.update(stats(), [])
        self.assertEqual(len(data["sessions"]), 2)
        self.assertIsNone(data["sessions"][0]["program"])

    async def test_epg_failures_do_not_make_stats_unavailable(self):
        for error in (ClientError("404"), TimeoutError(), ValueError("bad JSON")):
            with self.subTest(error=type(error).__name__), self.assertLogs(level="WARNING"):
                data, _ = await self.update(stats(), epg_error=error)
                self.assertEqual(data["live_viewers"], 2)
                self.assertIsNone(data["sessions"][0]["program"])

    async def test_invalid_epg_response_is_optional(self):
        for response in ({"error": "unsupported"}, [None]):
            with self.subTest(response=response), self.assertLogs(level="WARNING"):
                data, _ = await self.update(stats(), response)
                self.assertEqual(data["live_viewers"], 2)

    async def test_no_epg_request_for_idle_or_preview_streams(self):
        preview = stats()
        preview["live"]["channels"][0]["channel_id"] = "preview-hash"
        for live_stats in ({}, preview):
            with self.subTest(stats=live_stats):
                _, fetch = await self.update(live_stats)
                self.assertEqual(fetch.call_count, 4)

    async def test_vod_and_catchup_do_not_receive_live_programs(self):
        data = stats()
        data["vod"] = {"vod_connections": [{
            "content_name": "Film", "connections": [{"client_id": "vod-1"}],
        }]}
        data["catchup"] = {"timeshift_sessions": [{
            "channel_id": CHANNEL_UUID, "connections": [{"user_id": 1}],
        }]}
        parsed, _ = await self.update(data, [program()])
        for session in parsed["sessions"][2:]:
            self.assertNotIn("program", session)

    async def test_fetch_uses_authenticated_get_and_post(self):
        response = SimpleNamespace(raise_for_status=Mock(), json=AsyncMock(return_value=[]))
        session = SimpleNamespace(request=AsyncMock(return_value=response))
        self.functions["async_get_clientsession"] = Mock(return_value=session)
        fetch = self.functions["async_fetch"]
        await fetch(object(), "localhost", 9191, "test", "/proxy/stats/")
        self.assertEqual(session.request.call_args.args[0], "GET")
        payload = {"channel_uuids": [CHANNEL_UUID]}
        await fetch(object(), "localhost", 9191, "test", "/api/epg/current-programs/", payload=payload)
        self.assertEqual(session.request.call_args.args[0], "POST")
        self.assertEqual(session.request.call_args.kwargs["json"], payload)
        self.assertEqual(session.request.call_args.kwargs["headers"], {"X-API-Key": "test"})


if __name__ == "__main__":
    unittest.main()