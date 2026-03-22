(() => {
  const RELICS_ORDER_TOKEN = '__relics__';
  const {
    CARD_SCALE_KEY,
    CARD_SCALE_MAX,
    CARD_SCALE_MIN,
    DEFAULT_CARD_SCALE,
    DEFAULT_FRAME_GAP,
    DEFAULT_HOTKEYS,
    DEFAULT_ICONS_PER_ROW,
    DEFAULT_LAYOUT_DIRECTION,
    DEFAULT_OVERLAY_SETTINGS,
    DEFAULT_PANEL_OPACITY,
    DEFAULT_RECENT_SKILLS_GROWTH_DIRECTION,
    DEFAULT_PULL_PANEL_POSITION,
    DEFAULT_RECENT_SKILLS_LIMIT,
    DEFAULT_RECENT_SKILLS_LAYOUT_DIRECTION,
    DEFAULT_RECENT_SKILLS_PANEL_POSITION,
    DEFAULT_RECENT_SKILLS_TRACK_COUNT,
    DEFAULT_VISIBILITY_SETTINGS,
    FRAME_GAP_MAX,
    FRAME_GAP_MIN,
    ICONS_PER_ROW_MAX,
    ICONS_PER_ROW_MIN,
    PANEL_OPACITY_MAX,
    PANEL_OPACITY_MIN,
    RECENT_SKILLS_TRACK_COUNT_MAX,
    RECENT_SKILLS_TRACK_COUNT_MIN,
    PULL_PANEL_POSITION_KEY,
    RECENT_SKILLS_PANEL_POSITION_KEY,
    SKILL_SELECTIONS_KEY,
    STORAGE_KEY,
    VISIBILITY_SETTINGS_KEY,
  } = window.OverlayRendererConstants;
  const { clamp } = window.OverlayRendererFormatters;

  function normalizePosition(value: unknown, fallback: Point = { x: 0, y: 0 }): Point {
    const source = value as Partial<Point> | null | undefined;
    const x = Number(source?.x);
    const y = Number(source?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return { x: Math.round(Number(fallback?.x || 0)), y: Math.round(Number(fallback?.y || 0)) };
    }
    return { x: Math.round(x), y: Math.round(y) };
  }

  function normalizePlayerPositions(value: unknown): PlayerPositions {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const normalized: PlayerPositions = {};
    Object.entries(value).forEach(([key, position]) => {
      const source = position as Partial<Point> | null | undefined;
      const x = Number(source?.x);
      const y = Number(source?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      normalized[String(key)] = { x: Math.round(x), y: Math.round(y) };
    });
    return normalized;
  }

  function normalizePanelPositions(value: unknown): OverlayPanelPositions {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<OverlayPanelPositions> : {};
    return {
      pullInfo: normalizePosition(source.pullInfo, DEFAULT_PULL_PANEL_POSITION),
      recentSkills: normalizePosition(source.recentSkills, DEFAULT_RECENT_SKILLS_PANEL_POSITION),
    };
  }

  function normalizeVisibilitySettings(value: unknown): OverlayVisibilitySettings {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<OverlayVisibilitySettings> : {};
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
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const normalized: SkillSelectionMap = {};
    Object.entries(value).forEach(([classId, abilityIds]) => {
      const parsedClassId = String(Number(classId));
      if (!parsedClassId || parsedClassId === 'NaN') return;
      normalized[parsedClassId] = (Array.isArray(abilityIds) ? abilityIds : [])
        .map((id) => {
          if (String(id) === RELICS_ORDER_TOKEN) return RELICS_ORDER_TOKEN;
          const normalizedId = String(Number(id));
          return normalizedId && normalizedId !== 'NaN' ? normalizedId : null;
        })
        .filter((id): id is string => !!id);
    });
    return normalized;
  }

  function normalizeCardScaleValue(value: unknown): number {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) return DEFAULT_CARD_SCALE;
    return Math.round(clamp(normalized, CARD_SCALE_MIN, CARD_SCALE_MAX) * 100) / 100;
  }

  function normalizeFrameGap(value: unknown): number {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) return DEFAULT_FRAME_GAP;
    return Math.round(clamp(normalized, FRAME_GAP_MIN, FRAME_GAP_MAX));
  }

  function normalizeIconsPerRow(value: unknown): number {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) return DEFAULT_ICONS_PER_ROW;
    return Math.round(clamp(normalized, ICONS_PER_ROW_MIN, ICONS_PER_ROW_MAX));
  }

  function normalizeLayoutDirection(value: unknown): 'vertical' | 'horizontal' {
    return String(value || '').toLowerCase() === 'horizontal' ? 'horizontal' : 'vertical';
  }

  function normalizeHotkey(value: unknown, fallback: string): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }

  function normalizeHotkeys(value: unknown): OverlayHotkeys {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<OverlayHotkeys> : {};
    return {
      toggleInteraction: normalizeHotkey(source.toggleInteraction, DEFAULT_HOTKEYS.toggleInteraction),
      pickLog: normalizeHotkey(source.pickLog, DEFAULT_HOTKEYS.pickLog),
      toggleVisibility: normalizeHotkey(source.toggleVisibility, DEFAULT_HOTKEYS.toggleVisibility),
      openSettings: normalizeHotkey(source.openSettings, DEFAULT_HOTKEYS.openSettings),
    };
  }

  function normalizeRecentSkillsLayoutDirection(value: unknown): 'vertical' | 'horizontal' {
    return String(value || '').toLowerCase() === 'vertical' ? 'vertical' : 'horizontal';
  }

  function normalizeRecentSkillsGrowthDirection(value: unknown): 'left' | 'right' | 'up' | 'down' {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'left' || normalized === 'up' || normalized === 'down') return normalized;
    return DEFAULT_RECENT_SKILLS_GROWTH_DIRECTION;
  }

  function normalizeRecentSkillsTrackCount(value: unknown): number {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) return DEFAULT_RECENT_SKILLS_TRACK_COUNT;
    return Math.round(clamp(normalized, RECENT_SKILLS_TRACK_COUNT_MIN, RECENT_SKILLS_TRACK_COUNT_MAX));
  }

  function normalizePanelOpacity(value: unknown): number {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) return DEFAULT_PANEL_OPACITY;
    return Math.round(clamp(normalized, PANEL_OPACITY_MIN, PANEL_OPACITY_MAX) * 100) / 100;
  }

  function normalizeOverlaySettings(value: unknown): OverlaySettings {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<OverlaySettings> : {};
    return {
      playerPositions: normalizePlayerPositions(source.playerPositions),
      panelPositions: normalizePanelPositions(source.panelPositions),
      visibilitySettings: normalizeVisibilitySettings(source.visibilitySettings),
      recentSkillsLimit: normalizeRecentSkillsLimit(source.recentSkillsLimit),
      selectedSkillsByClass: normalizeSkillSelections(source.selectedSkillsByClass),
      cardScale: normalizeCardScaleValue(source.cardScale),
      frameGap: normalizeFrameGap(source.frameGap),
      layoutDirection: normalizeLayoutDirection(source.layoutDirection),
      panelOpacity: normalizePanelOpacity(source.panelOpacity),
      iconsPerRow: normalizeIconsPerRow(source.iconsPerRow),
      recentSkillsLayoutDirection: normalizeRecentSkillsLayoutDirection(source.recentSkillsLayoutDirection),
      recentSkillsGrowthDirection: normalizeRecentSkillsGrowthDirection(source.recentSkillsGrowthDirection),
      recentSkillsTrackCount: normalizeRecentSkillsTrackCount(source.recentSkillsTrackCount),
      hotkeys: normalizeHotkeys(source.hotkeys),
    };
  }

  function mergeOverlaySettings(baseSettings: unknown, partialSettings: unknown): OverlaySettings {
    const base = normalizeOverlaySettings(baseSettings);
    const partial = partialSettings && typeof partialSettings === 'object' && !Array.isArray(partialSettings) ? partialSettings as Partial<OverlaySettings> : {};
    return normalizeOverlaySettings({
      ...base,
      ...partial,
      panelPositions: {
        ...base.panelPositions,
        ...(partial.panelPositions && typeof partial.panelPositions === 'object' ? partial.panelPositions : {}),
      },
      visibilitySettings: {
        ...base.visibilitySettings,
        ...(partial.visibilitySettings && typeof partial.visibilitySettings === 'object' ? partial.visibilitySettings : {}),
      },
      playerPositions: partial.playerPositions === undefined ? base.playerPositions : partial.playerPositions,
      selectedSkillsByClass: partial.selectedSkillsByClass === undefined ? base.selectedSkillsByClass : partial.selectedSkillsByClass,
    });
  }

  function loadOverlaySettings(api: OverlayApi): OverlaySettings {
    try {
      const response = api?.getOverlaySettingsSync?.();
      const rawSettings =
        response && typeof response === 'object' && !Array.isArray(response)
          ? (response.settings && typeof response.settings === 'object' ? response.settings : response)
          : DEFAULT_OVERLAY_SETTINGS;

      return normalizeOverlaySettings(rawSettings);
    } catch {
      return normalizeOverlaySettings(DEFAULT_OVERLAY_SETTINGS);
    }
  }

  function createOverlaySettingsController(api: OverlayApi): OverlaySettingsController {
    let overlaySettingsCache = loadOverlaySettings(api);
    let playerPositionsCache = overlaySettingsCache.playerPositions;

    function getOverlaySettings(): OverlaySettings {
      overlaySettingsCache = mergeOverlaySettings(DEFAULT_OVERLAY_SETTINGS, overlaySettingsCache || {});
      return overlaySettingsCache;
    }

    function saveOverlaySettingsPatch(patch: Partial<OverlaySettings>): OverlaySettings {
      overlaySettingsCache = mergeOverlaySettings(getOverlaySettings(), patch);
      api?.saveOverlaySettings?.(overlaySettingsCache).catch(() => {});
      return overlaySettingsCache;
    }

    return {
      normalizeCardScaleValue,
      normalizeFrameGap,
      normalizeIconsPerRow,
      normalizeLayoutDirection,
      normalizeHotkeys,
      normalizePanelOpacity,
      normalizePosition,
      normalizeRecentSkillsLimit,
      normalizeRecentSkillsGrowthDirection,
      normalizeRecentSkillsLayoutDirection,
      normalizeRecentSkillsTrackCount,
      normalizeSkillSelections,
      normalizeVisibilitySettings,
      loadCardScale() {
        return normalizeCardScaleValue(getOverlaySettings().cardScale);
      },
      loadFrameGap() {
        return normalizeFrameGap(getOverlaySettings().frameGap);
      },
      loadIconsPerRow() {
        return normalizeIconsPerRow(getOverlaySettings().iconsPerRow);
      },
      loadHotkeys() {
        return normalizeHotkeys(getOverlaySettings().hotkeys);
      },
      loadLayoutDirection() {
        return normalizeLayoutDirection(getOverlaySettings().layoutDirection);
      },
      loadPanelOpacity() {
        return normalizePanelOpacity(getOverlaySettings().panelOpacity);
      },
      loadRecentSkillsGrowthDirection() {
        return normalizeRecentSkillsGrowthDirection(getOverlaySettings().recentSkillsGrowthDirection);
      },
      loadRecentSkillsLayoutDirection() {
        return normalizeRecentSkillsLayoutDirection(getOverlaySettings().recentSkillsLayoutDirection);
      },
      loadPositions() {
        if (playerPositionsCache && typeof playerPositionsCache === 'object') {
          return playerPositionsCache;
        }
        playerPositionsCache = normalizePlayerPositions(getOverlaySettings().playerPositions);
        return playerPositionsCache;
      },
      loadPullPanelPosition() {
        return normalizePosition(getOverlaySettings().panelPositions?.pullInfo, DEFAULT_PULL_PANEL_POSITION);
      },
      loadRecentSkillsLimit() {
        return normalizeRecentSkillsLimit(getOverlaySettings().recentSkillsLimit);
      },
      loadRecentSkillsTrackCount() {
        return normalizeRecentSkillsTrackCount(getOverlaySettings().recentSkillsTrackCount);
      },
      loadRecentSkillsPanelPosition() {
        return normalizePosition(getOverlaySettings().panelPositions?.recentSkills, DEFAULT_RECENT_SKILLS_PANEL_POSITION);
      },
      loadSkillSelections() {
        return normalizeSkillSelections(getOverlaySettings().selectedSkillsByClass);
      },
      loadVisibilitySettings() {
        return normalizeVisibilitySettings(getOverlaySettings().visibilitySettings);
      },
      saveCardScale(cardScale: number) {
        saveOverlaySettingsPatch({ cardScale });
      },
      saveFrameGap(frameGap: number) {
        saveOverlaySettingsPatch({ frameGap: normalizeFrameGap(frameGap) });
      },
      saveIconsPerRow(iconsPerRow: number) {
        saveOverlaySettingsPatch({ iconsPerRow: normalizeIconsPerRow(iconsPerRow) });
      },
      saveHotkeys(hotkeys: OverlayHotkeys) {
        saveOverlaySettingsPatch({ hotkeys: normalizeHotkeys(hotkeys) });
      },
      saveLayoutDirection(layoutDirection: 'vertical' | 'horizontal') {
        saveOverlaySettingsPatch({ layoutDirection: normalizeLayoutDirection(layoutDirection) });
      },
      savePanelOpacity(panelOpacity: number) {
        saveOverlaySettingsPatch({ panelOpacity: normalizePanelOpacity(panelOpacity) });
      },
      savePositions(positions: PlayerPositions) {
        const normalized = normalizePlayerPositions(positions);
        playerPositionsCache = normalized;
        saveOverlaySettingsPatch({ playerPositions: normalized });
      },
      savePullPanelPosition(position: Point) {
        saveOverlaySettingsPatch({
          panelPositions: {
            pullInfo: normalizePosition(position, DEFAULT_PULL_PANEL_POSITION),
          } as OverlayPanelPositions,
        });
      },
      saveRecentSkillsLimit(recentSkillsLimit: number) {
        saveOverlaySettingsPatch({ recentSkillsLimit });
      },
      saveRecentSkillsGrowthDirection(recentSkillsGrowthDirection: 'left' | 'right' | 'up' | 'down') {
        saveOverlaySettingsPatch({ recentSkillsGrowthDirection });
      },
      saveRecentSkillsLayoutDirection(recentSkillsLayoutDirection: 'vertical' | 'horizontal') {
        saveOverlaySettingsPatch({ recentSkillsLayoutDirection });
      },
      saveRecentSkillsPanelPosition(position: Point) {
        saveOverlaySettingsPatch({
          panelPositions: {
            recentSkills: normalizePosition(position, DEFAULT_RECENT_SKILLS_PANEL_POSITION),
          } as OverlayPanelPositions,
        });
      },
      saveRecentSkillsTrackCount(recentSkillsTrackCount: number) {
        saveOverlaySettingsPatch({ recentSkillsTrackCount });
      },
      saveSkillSelections(selectedSkillsByClass: SkillSelectionMap) {
        saveOverlaySettingsPatch({ selectedSkillsByClass: normalizeSkillSelections(selectedSkillsByClass) });
      },
      saveVisibilitySettings(visibilitySettings: OverlayVisibilitySettings) {
        saveOverlaySettingsPatch({ visibilitySettings: normalizeVisibilitySettings(visibilitySettings) });
      },
    };
  }

  window.OverlayRendererSettings = {
    createOverlaySettingsController,
  };
})();
