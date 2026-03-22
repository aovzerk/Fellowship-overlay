import type {
  NormalizedOverlaySettings,
  OverlaySettingsStore,
} from '../../types/main-process';
import type {
  LayoutDirection,
  LanguageCode,
  OverlayPanelPositions,
  OverlaySettings,
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
const CARD_SCALE_MIN = 0.75;
const CARD_SCALE_MAX = 1.8;
const DEFAULT_CARD_SCALE = 1;
const FRAME_GAP_MIN = 0;
const FRAME_GAP_MAX = 40;
const DEFAULT_FRAME_GAP = 12;
const PANEL_OPACITY_MIN = 0.2;
const PANEL_OPACITY_MAX = 1;
const DEFAULT_PANEL_OPACITY = 0.88;
const ICONS_PER_ROW_MIN = 1;
const ICONS_PER_ROW_MAX = 6;
const DEFAULT_ICONS_PER_ROW = 3;
const DEFAULT_LAYOUT_DIRECTION: LayoutDirection = 'vertical';
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
    trayHide: 'Скрыть оверлей',
    trayShow: 'Показать оверлей',
    traySettings: 'Настройки',
    trayExit: 'Выход',
    watchFileUnavailable: 'Текущий лог-файл недоступен',
    watchFolderUnavailable: 'Выбранная папка недоступна',
    watchFolderActive: 'Слежение за папкой и последним логом активно',
    noLogFiles: 'В выбранной папке не найдено файлов .log или .txt',
    logFolder: 'Папка с логами',
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
    showParty: source.showParty !== false,
    showPull: source.showPull !== false,
    showRecentSkills: source.showRecentSkills !== false,
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

function normalizeStoredPath(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
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
  DEFAULT_ICONS_PER_ROW,
  DEFAULT_LAYOUT_DIRECTION,
  DEFAULT_LANGUAGE,
  DEFAULT_PANEL_OPACITY,
  DEFAULT_PULL_PANEL_POSITION,
  DEFAULT_RECENT_SKILLS_LIMIT,
  DEFAULT_RECENT_SKILLS_PANEL_POSITION,
  FRAME_GAP_MAX,
  FRAME_GAP_MIN,
  I18N,
  ICONS_PER_ROW_MAX,
  ICONS_PER_ROW_MIN,
  LOG_FILE_EXTENSIONS,
  PANEL_OPACITY_MAX,
  PANEL_OPACITY_MIN,
  clamp,
  createOverlaySettingsStore,
  normalizeLanguage,
};
