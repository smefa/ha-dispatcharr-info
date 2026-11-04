"""Config flow for Dispatcharr Info."""

from __future__ import annotations

from typing import Any

import aiohttp
import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.const import CONF_API_KEY, CONF_HOST, CONF_PORT

from .const import DEFAULT_PORT, DOMAIN
from .coordinator import async_fetch


class DispatcharrConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle the UI setup."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            self._async_abort_entries_match(
                {CONF_HOST: user_input[CONF_HOST], CONF_PORT: user_input[CONF_PORT]}
            )
            try:
                # Admin-only endpoint, so this also verifies the key's role.
                await async_fetch(
                    self.hass,
                    user_input[CONF_HOST],
                    user_input[CONF_PORT],
                    user_input[CONF_API_KEY],
                    "/proxy/stats/",
                )
            except aiohttp.ClientResponseError as err:
                errors["base"] = (
                    "invalid_auth" if err.status in (401, 403) else "cannot_connect"
                )
            except (aiohttp.ClientError, TimeoutError, ValueError):
                errors["base"] = "cannot_connect"
            if not errors:
                return self.async_create_entry(
                    title=f"Dispatcharr ({user_input[CONF_HOST]})", data=user_input
                )

        schema = vol.Schema(
            {
                vol.Required(CONF_HOST): str,
                vol.Required(CONF_PORT, default=DEFAULT_PORT): int,
                vol.Required(CONF_API_KEY): str,
            }
        )
        return self.async_show_form(
            step_id="user",
            data_schema=self.add_suggested_values_to_schema(schema, user_input),
            errors=errors,
        )

