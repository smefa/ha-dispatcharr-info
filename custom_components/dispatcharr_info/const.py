"""Constants for Dispatcharr Info."""

DOMAIN = "dispatcharr_info"
DEFAULT_PORT = 9191
SCAN_INTERVAL_SECONDS = 30
REQUEST_TIMEOUT = 15

# Bundled dashboard strategy ("Community dashboards" in HA 2026.5+'s Add dashboard
# dialog). The www/ directory is served under this prefix. Bump the version when the
# JS changes: it is appended as a cache-busting query string.
FRONTEND_STATIC_URL_PREFIX = "/dispatcharr_info"
FRONTEND_DASHBOARD_URL = f"{FRONTEND_STATIC_URL_PREFIX}/dispatcharr-dashboard.js"
FRONTEND_DASHBOARD_JS_VERSION = "3"
FRONTEND_CARD_URL = f"{FRONTEND_STATIC_URL_PREFIX}/dispatcharr-card.js"
FRONTEND_CARD_JS_VERSION = "9"
