// Dispatcharr dashboard strategy.
//
// Registered automatically as a Lovelace resource (see frontend_resources.py).
// Home Assistant 2026.5+ lists it under Settings -> Dashboards -> Add dashboard
// -> Community dashboards -> "Dispatcharr". Older versions can use it from YAML:
//     strategy:
//       type: custom:dispatcharr
//
// The dashboard is generated, not stored: it finds the integration's sensors through
// hass.entities (matched on translation_key, so renaming an entity id is harmless).

function findSensors(hass) {
  const found = {};
  Object.keys(hass.entities || {}).forEach((entityId) => {
    const info = hass.entities[entityId];
    if (info.platform === "dispatcharr_info" && entityId.startsWith("sensor.") && info.translation_key) {
      found[info.translation_key] = entityId;
    }
  });
  return found;
}

class DispatcharrDashboardStrategy extends HTMLElement {
  static getCreateSuggestions(_hass) {
    return { title: "Dispatcharr", icon: "mdi:television-play" };
  }

  static async generate(config, hass) {
    const title = config.title || "Dispatcharr";
    const sensors = findSensors(hass);
    if (!sensors.viewing_sessions) {
      return {
        title,
        views: [
          {
            title,
            cards: [
              {
                type: "markdown",
                content: "No Dispatcharr sensors found. Add the integration under Settings -> Devices & services.",
              },
            ],
          },
        ],
      };
    }

    const ids = (keys) => keys.map((k) => sensors[k]).filter(Boolean);
    const graphs = [];
    const live = ids(["live_viewers", "active_channels", "vod_connections", "catchup_sessions"]);
    if (live.length) {
      graphs.push(
        { type: "heading", heading: "Last 24 hours", icon: "mdi:chart-line" },
        {
          type: "history-graph",
          entities: live.map((entity) => ({ entity })),
          hours_to_show: 24,
          grid_options: { columns: "full" },
        },
        { type: "heading", heading: "Peak per day", icon: "mdi:chart-bar" },
        {
          type: "statistics-graph",
          entities: ids(["live_viewers", "active_channels"]),
          stat_types: ["max"],
          period: "day",
          days_to_show: 30,
          chart_type: "bar",
          grid_options: { columns: "full" },
        },
        { type: "heading", heading: "Average load, hourly", icon: "mdi:chart-areaspline" },
        {
          type: "statistics-graph",
          entities: ids(["live_viewers", "vod_connections", "catchup_sessions"]),
          stat_types: ["mean"],
          period: "hour",
          days_to_show: 7,
          chart_type: "line",
          grid_options: { columns: "full" },
        }
      );
    }

    return {
      title,
      views: [
        {
          title,
          path: "dispatcharr",
          icon: "mdi:television-play",
          type: "sections",
          max_columns: 2,
          sections: [
            { type: "grid", cards: [{ ...config.card_options, type: "custom:dispatcharr-card", title: config.card_options?.title || title, max_sessions: config.card_options?.max_sessions || 20, dashboard_path: config.dashboard_path || window.location?.pathname?.split("/")[1] }] },
            { type: "grid", cards: graphs },
          ],
        },
      ],
    };
  }
}

// Loaded from the index page and from the Lovelace resources; the guard covers a
// resource entry with a different ?v=.
if (!customElements.get("ll-strategy-dashboard-dispatcharr")) {
  customElements.define("ll-strategy-dashboard-dispatcharr", DispatcharrDashboardStrategy);

  window.customStrategies = window.customStrategies || [];
  window.customStrategies.push({
    type: "dispatcharr",
    strategyType: "dashboard",
    name: "Dispatcharr",
    description: "The Dispatcharr card plus history and peak graphs.",
  });
}
