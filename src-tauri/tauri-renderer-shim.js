(function () {
  const tauri = window.__TAURI__ || {};
  const invoke = tauri.core && tauri.core.invoke;
  const listen = tauri.event && tauri.event.listen;
  const SETTINGS_KEY = "fellowship-overlay-settings-v1";
  const OLD_SETTINGS_KEY = "fellowship-overlay-tauri-settings-v1";
  const CARD_SCALE_MIGRATION_KEY = "__cardScaleMigrated";
  const OLD_CARD_SCALE_MIGRATION_KEY = "__tauriCardScaleMigrated";

  const defaultSettings = () => {
    const constants = window.OverlayRendererConstants || {};
    return {
      ...(constants.DEFAULT_OVERLAY_SETTINGS || {}),
      language: "ru",
      logDirectoryPath: null,
      currentFilePath: null,
      cardScale: 0.7,
    };
  };

  function readSettings() {
    try {
      let raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        raw = localStorage.getItem(OLD_SETTINGS_KEY);
        if (raw) {
          localStorage.setItem(SETTINGS_KEY, raw);
        }
      }
      const settings = { ...defaultSettings(), ...(raw ? JSON.parse(raw) : {}) };
      if (
        !settings[CARD_SCALE_MIGRATION_KEY] &&
        !settings[OLD_CARD_SCALE_MIGRATION_KEY] &&
        Number(settings.cardScale) === 1
      ) {
        settings.cardScale = 0.7;
      }
      if (settings[OLD_CARD_SCALE_MIGRATION_KEY]) {
        delete settings[OLD_CARD_SCALE_MIGRATION_KEY];
      }
      settings[CARD_SCALE_MIGRATION_KEY] = true;
      writeSettings(settings);
      return settings;
    } catch {
      return defaultSettings();
    }
  }

  function writeSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function saveSettingsPatch(patch) {
    const next = { ...readSettings(), ...(patch || {}) };
    writeSettings(next);
    return next;
  }

  function noopSubscribe() {}

  function mapOverlayState(state) {
    const clickThrough = Boolean(state && (state.clickThrough ?? state.click_through));
    return {
      clickThrough,
      locked: !clickThrough,
    };
  }

  async function call(command, args, fallback) {
    if (!invoke) return fallback;
    try {
      return await invoke(command, args);
    } catch {
      return fallback;
    }
  }

  async function loadSkillCatalog() {
    try {
      const response = await fetch("./skill-catalog.json", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      return await response.json();
    } catch {
      return { classes: [] };
    }
  }

  function overrideAssetPathFormatter() {
    const formatters = window.OverlayRendererFormatters;
    if (!formatters) return;
    const escapeHtml = formatters.escapeHtml || ((value) => String(value || ""));
    formatters.toAssetSrc = (relPath) => {
      const normalized = String(relPath || "game-data/relics/empty.jpg")
        .replace(/^\.\//, "")
        .replace(/^\/+/, "");
      return escapeHtml(normalized);
    };
  }

  window.FellowshipTauriShim = { overrideAssetPathFormatter };

  window.api = {
    pickLogFile: async () => call("pick_log_file", undefined, {
      canceled: true,
      ok: false,
      filePath: readSettings().currentFilePath || null,
      directoryPath: readSettings().logDirectoryPath || null,
    }),
    reloadCurrentFile: async () => call("reload_current_file", undefined, {
      ok: false,
      filePath: readSettings().currentFilePath || null,
      directoryPath: readSettings().logDirectoryPath || null,
    }),
    toggleOverlayLock: async () => {
      const state = await call("toggle_click_through", undefined, {});
      return { locked: Boolean(mapOverlayState(state).locked) };
    },
    toggleOverlayVisibility: async () => call("toggle_overlay_visibility", undefined, { visible: true }),
    setSettingsModalOpen: async (open) => {
      return call("set_settings_modal_open", { open: !!open }, { ok: true });
    },
    closeInteractiveModal: async () => {
      return call("close_interactive_modal", undefined, { locked: true });
    },
    getCurrentFile: async () => call("get_current_file", undefined, {
      filePath: readSettings().currentFilePath || null,
      directoryPath: readSettings().logDirectoryPath || null,
    }),
    getSkillCatalog: loadSkillCatalog,
    getLanguage: async () => call("get_language", undefined, { language: readSettings().language || "ru" }),
    setLanguage: async (language) => {
      const settings = saveSettingsPatch({ language: language === "en" ? "en" : "ru" });
      return call("set_language", { language: settings.language }, { language: settings.language });
    },
    getPlayerPositionsSync: () => ({ playerPositions: readSettings().playerPositions || {} }),
    savePlayerPositions: async (playerPositions) => {
      const settings = saveSettingsPatch({ playerPositions: playerPositions || {} });
      await call("save_overlay_settings", { partialSettings: { playerPositions: settings.playerPositions || {} } }, null);
      return { ok: true, playerPositions: settings.playerPositions || {} };
    },
    getOverlaySettingsSync: () => ({ settings: readSettings() }),
    saveOverlaySettings: async (partialSettings) => {
      const settings = saveSettingsPatch(partialSettings || {});
      await call("save_overlay_settings", { partialSettings: partialSettings || {} }, null);
      return { ok: true, settings };
    },
    onLogData: (callback) => {
      if (!listen) return;
      listen("log-data", (event) => callback(event.payload || {}));
    },
    onWatchStatus: (callback) => {
      if (!listen) return;
      listen("watch-status", (event) => callback(event.payload || {}));
    },
    onHudActivity: (callback) => {
      if (!listen) return;
      listen("hud-activity", (event) => callback(event.payload || {}));
    },
    onLanguageChanged: noopSubscribe,
    onRequestCloseSettings: (callback) => {
      if (!listen) return;
      listen("request-close-settings", () => callback());
    },
    onOpenSettings: (callback) => {
      if (!listen) return;
      listen("open-settings", (event) => callback(event.payload || {}));
    },
    onOverlayMode: (callback) => {
      if (!listen) return;
      listen("overlay-state", (event) => callback(mapOverlayState(event.payload)));
    },
  };
})();
