"""Exercise the setup form with real schema validation and a minimal HA stub."""

import ast
from pathlib import Path
import unittest
from unittest.mock import AsyncMock

import voluptuous as vol


SOURCE = Path(__file__).resolve().parents[1] / "custom_components/dispatcharr_info/config_flow.py"


class ConfigFlowStub:
    def __init_subclass__(cls, **kwargs):
        pass

    def _async_abort_entries_match(self, data):
        pass

    def add_suggested_values_to_schema(self, schema, values):
        return schema

    def async_show_form(self, **kwargs):
        return {"type": "form", **kwargs}

    def async_create_entry(self, **kwargs):
        return {"type": "create_entry", **kwargs}


class ClientError(Exception):
    pass


class ClientResponseError(ClientError):
    def __init__(self, status):
        self.status = status


class ConfigFlowTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
        tree.body = [node for node in tree.body if isinstance(node, ast.ClassDef)]
        self.fetch = AsyncMock()
        from types import SimpleNamespace

        namespace = {
            "ConfigFlow": ConfigFlowStub, "ConfigFlowResult": dict, "Any": object,
            "vol": vol, "DOMAIN": "dispatcharr_info", "DEFAULT_PORT": 9191,
            "CONF_HOST": "host", "CONF_PORT": "port", "CONF_API_KEY": "api_key",
            "async_fetch": self.fetch,
            "aiohttp": SimpleNamespace(
                ClientError=ClientError, ClientResponseError=ClientResponseError,
            ),
        }
        exec(compile(tree, str(SOURCE), "exec"), namespace)
        self.flow = namespace["DispatcharrConfigFlow"]()
        self.flow.hass = object()
        self.input = {"host": "localhost", "port": 9191, "api_key": "test"}

    async def test_initial_form_opens_and_validates_defaults(self):
        result = await self.flow.async_step_user()
        self.assertEqual(result["type"], "form")
        self.assertEqual(result["errors"], {})
        self.assertEqual(
            result["data_schema"]({"host": "localhost", "api_key": "test"}),
            self.input,
        )
        self.fetch.assert_not_awaited()

    async def test_valid_connection_creates_entry(self):
        result = await self.flow.async_step_user(self.input)
        self.assertEqual(result["type"], "create_entry")
        self.assertEqual(result["data"], self.input)
        self.fetch.assert_awaited_once_with(
            self.flow.hass, "localhost", 9191, "test", "/proxy/stats/",
        )

    async def test_connection_errors_redisplay_usable_form(self):
        for error, expected in (
            (ClientResponseError(401), "invalid_auth"),
            (ClientResponseError(403), "invalid_auth"),
            (ClientResponseError(500), "cannot_connect"),
            (ClientError(), "cannot_connect"),
            (TimeoutError(), "cannot_connect"),
            (ValueError(), "cannot_connect"),
        ):
            with self.subTest(error=error):
                self.fetch.side_effect = error
                result = await self.flow.async_step_user(self.input)
                self.assertEqual(result["type"], "form")
                self.assertEqual(result["errors"], {"base": expected})
                self.assertEqual(result["data_schema"](self.input), self.input)
