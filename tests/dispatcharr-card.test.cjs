const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function card(config = {}) {
  const elements = new Map();
  const context = vm.createContext({
    HTMLElement: class {
      attachShadow() {
        this.shadowRoot = { innerHTML: "", querySelectorAll: () => [] };
      }
    },
    customElements: { get: (name) => elements.get(name), define: (name, value) => elements.set(name, value) },
    window: {},
  });
  const source = fs.readFileSync(path.join(__dirname, "../custom_components/dispatcharr_info/www/dispatcharr-card.js"), "utf8");
  vm.runInContext(source, context);
  const instance = new (elements.get("dispatcharr-card"))();
  instance.setConfig(config);
  return instance;
}

function hass(program, kind = "live", timeZone = "UTC") {
  return {
    locale: { language: "en-GB" },
    config: { time_zone: timeZone },
    entities: {
      "sensor.sessions": { platform: "dispatcharr_info", translation_key: "viewing_sessions" },
    },
    states: {
      "sensor.sessions": {
        state: "1",
        attributes: { sessions: [{
          kind, user: "v4rd", channel: "Eurosport 1", stream: "channel-1",
          ip: "10.10.10.253", player: "TiviMate/5.0", program,
        }] },
      },
    },
  };
}

function program(title = "Live cycling") {
  return { title, start_time: "2026-11-01T12:00:00Z", end_time: "2026-11-01T14:00:00Z" };
}

test("shows escaped programme title followed by IP and client", () => {
  const instance = card();
  instance.hass = hass(program('<Cycling> & "Highlights"'));
  const html = instance.shadowRoot.innerHTML;
  assert.match(html, /class="program">&lt;Cycling&gt; &amp; &quot;Highlights&quot;<span class="meta">/);
  assert.doesNotMatch(html, /airtime|12:00 - 14:00/);
  assert.match(html, /class="program">.*10\.10\.10\.253.*TiviMate<\/span><\/div>/);
  assert.ok(html.indexOf('class="what"') < html.indexOf('class="program"'));
  assert.match(html, /10\.10\.10\.253/);
  assert.match(html, /TiviMate/);
});

test("does not render an airtime row in any time zone", () => {
  const instance = card();
  instance.hass = hass(program(), "live", "Europe/Stockholm");
  assert.doesNotMatch(instance.shadowRoot.innerHTML, /airtime|13:00 - 15:00/);
});

test("missing EPG keeps the existing row without an empty programme line", () => {
  for (const guide of [undefined, null, {}]) {
    const instance = card();
    instance.hass = hass(guide);
    assert.doesNotMatch(instance.shadowRoot.innerHTML, /class="program"/);
    assert.match(instance.shadowRoot.innerHTML, /Eurosport 1/);
  }
});

test("invalid or incomplete airtimes still show the title", () => {
  for (const guide of [
    { title: "Cycling" },
    { ...program(), start_time: "invalid" },
    { ...program(), end_time: "2026-11-01T11:00:00Z" },
  ]) {
    const instance = card();
    instance.hass = hass(guide);
    assert.match(instance.shadowRoot.innerHTML, /class="program">/);
    assert.doesNotMatch(instance.shadowRoot.innerHTML, /class="meta airtime"/);
  }
});

test("programme changes rerender even when the session count is unchanged", () => {
  const instance = card();
  instance.hass = hass(program("Cycling"));
  instance.hass = hass(program("Tennis"));
  assert.match(instance.shadowRoot.innerHTML, /class="program">Tennis<span/);
  assert.doesNotMatch(instance.shadowRoot.innerHTML, /class="program">Cycling/);
  instance.hass = hass(null);
  assert.doesNotMatch(instance.shadowRoot.innerHTML, /class="program"/);
});

test("does not show live EPG on VOD or catch-up sessions", () => {
  for (const kind of ["vod", "catchup"]) {
    const instance = card();
    instance.hass = hass(program(), kind);
    assert.doesNotMatch(instance.shadowRoot.innerHTML, /class="program"/);
  }
});

test("programme, IP and client can be switched independently", () => {
  const instance = card({show_program: false, show_ip: false});
  instance.hass = hass(program());
  assert.doesNotMatch(instance.shadowRoot.innerHTML, /class="program"|10\.10\.10\.253/);
  assert.match(instance.shadowRoot.innerHTML, /TiviMate/);
  instance.setConfig({show_client: false});
  assert.match(instance.shadowRoot.innerHTML, /class="program"|10\.10\.10\.253/);
  assert.doesNotMatch(instance.shadowRoot.innerHTML, /TiviMate/);
  assert.doesNotMatch(instance.shadowRoot.innerHTML, /airtime/);
});

test("sections, identity and individual metrics can be hidden", () => {
  const snapshot = hass(program());
  for (const key of ["live_viewers", "active_channels", "vod_connections", "catchup_sessions", "epg_errors"]) {
    snapshot.entities[`sensor.${key}`] = {platform: "dispatcharr_info", translation_key: key};
    snapshot.states[`sensor.${key}`] = {state: "2", attributes: {}};
  }
  const instance = card();
  instance.hass = snapshot;
  assert.match(instance.shadowRoot.innerHTML, />Viewers<|class="banner"/);
  for (const [option, content] of [["show_streams", "Streams in use"], ["show_now_watching", "Now watching"],
    ["show_live_viewers", "Viewers"], ["show_active_channels", "Channels"],
    ["show_vod_connections", "VOD"], ["show_catchup_sessions", "Catch-up"]]) {
    instance.setConfig({[option]: false});
    assert.ok(!instance.shadowRoot.innerHTML.includes(`>${content}<`), option);
  }
  instance.setConfig({show_header: false, show_user: false, show_avatars: false, show_channel: false, show_epg_errors: false});
  assert.doesNotMatch(instance.shadowRoot.innerHTML, /class="head"|class="av"|v4rd|Eurosport 1|class="banner"/);
  instance.setConfig({show_summary: false, show_status: false});
  assert.doesNotMatch(instance.shadowRoot.innerHTML, /class="sub"|class="pill on"/);
  instance.hass = hass(program(), "vod");
  instance.setConfig({show_kind: false});
  assert.doesNotMatch(instance.shadowRoot.innerHTML, /class="badge"/);
});

test("settings save to the dashboard and preserve unrelated configuration", async () => {
  const instance = card({dashboard_path: "dashboard-dispatcharr"});
  const snapshot = hass(program());
  const saved = [];
  snapshot.user = {is_admin: true};
  snapshot.callWS = async msg => {
    saved.push(msg);
    return {title: "Keep title", strategy: {type: "custom:dispatcharr", card_options: {max_sessions: 20}}};
  };
  instance.hass = snapshot;
  instance._draft = {show_ip: false, show_client: true};
  instance._settingsOpen = true;
  await instance._saveSettings();
  assert.equal(saved[1].type, "lovelace/config/save");
  assert.equal(saved[1].config.title, "Keep title");
  assert.equal(saved[1].config.strategy.card_options.show_ip, false);
  assert.equal(saved[1].config.strategy.card_options.max_sessions, 20);
  assert.equal(instance._settingsOpen, false);
  assert.doesNotMatch(instance.shadowRoot.innerHTML, /10\.10\.10\.253/);
});

test("failed saves retain the draft and non-admins cannot save", async () => {
  const instance = card({dashboard_path: "dashboard-dispatcharr"});
  const snapshot = hass(program());
  snapshot.user = {is_admin: true};
  snapshot.callWS = async () => { throw new Error("Save failed"); };
  instance.hass = snapshot;
  instance._draft = {show_program: false};
  instance._settingsOpen = true;
  await instance._saveSettings();
  assert.equal(instance._settingsOpen, true);
  assert.equal(instance._settingsError, "Save failed");
  assert.equal(instance._draft.show_program, false);
  snapshot.user.is_admin = false;
  snapshot.callWS = async () => assert.fail("Non-admin attempted a write");
  await instance._saveSettings();
});
