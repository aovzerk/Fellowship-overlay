import type {
  NormalizedOverlaySettings,
  OverlaySettingsStore,
} from '../../types/main-process';
import type {
  OverlayHotkeys,
  LayoutDirection,
  LanguageCode,
  OverlayPanelPositions,
  OverlaySettings,
  RecentSkillsGrowthDirection,
  RecentSkillsLayoutDirection,
  OverlayVisibilitySettings,
  PlayerPositions,
  Point,
  SkillSelectionMap,
} from '../../types/overlay';

import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_LANGUAGE: LanguageCode = 'en';
const DEFAULT_PULL_PANEL_POSITION: Point = { x: 16, y: 12 };
const DEFAULT_RECENT_SKILLS_PANEL_POSITION: Point = { x: 16, y: 200 };
const DEFAULT_RECENT_SKILLS_LIMIT = 7;
const DEFAULT_VISIBILITY_SETTINGS: OverlayVisibilitySettings = { showParty: true, showPull: false, showRecentSkills: false };
const CARD_SCALE_MIN = 0.30;
const CARD_SCALE_MAX = 1.8;
const DEFAULT_CARD_SCALE = 0.7;
const FRAME_GAP_MIN = 0;
const FRAME_GAP_MAX = 40;
const DEFAULT_FRAME_GAP = 12;
const PANEL_OPACITY_MIN = 0.2;
const PANEL_OPACITY_MAX = 1;
const DEFAULT_PANEL_OPACITY = 0.88;
const ICONS_PER_ROW_MIN = 1;
const ICONS_PER_ROW_MAX = 6;
const DEFAULT_ICONS_PER_ROW = 3;
const RECENT_SKILLS_TRACK_COUNT_MIN = 1;
const RECENT_SKILLS_TRACK_COUNT_MAX = 6;
const DEFAULT_RECENT_SKILLS_TRACK_COUNT = 3;
const DEFAULT_AUTO_HIDE_WITH_GAME_WINDOW = false;
const DEFAULT_LAYOUT_DIRECTION: LayoutDirection = 'vertical';
const DEFAULT_HOTKEYS: OverlayHotkeys = {
  toggleInteraction: 'F8',
  pickLog: 'F9',
  toggleVisibility: 'F10',
  openSettings: 'F11',
};
const DEFAULT_RECENT_SKILLS_LAYOUT_DIRECTION: RecentSkillsLayoutDirection = 'horizontal';
const DEFAULT_RECENT_SKILLS_GROWTH_DIRECTION: RecentSkillsGrowthDirection = 'right';
const LOG_FILE_EXTENSIONS = new Set(['.txt', '.log']);

const I18N: Record<LanguageCode, Record<string, string>> = {
  en: {
    trayTooltip: 'Fellowship Overlay',
    trayHide: 'Hide overlay',
    trayShow: 'Show overlay',
    traySettings: 'Settings',
    trayExit: 'Exit',
    watchFileUnavailable: 'Selected log file is unavailable',
    watchFolderUnavailable: 'Selected folder is unavailable',
    watchFolderActive: 'Watching folder for the newest log file',
    noLogFiles: 'No .log or .txt files found in the selected folder',
    logFolder: 'Log folder',
  },
  ru: {
    trayTooltip: 'Fellowship Overlay',
    trayHide: '\u0421\u043a\u0440\u044b\u0442\u044c \u043e\u0432\u0435\u0440\u043b\u0435\u0439',
    trayShow: '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u043e\u0432\u0435\u0440\u043b\u0435\u0439',
    traySettings: '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438',
    trayExit: '\u0412\u044b\u0445\u043e\u0434',
    watchFileUnavailable: '\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u043b\u043e\u0433-\u0444\u0430\u0439\u043b \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d',
    watchFolderUnavailable: '\u0412\u044b\u0431\u0440\u0430\u043d\u043d\u0430\u044f \u043f\u0430\u043f\u043a\u0430 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430',
    watchFolderActive: '\u0421\u043b\u0435\u0436\u0435\u043d\u0438\u0435 \u0437\u0430 \u043f\u0430\u043f\u043a\u043e\u0439 \u0438 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u043c \u043b\u043e\u0433\u043e\u043c \u0430\u043a\u0442\u0438\u0432\u043d\u043e',
    noLogFiles: '\u0412 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0439 \u043f\u0430\u043f\u043a\u0435 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e \u0444\u0430\u0439\u043b\u043e\u0432 .log \u0438\u043b\u0438 .txt',
    logFolder: '\u041f\u0430\u043f\u043a\u0430 \u0441 \u043b\u043e\u0433\u0430\u043c\u0438',
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeLanguage(value: unknown): LanguageCode {
  return String(value || '').toLowerCase() === 'ru' ? 'ru' : 'en';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizePosition(value: unknown, fallback: Point): Point {
  const source = asRecord(value);
  const x = Number(source.x);
  const y = Number(source.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { x: fallback.x, y: fallback.y };
  }
  return { x: Math.round(x), y: Math.round(y) };
}

function normalizePlayerPositions(value: unknown): PlayerPositions {
  const source = asRecord(value);
  const normalized: PlayerPositions = {};

  Object.entries(source).forEach(([key, position]) => {
    const point = normalizePosition(position, { x: NaN, y: NaN });
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    normalized[String(key)] = point;
  });

  return normalized;
}

function normalizePanelPositions(value: unknown): OverlayPanelPositions {
  const source = asRecord(value);
  return {
    pullInfo: normalizePosition(source.pullInfo, DEFAULT_PULL_PANEL_POSITION),
    recentSkills: normalizePosition(source.recentSkills, DEFAULT_RECENT_SKILLS_PANEL_POSITION),
  };
}

function normalizeVisibilitySettings(value: unknown): OverlayVisibilitySettings {
  const source = asRecord(value);
  return {
    showParty: typeof source.showParty === 'boolean'
      ? source.showParty
      : DEFAULT_VISIBILITY_SETTINGS.showParty,
    showPull: typeof source.showPull === 'boolean'
      ? source.showPull
      : DEFAULT_VISIBILITY_SETTINGS.showPull,
    showRecentSkills: typeof source.showRecentSkills === 'boolean'
      ? source.showRecentSkills
      : DEFAULT_VISIBILITY_SETTINGS.showRecentSkills,
  };
}

function normalizeRecentSkillsLimit(value: unknown): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return DEFAULT_RECENT_SKILLS_LIMIT;
  return Math.round(clamp(normalized, 1, 20));
}

function normalizeSkillSelections(value: unknown): SkillSelectionMap {
  const source = asRecord(value);
  const normalized: SkillSelectionMap = {};

  Object.entries(source).forEach(([classId, abilityIds]) => {
    const parsedClassId = String(Number(classId));
    if (!parsedClassId || parsedClassId === 'NaN') return;
    normalized[parsedClassId] = (Array.isArray(abilityIds) ? abilityIds : [])
      .map((id) => String(Number(id)))
      .filter((id) => id && id !== 'NaN');
  });

  return normalized;
}

function normalizeCardScale(value: unknown): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return DEFAULT_CARD_SCALE;
  return Math.round(clamp(normalized, CARD_SCALE_MIN, CARD_SCALE_MAX) * 100) / 100;
}

function normalizeFrameGap(value: unknown): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return DEFAULT_FRAME_GAP;
  return Math.round(clamp(normalized, FRAME_GAP_MIN, FRAME_GAP_MAX));
}

function normalizePanelOpacity(value: unknown): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return DEFAULT_PANEL_OPACITY;
  return Math.round(clamp(normalized, PANEL_OPACITY_MIN, PANEL_OPACITY_MAX) * 100) / 100;
}

function normalizeIconsPerRow(value: unknown): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return DEFAULT_ICONS_PER_ROW;
  return Math.round(clamp(normalized, ICONS_PER_ROW_MIN, ICONS_PER_ROW_MAX));
}

function normalizeLayoutDirection(value: unknown): LayoutDirection {
  return String(value || '').toLowerCase() === 'horizontal' ? 'horizontal' : 'vertical';
}

function normalizeRecentSkillsLayoutDirection(value: unknown): RecentSkillsLayoutDirection {
  return String(value || '').toLowerCase() === 'vertical' ? 'vertical' : 'horizontal';
}

function normalizeRecentSkillsGrowthDirection(value: unknown): RecentSkillsGrowthDirection {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'left' || normalized === 'up' || normalized === 'down') return normalized;
  return DEFAULT_RECENT_SKILLS_GROWTH_DIRECTION;
}

function normalizeRecentSkillsTrackCount(value: unknown): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return DEFAULT_RECENT_SKILLS_TRACK_COUNT;
  return Math.round(clamp(normalized, RECENT_SKILLS_TRACK_COUNT_MIN, RECENT_SKILLS_TRACK_COUNT_MAX));
}

function normalizeAutoHideWithGameWindow(value: unknown): boolean {
  return typeof value === 'boolean' ? value : DEFAULT_AUTO_HIDE_WITH_GAME_WINDOW;
}

function normalizeStoredPath(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeHotkey(value: unknown, fallback: string): string {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function normalizeHotkeys(value: unknown): OverlayHotkeys {
  const source = asRecord(value);
  return {
    toggleInteraction: normalizeHotkey(source.toggleInteraction, DEFAULT_HOTKEYS.toggleInteraction),
    pickLog: normalizeHotkey(source.pickLog, DEFAULT_HOTKEYS.pickLog),
    toggleVisibility: normalizeHotkey(source.toggleVisibility, DEFAULT_HOTKEYS.toggleVisibility),
    openSettings: normalizeHotkey(source.openSettings, DEFAULT_HOTKEYS.openSettings),
  };
}

function normalizeCurrentFilePath(value: unknown): string | null {
  return normalizeStoredPath(value);
}

function normalizeDirectoryPath(value: unknown): string | null {
  return normalizeStoredPath(value);
}

function normalizeSettings(value: unknown): NormalizedOverlaySettings {
  const source = asRecord(value);
  const legacyCurrentFilePath = normalizeCurrentFilePath(source.currentFilePath);
  const logDirectoryPath = normalizeDirectoryPath(source.logDirectoryPath)
    || (legacyCurrentFilePath ? path.dirname(legacyCurrentFilePath) : null);

  return {
    language: normalizeLanguage(source.language),
    logDirectoryPath,
    currentFilePath: legacyCurrentFilePath,
    playerPositions: normalizePlayerPositions(source.playerPositions),
    panelPositions: normalizePanelPositions(source.panelPositions),
    visibilitySettings: normalizeVisibilitySettings(source.visibilitySettings),
    recentSkillsLimit: normalizeRecentSkillsLimit(source.recentSkillsLimit),
    selectedSkillsByClass: normalizeSkillSelections(source.selectedSkillsByClass),
    cardScale: normalizeCardScale(source.cardScale),
    frameGap: normalizeFrameGap(source.frameGap),
    layoutDirection: normalizeLayoutDirection(source.layoutDirection),
    panelOpacity: normalizePanelOpacity(source.panelOpacity),
    iconsPerRow: normalizeIconsPerRow(source.iconsPerRow),
    recentSkillsLayoutDirection: normalizeRecentSkillsLayoutDirection(source.recentSkillsLayoutDirection),
    recentSkillsGrowthDirection: normalizeRecentSkillsGrowthDirection(source.recentSkillsGrowthDirection),
    recentSkillsTrackCount: normalizeRecentSkillsTrackCount(source.recentSkillsTrackCount),
    autoHideWithGameWindow: normalizeAutoHideWithGameWindow(source.autoHideWithGameWindow),
    hotkeys: normalizeHotkeys(source.hotkeys),
  };
}

function mergeSettings(baseSettings: unknown, partialSettings: unknown): NormalizedOverlaySettings {
  const base = normalizeSettings(baseSettings);
  const partial = asRecord(partialSettings);
  const partialPanelPositions = asRecord(partial.panelPositions);
  const partialVisibilitySettings = asRecord(partial.visibilitySettings);

  return normalizeSettings({
    ...base,
    ...partial,
    panelPositions: {
      ...base.panelPositions,
      ...partialPanelPositions,
    },
    visibilitySettings: {
      ...base.visibilitySettings,
      ...partialVisibilitySettings,
    },
    playerPositions: partial.playerPositions === undefined ? base.playerPositions : partial.playerPositions,
    selectedSkillsByClass: partial.selectedSkillsByClass === undefined ? base.selectedSkillsByClass : partial.selectedSkillsByClass,
  });
}

function createOverlaySettingsStore({ settingsFile }: { settingsFile: string }): OverlaySettingsStore {
  function loadSettings(): NormalizedOverlaySettings {
    try {
      const raw = fs.readFileSync(settingsFile, 'utf8');
      return normalizeSettings(JSON.parse(raw || '{}'));
    } catch {
      return normalizeSettings({});
    }
  }

  function saveSettings(nextSettings: unknown): void {
    try {
      const normalized = normalizeSettings(nextSettings);
      fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
      fs.writeFileSync(settingsFile, JSON.stringify(normalized, null, 2), 'utf8');
    } catch {}
  }

  let settings: NormalizedOverlaySettings = loadSettings();

  return {
    t(key: string): string {
      const lang = normalizeLanguage(settings.language);
      return I18N[lang]?.[key] || I18N[DEFAULT_LANGUAGE]?.[key] || key;
    },
    getSettings(): NormalizedOverlaySettings {
      return normalizeSettings(settings);
    },
    getCurrentLanguage(): LanguageCode {
      return normalizeLanguage(settings.language);
    },
    setCurrentLanguage(language: unknown): LanguageCode {
      settings = mergeSettings(settings, { language: normalizeLanguage(language) });
      saveSettings(settings);
      return normalizeLanguage(settings.language);
    },
    getPlayerPositions(): PlayerPositions {
      return normalizePlayerPositions(settings.playerPositions);
    },
    setPlayerPositions(playerPositions: PlayerPositions): PlayerPositions {
      settings = mergeSettings(settings, { playerPositions });
      saveSettings(settings);
      return normalizePlayerPositions(settings.playerPositions);
    },
    getOverlaySettings(): NormalizedOverlaySettings {
      return normalizeSettings(settings);
    },
    saveOverlaySettings(partialSettings: Partial<OverlaySettings>): NormalizedOverlaySettings {
      settings = mergeSettings(settings, partialSettings);
      saveSettings(settings);
      return normalizeSettings(settings);
    },
    getCurrentFilePath(): string | null {
      return settings.currentFilePath || null;
    },
    setCurrentFilePath(filePath: unknown): string | null {
      const normalized = normalizeCurrentFilePath(filePath);
      settings = mergeSettings(settings, { currentFilePath: normalized });
      saveSettings(settings);
      return settings.currentFilePath || null;
    },
    getCurrentDirectoryPath(): string | null {
      return settings.logDirectoryPath || null;
    },
    setCurrentDirectoryPath(directoryPath: unknown): string | null {
      const normalized = normalizeDirectoryPath(directoryPath);
      settings = mergeSettings(settings, { logDirectoryPath: normalized });
      saveSettings(settings);
      return settings.logDirectoryPath || null;
    },
    normalizeDirectoryPath,
    normalizeCurrentFilePath,
  };
}

export {
  CARD_SCALE_MAX,
  CARD_SCALE_MIN,
  DEFAULT_CARD_SCALE,
  DEFAULT_FRAME_GAP,
  DEFAULT_HOTKEYS,
  DEFAULT_ICONS_PER_ROW,
  DEFAULT_LAYOUT_DIRECTION,
  DEFAULT_LANGUAGE,
  DEFAULT_PANEL_OPACITY,
  DEFAULT_PULL_PANEL_POSITION,
  DEFAULT_RECENT_SKILLS_GROWTH_DIRECTION,
  DEFAULT_RECENT_SKILLS_LIMIT,
  DEFAULT_RECENT_SKILLS_LAYOUT_DIRECTION,
  DEFAULT_RECENT_SKILLS_PANEL_POSITION,
  DEFAULT_RECENT_SKILLS_TRACK_COUNT,
  FRAME_GAP_MAX,
  FRAME_GAP_MIN,
  I18N,
  ICONS_PER_ROW_MAX,
  ICONS_PER_ROW_MIN,
  LOG_FILE_EXTENSIONS,
  PANEL_OPACITY_MAX,
  PANEL_OPACITY_MIN,
  RECENT_SKILLS_TRACK_COUNT_MAX,
  RECENT_SKILLS_TRACK_COUNT_MIN,
  clamp,
  createOverlaySettingsStore,
  normalizeAutoHideWithGameWindow,
  normalizeLanguage,
  normalizeHotkeys,
};
