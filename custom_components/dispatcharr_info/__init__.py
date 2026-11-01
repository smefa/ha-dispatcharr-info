"""Dispatcharr Info integration."""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from .const import (
    DOMAIN,
    FRONTEND_CARD_JS_VERSION,
    FRONTEND_CARD_URL,
    FRONTEND_DASHBOARD_JS_VERSION,
    FRONTEND_DASHBOARD_URL,
    FRONTEND_STATIC_URL_PREFIX,
)
from .coordinator import DispatcharrConfigEntry, DispatcharrCoordinator
from .frontend_resources import async_remove_resource, async_sync_resource

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.SENSOR]

_FRONTEND_REGISTERED = f"{DOMAIN}_frontend_registered"
_RESOURCE_URLS = (
    f"{FRONTEND_CARD_URL}?v={FRONTEND_CARD_JS_VERSION}",
    f"{FRONTEND_DASHBOARD_URL}?v={FRONTEND_DASHBOARD_JS_VERSION}",
)


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the bundled dashboard strategy (once, however many entries exist)."""
    if hass.data.get(_FRONTEND_REGISTERED):
        return
    hass.data[_FRONTEND_REGISTERED] = True
    www_path = Path(__file__).parent / "www"
    await hass.http.async_register_static_paths(
        [StaticPathConfig(FRONTEND_STATIC_URL_PREFIX, str(www_path), cache_headers=True)]
    )


def _storage_resources(hass: HomeAssistant):
    """The Lovelace resources collection, or None when it is managed in YAML."""
    resources = getattr(hass.data.get("lovelace"), "resources", None)
    return resources if hasattr(resources, "async_create_item") else None


async def _async_sync_resources(hass: HomeAssistant) -> None:
    """List the bundled scripts in the Lovelace resources.

    Falls back to the index page when the resources can't be edited. A strategy
    needs to be registered within seconds of the dashboard opening, and the
    resources are read fresh each time, unlike a possibly cached index page.
    """
    resources = _storage_resources(hass)
    if resources is None:
        for url in _RESOURCE_URLS:
            add_extra_js_url(hass, url)
        _LOGGER.info(
            "Lovelace resources are managed in YAML; add these as module resources "
            "if the Dispatcharr card or dashboard fails to load: %s",
            ", ".join(_RESOURCE_URLS),
        )
        return
    try:
        for url in _RESOURCE_URLS:
            result = await async_sync_resource(resources, url)
            if result:
                _LOGGER.info("Lovelace resource %s %s", url, result)
    except Exception:  # noqa: BLE001 - a resources problem must never block setup
        _LOGGER.warning(
            "Could not add the Dispatcharr scripts to the Lovelace resources",
            exc_info=True,
        )
        for url in _RESOURCE_URLS:
            add_extra_js_url(hass, url)


async def async_setup_entry(hass: HomeAssistant, entry: DispatcharrConfigEntry) -> bool:
    """Set up Dispatcharr Info from a config entry."""
    await _async_register_frontend(hass)
    await _async_sync_resources(hass)
    coordinator = DispatcharrCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_remove_entry(hass: HomeAssistant, entry: DispatcharrConfigEntry) -> None:
    """Take the script resources out again when the last entry is deleted."""
    if any(e.entry_id != entry.entry_id for e in hass.config_entries.async_entries(DOMAIN)):
        return
    resources = _storage_resources(hass)
    if resources is None:
        return
    try:
        for url in _RESOURCE_URLS:
            await async_remove_resource(resources, url)
    except Exception:  # noqa: BLE001 - removal is cleanup only
        _LOGGER.warning("Could not remove the Dispatcharr script resources", exc_info=True)


async def async_unload_entry(hass: HomeAssistant, entry: DispatcharrConfigEntry) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
