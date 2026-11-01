"""Data coordinator for Dispatcharr Info."""

from __future__ import annotations

import asyncio
from datetime import timedelta
import logging
from typing import Any
from uuid import UUID

import aiohttp

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_API_KEY, CONF_HOST, CONF_PORT
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import DOMAIN, REQUEST_TIMEOUT, SCAN_INTERVAL_SECONDS

_LOGGER = logging.getLogger(__name__)

type DispatcharrConfigEntry = ConfigEntry[DispatcharrCoordinator]


async def async_fetch(
    hass: HomeAssistant, host: str, port: int, api_key: str, path: str,
    *, payload: dict[str, Any] | None = None,
) -> Any:
    """Read a Dispatcharr API path, optionally posting a JSON query."""
    session = async_get_clientsession(hass)
    async with asyncio.timeout(REQUEST_TIMEOUT):
        resp = await session.request(
            "GET" if payload is None else "POST",
            f"http://{host}:{port}{path}",
            headers={"X-API-Key": api_key}, json=payload,
        )
        resp.raise_for_status()
        return await resp.json()


class DispatcharrCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Poll the Dispatcharr REST API."""

    config_entry: DispatcharrConfigEntry

    def __init__(self, hass: HomeAssistant, entry: DispatcharrConfigEntry) -> None:
        super().__init__(
            hass,
            _LOGGER,
            config_entry=entry,
            name=DOMAIN,
            update_interval=timedelta(seconds=SCAN_INTERVAL_SECONDS),
        )
        self._host = entry.data[CONF_HOST]
        self._port = entry.data[CONF_PORT]
        self._api_key = entry.data[CONF_API_KEY]

    async def _async_update_data(self) -> dict[str, Any]:
        try:
            epg, stats, users, accounts = await asyncio.gather(
                *(
                    async_fetch(self.hass, self._host, self._port, self._api_key, p)
                    for p in (
                        "/api/epg/sources/",
                        "/proxy/stats/",
                        "/api/accounts/users/",
                        "/api/m3u/accounts/",
                    )
                )
            )
        except (aiohttp.ClientError, TimeoutError, ValueError) as err:
            raise UpdateFailed(f"Error talking to Dispatcharr: {err}") from err

        channel_uuids = []
        for channel in (stats.get("live") or {}).get("channels") or []:
            try:
                channel_uuids.append(str(UUID(str(channel.get("channel_id")))))
            except ValueError:
                continue
        programs = []
        if channel_uuids:
            try:
                result = await async_fetch(
                    self.hass, self._host, self._port, self._api_key,
                    "/api/epg/current-programs/",
                    payload={"channel_uuids": list(dict.fromkeys(channel_uuids))},
                )
                if not isinstance(result, list) or any(
                    not isinstance(program, dict) for program in result
                ):
                    raise ValueError("Invalid current programs response")
                programs = result
            except (aiohttp.ClientError, TimeoutError, ValueError) as err:
                _LOGGER.warning("Could not fetch current EPG programs: %s", err)
        return self._parse(epg, stats, users, accounts, programs)

    @staticmethod
    def _parse(
        epg: list, stats: dict, users: list, accounts: list,
        programs: list | None = None,
    ) -> dict[str, Any]:
        names = {str(u["id"]): u.get("username") for u in users}
        live = stats.get("live") or {}
        channels = live.get("channels") or []
        current_programs = {
            str(program["channel_uuid"]): {
                "title": program["title"],
                "start_time": program.get("start_time"),
                "end_time": program.get("end_time"),
            }
            for program in programs or []
            if program.get("channel_uuid") and program.get("title")
        }

        def who(uid, fallback=None):
            known = uid and str(uid) != "0"
            if not known:
                return fallback or "unknown"
            return names.get(str(uid), fallback or f"user {uid}")

        sessions = []
        for ch in channels:
            for c in ch.get("clients") or []:
                sessions.append(
                    {
                        "kind": "live",
                        "stream": str(ch.get("channel_id")),
                        "user": who(c.get("user_id")),
                        "channel": ch.get("channel_name") or ch.get("channel_id"),
                        "program": current_programs.get(str(ch.get("channel_id"))),
                        "ip": c.get("ip_address") or "",
                        "player": c.get("user_agent") or "",
                    }
                )

        # VOD: one upstream connection per client. Catch-up: one upstream stream per
        # session, which can have several clients.
        for item in (stats.get("vod") or {}).get("vod_connections") or []:
            meta = item.get("content_metadata") or {}
            title = item.get("content_name") or "VOD"
            if item.get("content_type") == "episode" and meta.get("series_name"):
                title = (
                    f"{meta['series_name']} "
                    f"S{meta.get('season_number') or 0:02d}E{meta.get('episode_number') or 0:02d}"
                )
            for c in item.get("connections") or []:
                sessions.append(
                    {
                        "kind": "vod",
                        "stream": str(c.get("client_id")),
                        "user": who(c.get("user_id")),
                        "channel": title,
                        "ip": c.get("client_ip") or "",
                        "player": c.get("user_agent") or "",
                    }
                )
        for sess in (stats.get("catchup") or {}).get("timeshift_sessions") or []:
            for c in sess.get("connections") or []:
                sessions.append(
                    {
                        "kind": "catchup",
                        "stream": str(sess.get("session_id")),
                        "user": who(c.get("user_id"), c.get("username")),
                        "channel": sess.get("channel_name") or sess.get("channel_id"),
                        "ip": c.get("ip_address") or "",
                        "player": c.get("user_agent") or "",
                    }
                )

        # Dispatcharr enforces max_streams per active profile (an account can have
        # several, each with its own pool), so capacity is summed over profiles. The
        # account-level value only mirrors the default profile. Locked accounts are the
        # built-in "custom" account, which has no limit.
        limits = []
        for a in accounts:
            if not a.get("is_active") or a.get("locked"):
                continue
            profiles = [p for p in (a.get("profiles") or []) if p.get("is_active")]
            if not profiles:
                limits.append({"name": a.get("name"), "max_streams": a.get("max_streams") or 0})
                continue
            for p in profiles:
                limits.append(
                    {
                        "name": f"{a.get('name')} / {p.get('name')}",
                        "max_streams": p.get("max_streams") or 0,
                    }
                )

        return {
            "max_streams": sum(a["max_streams"] for a in limits),
            "stream_limits": limits,
            "unlimited_accounts": any(a["max_streams"] == 0 for a in limits),
            "epg_errors": sum(
                1 for s in epg if s.get("is_active") and s.get("status") == "error"
            ),
            "active_channels": live.get("count", len(channels)),
            "channels": channels,
            "live_viewers": sum(ch.get("client_count", 0) for ch in channels),
            "vod_connections": (stats.get("vod") or {}).get("total_connections", 0),
            "catchup_sessions": (stats.get("catchup") or {}).get(
                "total_connections", 0
            ),
            "all_users": [u.get("username") for u in users],
            "sessions": sessions,
        }
