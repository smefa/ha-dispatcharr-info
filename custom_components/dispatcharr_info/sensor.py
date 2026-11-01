"""Sensors for Dispatcharr Info."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from homeassistant.components.sensor import (
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import DispatcharrConfigEntry, DispatcharrCoordinator


@dataclass(frozen=True, kw_only=True)
class DispatcharrSensorDescription(SensorEntityDescription):
    """Sensor description with an optional attributes extractor."""

    attrs_fn: Callable[[dict[str, Any]], dict[str, Any]] | None = None


SENSORS: tuple[DispatcharrSensorDescription, ...] = (
    DispatcharrSensorDescription(
        key="epg_errors",
        translation_key="epg_errors",
        name="EPG sources in error",
        icon="mdi:calendar-alert",
        state_class=SensorStateClass.MEASUREMENT,
    ),
    DispatcharrSensorDescription(
        key="active_channels",
        translation_key="active_channels",
        name="Active channels",
        icon="mdi:television-classic",
        state_class=SensorStateClass.MEASUREMENT,
        attrs_fn=lambda d: {"channels": d["channels"]},
    ),
    DispatcharrSensorDescription(
        key="max_streams",
        translation_key="max_streams",
        name="Max streams",
        icon="mdi:speedometer",
        state_class=SensorStateClass.MEASUREMENT,
        attrs_fn=lambda d: {
            "accounts": d["stream_limits"],
            "unlimited_accounts": d["unlimited_accounts"],
        },
    ),
    DispatcharrSensorDescription(
        key="live_viewers",
        translation_key="live_viewers",
        name="Live viewers",
        icon="mdi:account-multiple",
        state_class=SensorStateClass.MEASUREMENT,
    ),
    DispatcharrSensorDescription(
        key="vod_connections",
        translation_key="vod_connections",
        name="VOD connections",
        icon="mdi:movie-play",
        state_class=SensorStateClass.MEASUREMENT,
    ),
    DispatcharrSensorDescription(
        key="catchup_sessions",
        translation_key="catchup_sessions",
        name="Catch-up sessions",
        icon="mdi:history",
        state_class=SensorStateClass.MEASUREMENT,
    ),
    DispatcharrSensorDescription(
        key="users",
        translation_key="users",
        name="Users",
        icon="mdi:account-group",
        attrs_fn=lambda d: {"users": d["all_users"]},
    ),
    DispatcharrSensorDescription(
        key="viewing_sessions",
        translation_key="viewing_sessions",
        name="Viewing sessions",
        icon="mdi:television-play",
        attrs_fn=lambda d: {"sessions": d["sessions"]},
    ),
)

# Sensors whose state is the length of a list in the data rather than a scalar.
_COUNT_OF = {
    "users": "all_users",
    "viewing_sessions": "sessions",
}


async def async_setup_entry(
    hass: HomeAssistant,
    entry: DispatcharrConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up sensors from a config entry."""
    coordinator = entry.runtime_data
    async_add_entities(
        DispatcharrSensor(coordinator, entry, desc) for desc in SENSORS
    )


class DispatcharrSensor(CoordinatorEntity[DispatcharrCoordinator], SensorEntity):
    """A Dispatcharr statistic."""

    _attr_has_entity_name = True
    entity_description: DispatcharrSensorDescription

    def __init__(
        self,
        coordinator: DispatcharrCoordinator,
        entry: DispatcharrConfigEntry,
        description: DispatcharrSensorDescription,
    ) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = f"{entry.entry_id}_{description.key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="Dispatcharr",
            manufacturer="Dispatcharr",
        )

    @property
    def native_value(self) -> int:
        key = self.entity_description.key
        value = self.coordinator.data[_COUNT_OF.get(key, key)]
        return len(value) if key in _COUNT_OF else value

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        fn = self.entity_description.attrs_fn
        return fn(self.coordinator.data) if fn else None
