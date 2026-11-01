// Dispatcharr card: one card with everything. Styled after the EMHASS companion cards.
//
//   type: custom:dispatcharr-card
//
// Finds the integration's sensors itself (hass.entities, matched on translation_key).
// Optional config: `title`, `max_sessions` (default 12).

const TOKENS = `
  :host {
    display: block;
    --dsp-accent: var(--primary-color, #03a9f4);
    --dsp-ok: var(--success-color, #43a047);
    --dsp-warn: var(--warning-color, #ffa600);
    --dsp-bad: var(--error-color, #db4437);
    --dsp-dim: var(--secondary-text-color, #727272);
    --dsp-surface: rgba(127, 127, 127, .10);
    --dsp-surface: color-mix(in srgb, var(--primary-text-color) 7%, transparent);
    --dsp-hairline: var(--divider-color, rgba(127, 127, 127, .3));
  }
  * { box-sizing: border-box; }
  ha-card { overflow: hidden; }
  .pad { padding: 14px 16px 16px 16px; }
  .head { display: flex; align-items: center; gap: 12px; }
  .grow { flex: 1; min-width: 0; }
  .name { font-size: 1.05rem; font-weight: 500; line-height: 1.25; }
  .sub { font-size: .78rem; color: var(--dsp-dim); margin-top: 2px;
         white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sq { width: 40px; height: 40px; border-radius: 13px; flex: 0 0 auto; display: grid;
        place-items: center; color: var(--dsp-dim); background: var(--dsp-surface); }
  .sq ha-icon { --mdc-icon-size: 22px; }
  .sq.on { color: var(--dsp-ok); background: rgba(67, 160, 71, .18);
           background: color-mix(in srgb, var(--dsp-ok) 18%, transparent); }
  .sq.bad { color: var(--dsp-bad); background: rgba(219, 68, 55, .18);
            background: color-mix(in srgb, var(--dsp-bad) 18%, transparent); }
  .pill { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto;
          font-size: .76rem; font-weight: 500; padding: 4px 10px 4px 8px;
          border-radius: 999px; background: var(--dsp-surface); color: var(--dsp-dim); }
  .pill .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .pill.on { color: var(--dsp-ok); background: rgba(67, 160, 71, .16);
             background: color-mix(in srgb, var(--dsp-ok) 16%, transparent); }
  .pill.bad { color: var(--dsp-bad); background: rgba(219, 68, 55, .16);
              background: color-mix(in srgb, var(--dsp-bad) 16%, transparent); }
  .stats { display: grid; gap: 8px; margin-top: 12px;
           grid-template-columns: repeat(auto-fit, minmax(84px, 1fr)); }
  .stat { background: var(--dsp-surface); border-radius: 11px; padding: 8px 10px; min-width: 0;
          cursor: pointer; transition: background 160ms; }
  .stat:hover { background: rgba(127, 127, 127, .18); }
  .stat .k { font-size: .68rem; color: var(--dsp-dim); text-transform: uppercase;
             letter-spacing: .04em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stat .v { font-size: 1.3rem; font-weight: 500; margin-top: 2px; font-variant-numeric: tabular-nums; }
  .stat .v small { font-size: .75rem; font-weight: 400; color: var(--dsp-dim); }
  .section { margin-top: 16px; font-size: .72rem; color: var(--dsp-dim);
             text-transform: uppercase; letter-spacing: .06em; }
  .bar { display: flex; gap: 2px; height: 14px; margin-top: 8px; border-radius: 7px; overflow: hidden; }
  .bar i { display: block; min-width: 4px; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; font-size: .8rem; }
  .legend .sw { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 6px; }
  .legend b { font-weight: 500; }
  .sessions { margin-top: 6px; }
  .srow { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
  .srow + .srow { border-top: 1px solid var(--dsp-hairline); }
  .av { width: 34px; height: 34px; border-radius: 50%; flex: 0 0 auto; display: grid;
        place-items: center; font-weight: 600; font-size: .95rem; color: #fff; }
  .srow .who { font-size: .92rem; font-weight: 500; }
  .identity { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
  .identity .who { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .identity .what { flex: 1; min-width: 0; margin-top: 0; }
  .identity .separator { color: var(--dsp-dim); }
  .badge { margin-left: 8px; padding: 1px 7px; border-radius: 999px; font-size: .64rem; font-weight: 600;
           letter-spacing: .04em; text-transform: uppercase; background: var(--dsp-surface); vertical-align: 1px; }
  .srow .what { font-size: .8rem; margin-top: 1px; white-space: nowrap; overflow: hidden;
                text-overflow: ellipsis; }
  .srow .program { font-size: .8rem; margin-top: 3px; overflow-wrap: anywhere; }
  .srow .meta { font-size: .7rem; color: var(--dsp-dim); margin-top: 1px; white-space: nowrap;
                overflow: hidden; text-overflow: ellipsis; }
  .empty { color: var(--dsp-dim); font-size: .88rem; padding: 10px 0 2px; }
  .more { color: var(--dsp-dim); font-size: .78rem; padding: 6px 0 0; }
  .banner { margin-top: 16px; padding: 10px 14px; border-radius: 12px; font-size: .86rem;
            display: flex; align-items: center; gap: 10px; color: var(--dsp-warn);
            background: rgba(255, 166, 0, .14);
            background: color-mix(in srgb, var(--dsp-warn) 14%, transparent); }
  .banner ha-icon { --mdc-icon-size: 20px; flex: 0 0 auto; }
`;

const COLORS = ["#4fa3d1", "#f0a23c", "#6bb6a8", "#a77bd4", "#e0605a", "#7cb860", "#d98cb3", "#8aa0b8"];

// Live channels cycle through these; VOD and catch-up keep the colour of their tile.
const LIVE_COLORS = ["#4fa3d1", "#6bb6a8", "#7cb860", "#e0605a", "#8aa0b8", "#d98cb3"];
const KIND = {
  vod: { color: "#a77bd4", label: "VOD" },
  catchup: { color: "#f0a23c", label: "Catch-up" },
};

const TILES = [
  ["live_viewers", "Viewers"],
  ["active_channels", "Channels"],
  ["vod_connections", "VOD"],
  ["catchup_sessions", "Catch-up"],
];

const CARD_SETTINGS = [
  ["show_header", "Header", true],
  ["show_summary", "Summary below the title", true],
  ["show_status", "Status badge", true],
  ["show_live_viewers", "Viewers box", true],
  ["show_active_channels", "Channels box", true],
  ["show_vod_connections", "VOD box", true],
  ["show_catchup_sessions", "Catch-up box", true],
  ["show_streams", "Streams in use", true],
  ["show_now_watching", "Now watching", true],
  ["show_avatars", "User avatars", true],
  ["show_user", "User names", true],
  ["show_kind", "VOD and catch-up badges", true],
  ["show_channel", "Channel or content title", true],
  ["show_program", "Programme title", true],
  ["show_ip", "IP address", true],
  ["show_client", "Client name", true],
  ["show_epg_errors", "EPG error banner", true],
];
const enabled = (config, key) => config[key] ?? CARD_SETTINGS.find(s => s[0] === key)?.[2] ?? true;
const settingsSchema = [
  {name: "title", selector: {text: {}}},
  ...CARD_SETTINGS.map(([name]) => ({name, selector: {boolean: {}}})),
  {name: "max_sessions", selector: {number: {min: 1, max: 100, mode: "box"}}},
];
const settingsLabel = schema => CARD_SETTINGS.find(s => s[0] === schema.name)?.[1]
  || ({title: "Title", max_sessions: "Maximum watching sessions"})[schema.name];
async function loadSettingsForm() {
  if (customElements.get("ha-form")) return;
  const helpers = await window.loadCardHelpers();
  const card = await helpers.createCardElement({type: "entities", entities: []});
  await card.constructor.getConfigElement();
}

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function hash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// "Mozilla/5.0 ... VLC/3.0" is noise: keep the first product token that is not Mozilla.
function shortPlayer(agent) {
  if (!agent) return "";
  const first = String(agent).split(" ")[0].split("/")[0];
  return (first === "Mozilla" ? agent.split(" ").slice(-1)[0].split("/")[0] : first).slice(0, 28);
}

class DispatcharrCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._sig = "";
  }

  setConfig(config) {
    this._config = config || {};
    this._sig = "";
    if (this._hass) this.hass = this._hass;
  }

  getCardSize() {
    return 6;
  }

  static getStubConfig() {
    return {};
  }

  static async getConfigElement() {
    await loadSettingsForm();
    return document.createElement("dispatcharr-card-editor");
  }

  _entities(hass) {
    const found = {};
    Object.keys(hass.entities || {}).forEach((id) => {
      const info = hass.entities[id];
      if (info.platform === "dispatcharr_info" && id.startsWith("sensor.") && info.translation_key) {
        found[info.translation_key] = id;
      }
    });
    return found;
  }

  set hass(hass) {
    this._hass = hass;
    const ids = this._entities(hass);
    const stateOf = (key) => (ids[key] ? hass.states[ids[key]] : undefined);
    const sig = JSON.stringify(
      Object.keys(ids).map((k) => {
        const s = stateOf(k);
        return s ? [s.state, s.attributes.sessions, s.attributes.channels, s.attributes.unlimited_accounts] : null;
      })
    );
    if (sig === this._sig) return;
    this._sig = sig;
    this._ids = ids;
    this._render(stateOf);
  }

  // Total stream slots, or 0 when unknown. Accounts with no limit (0) are not
  // counted, so the bar is only drawn against slots that are really limited.
  _slots(stateOf) {
    const s = stateOf("max_streams");
    const max = s ? Number(s.state) : NaN;
    return Number.isFinite(max) && max > 0 ? max : 0;
  }

  _render(stateOf) {
    const cfg = this._config || {};
    const num = (key) => {
      const s = stateOf(key);
      const n = s ? Number(s.state) : NaN;
      return Number.isFinite(n) ? n : null;
    };
    const viewers = num("live_viewers");
    const channelCount = num("active_channels");
    const epgErrors = num("epg_errors") || 0;
    const sessionsState = stateOf("viewing_sessions");
    const offline = !sessionsState || ["unavailable", "unknown"].includes(sessionsState.state);
    const sessions = (sessionsState && sessionsState.attributes.sessions) || [];
    const channels = ((stateOf("active_channels") || { attributes: {} }).attributes.channels || [])
      .map((c) => ({ name: c.channel_name || c.channel_id || "?", n: Number(c.client_count) || 0 }))
      .sort((a, b) => b.n - a.n);

    const active = sessions.length > 0;
    const pillClass = offline ? "bad" : active ? "on" : "";
    const pillText = offline ? "offline" : active ? "streaming" : "idle";
    const vodCount = num("vod_connections") || 0;
    const catchupCount = num("catchup_sessions") || 0;
    const parts = [`${channelCount ?? 0} live channel${channelCount === 1 ? "" : "s"}`, `${viewers ?? 0} viewer${viewers === 1 ? "" : "s"}`];
    if (vodCount) parts.push(`${vodCount} VOD`);
    if (catchupCount) parts.push(`${catchupCount} catch-up`);
    const sub = offline ? "No data from Dispatcharr" : parts.join(" · ");

    const tiles = TILES.filter(([key]) => this._ids[key] && enabled(cfg, `show_${key}`))
      .map(([key, label]) => {
        const n = num(key);
        return `<div class="stat" data-entity="${esc(this._ids[key])}"><div class="k">${label}</div><div class="v">${n === null ? "–" : n}</div></div>`;
      })
      .join("");

    // One upstream stream per live channel, VOD connection and catch-up session; each
    // takes one slot of the total (the summed max streams of the active profiles).
    const items = channels.map((c, i) => ({ name: c.name, n: c.n, color: LIVE_COLORS[i % LIVE_COLORS.length] }));
    ["vod", "catchup"].forEach((kind) => {
      const seen = new Map();
      sessions
        .filter((s) => s.kind === kind)
        .forEach((s) => {
          const item = seen.get(s.stream) || { name: `${KIND[kind].label}: ${s.channel}`, n: 0, color: KIND[kind].color };
          item.n += 1;
          seen.set(s.stream, item);
        });
      items.push(...seen.values());
    });
    const slots = this._slots(stateOf);
    const free = slots ? Math.max(0, slots - items.length) : 0;
    const bar = items.length || free
      ? `<div class="bar">${items
          .map((c) => `<i title="${esc(c.name)} - ${c.n} viewer${c.n === 1 ? "" : "s"}" style="flex:1;background:${c.color}"></i>`)
          .join("")}${Array.from({ length: free }, () => `<i title="Free slot" style="flex:1;background:var(--dsp-surface)"></i>`).join("")}</div>
         <div class="legend">${items
           .map((c) => `<span><span class="sw" style="background:${c.color}"></span>${esc(c.name)} <b>${c.n}</b></span>`)
           .join("")}${slots ? `<span style="color:var(--dsp-dim)">${free} of ${Math.max(slots, items.length)} free</span>` : ""}</div>`
      : `<div class="empty">Nothing streaming</div>`;

    const max = Number(cfg.max_sessions) || 12;
    const rows = sessions
      .slice(0, max)
      .map((s) => {
        const user = s.user || "unknown";
        const color = COLORS[hash(user) % COLORS.length];
        const meta = [enabled(cfg, "show_ip") ? s.ip : "", enabled(cfg, "show_client") ? shortPlayer(s.player) : ""].filter(Boolean).join(" · ");
        const program = enabled(cfg, "show_program") && s.kind === "live" && s.program?.title ? s.program : null;
        const epg = program
          ? `<div class="program">${esc(program.title)}${meta ? `<span class="meta"> &middot; ${esc(meta)}</span>` : ""}</div>`
          : `<div class="meta">${esc(meta)}</div>`;
        const who = `${enabled(cfg, "show_user") ? esc(user) : ""}${enabled(cfg, "show_kind") && s.kind && s.kind !== "live" ? `<span class="badge" style="color:${KIND[s.kind].color}">${KIND[s.kind].label}</span>` : ""}`;
        const channel = enabled(cfg, "show_channel") ? `<div class="what">${esc(s.channel)}</div>` : "";
        return `<div class="srow">${enabled(cfg, "show_avatars") ? `<div class="av" style="background:${color}">${esc(user.charAt(0).toUpperCase())}</div>` : ""}
          <div class="grow">${who || channel ? `<div class="identity">${who ? `<div class="who">${who}</div>` : ""}${who && channel ? `<span class="separator" aria-hidden="true">&middot;</span>` : ""}${channel}</div>` : ""}
          ${epg}</div></div>`;
      })
      .join("");
    const more = sessions.length > max ? `<div class="more">+${sessions.length - max} more</div>` : "";

    const banner = epgErrors
      ? `<div class="banner"><ha-icon icon="mdi:calendar-alert"></ha-icon>${epgErrors} EPG source${epgErrors === 1 ? "" : "s"} in error</div>`
      : "";

    const canConfigure = cfg.dashboard_path && this._hass.user?.is_admin;
    this.shadowRoot.innerHTML = `<style>${TOKENS}</style>
      <ha-card><div class="pad">
        ${canConfigure ? `<div style="display:flex;justify-content:flex-end"><button class="settings-button" aria-label="Card settings" title="Card settings" style="border:0;background:transparent;color:var(--dsp-dim);cursor:pointer;padding:8px"><ha-icon icon="mdi:cog"></ha-icon></button></div>` : ""}
        ${enabled(cfg, "show_header") ? `<div class="head">
          <div class="sq ${offline ? "bad" : active ? "on" : ""}"><ha-icon icon="mdi:television-play"></ha-icon></div>
          <div class="grow"><div class="name">${esc(cfg.title || "Dispatcharr")}</div>${enabled(cfg, "show_summary") ? `<div class="sub">${esc(sub)}</div>` : ""}</div>
          ${enabled(cfg, "show_status") ? `<span class="pill ${pillClass}"><span class="dot"></span>${pillText}</span>` : ""}
        </div>` : ""}
        ${tiles ? `<div class="stats">${tiles}</div>` : ""}
        ${enabled(cfg, "show_streams") ? `<div class="section">Streams in use</div>${bar}` : ""}
        ${enabled(cfg, "show_now_watching") ? `<div class="section">Now watching</div><div class="sessions">${rows || `<div class="empty">Nobody is watching</div>`}${more}</div>` : ""}
        ${enabled(cfg, "show_epg_errors") ? banner : ""}
        <div class="settings-panel"></div>
      </div></ha-card>`;

    this.shadowRoot.querySelector?.(".settings-button")?.addEventListener("click", () => this._openSettings());
    if (this._settingsOpen) this._renderSettings();
    this.shadowRoot.querySelectorAll(".stat").forEach((el) =>
      el.addEventListener("click", () =>
        this.dispatchEvent(
          new CustomEvent("hass-more-info", { detail: { entityId: el.dataset.entity }, bubbles: true, composed: true })
        )
      )
    );
  }

  async _openSettings() {
    try { await loadSettingsForm(); }
    catch {
      const panel = this.shadowRoot.querySelector?.(".settings-panel");
      if (panel) panel.textContent = "Unable to load settings. Refresh and try again.";
      return;
    }
    this._settingsOpen = !this._settingsOpen;
    this._draft = {...this._config};
    this._settingsError = "";
    this._renderSettings();
  }

  _renderSettings() {
    const panel = this.shadowRoot.querySelector?.(".settings-panel");
    if (!panel) return;
    if (!this._settingsOpen) { panel.innerHTML = ""; return; }
    panel.innerHTML = `<div class="section">Card settings</div><ha-form></ha-form>
      <div role="alert">${esc(this._settingsError || "")}</div>
      <ha-button class="save-settings" ${this._saving ? "disabled" : ""}>${this._saving ? "Saving..." : "Save"}</ha-button>
      <ha-button class="cancel-settings">Cancel</ha-button>`;
    const form = panel.querySelector("ha-form");
    form.hass = this._hass;
    form.schema = settingsSchema;
    form.computeLabel = settingsLabel;
    form.data = {...Object.fromEntries(CARD_SETTINGS.map(([key, , value]) => [key, value])),
      max_sessions: 12, ...this._draft};
    form.addEventListener("value-changed", event => { this._draft = {...this._draft, ...event.detail.value}; });
    panel.querySelector(".save-settings").addEventListener("click", () => this._saveSettings());
    panel.querySelector(".cancel-settings").addEventListener("click", () => { this._settingsOpen = false; this._renderSettings(); });
  }

  async _saveSettings() {
    if (this._saving || !this._hass.user?.is_admin) return;
    this._saving = true;
    this._renderSettings();
    try {
      const url_path = this._config.dashboard_path;
      const dashboard = await this._hass.callWS({type: "lovelace/config", url_path});
      if (dashboard.strategy?.type !== "custom:dispatcharr") throw new Error("Use the dashboard card editor to change these settings.");
      const options = Object.fromEntries([...CARD_SETTINGS.map(([key]) => key), "title", "max_sessions"]
        .filter(key => this._draft[key] !== undefined).map(key => [key, this._draft[key]]));
      const updated = {...dashboard, strategy: {...dashboard.strategy,
        card_options: {...dashboard.strategy.card_options, ...options}}};
      await this._hass.callWS({type: "lovelace/config/save", url_path, config: updated});
      this._settingsOpen = false;
      this.setConfig({...this._config, ...options});
    } catch (error) {
      this._settingsError = error.message || "Unable to save card settings. Please try again.";
    } finally {
      this._saving = false;
      this._renderSettings();
    }
  }
}

class DispatcharrCardEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({mode: "open"}); }
  setConfig(config) { this._config = config; this._render(); }
  set hass(hass) { this._hass = hass; this._render(); }
  _render() {
    if (!this._config || !this._hass) return;
    this.shadowRoot.innerHTML = "<ha-form></ha-form>";
    const form = this.shadowRoot.querySelector("ha-form");
    form.hass = this._hass;
    form.schema = settingsSchema;
    form.computeLabel = settingsLabel;
    form.data = {...Object.fromEntries(CARD_SETTINGS.map(([key, , value]) => [key, value])),
      max_sessions: 12, ...this._config};
    form.addEventListener("value-changed", event => {
      this._config = {...this._config, ...event.detail.value};
      this.dispatchEvent(new CustomEvent("config-changed", {detail: {config: this._config}, bubbles: true, composed: true}));
    });
  }
}
if (!customElements.get("dispatcharr-card-editor")) customElements.define("dispatcharr-card-editor", DispatcharrCardEditor);

if (!customElements.get("dispatcharr-card")) {
  customElements.define("dispatcharr-card", DispatcharrCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "dispatcharr-card",
    name: "Dispatcharr",
    description: "Viewers, channels, VOD, catch-up and who is watching what, in one card.",
  });
}
