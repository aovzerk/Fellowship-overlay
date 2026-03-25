(() => {
  const STORAGE_KEY = 'overlay-player-positions-v2';
  const SKILL_SELECTIONS_KEY = 'overlay-skill-selections-v1';
  const CARD_SCALE_KEY = 'overlay-card-scale-v1';
  const PULL_PANEL_POSITION_KEY = 'overlay-pull-panel-position-v1';
  const RECENT_SKILLS_PANEL_POSITION_KEY = 'overlay-recent-skills-panel-position-v1';
  const VISIBILITY_SETTINGS_KEY = 'overlay-visibility-settings-v2';
  const CARD_SCALE_MIN = 0.30;
  const CARD_SCALE_MAX = 1.8;
  const CARD_SCALE_STEP = 0.05;
  const FRAME_GAP_MIN = 0;
  const FRAME_GAP_MAX = 40;
  const FRAME_GAP_STEP = 2;
  const ICONS_PER_ROW_MIN = 1;
  const ICONS_PER_ROW_MAX = 6;
  const RECENT_SKILLS_TRACK_COUNT_MIN = 1;
  const RECENT_SKILLS_TRACK_COUNT_MAX = 6;
  const PANEL_OPACITY_MIN = 0.2;
  const PANEL_OPACITY_MAX = 1;
  const DEFAULT_PULL_PANEL_POSITION: Point = { x: 16, y: 12 };
  const DEFAULT_RECENT_SKILLS_PANEL_POSITION: Point = { x: 16, y: 200 };
  const DEFAULT_VISIBILITY_SETTINGS: OverlayVisibilitySettings = { showParty: true, showPull: false, showRecentSkills: false };
  const DEFAULT_RECENT_SKILLS_LIMIT = 7;
  const DEFAULT_CARD_SCALE = 1;
  const DEFAULT_FRAME_GAP = 12;
  const DEFAULT_LAYOUT_DIRECTION: 'vertical' | 'horizontal' = 'vertical';
  const DEFAULT_PANEL_OPACITY = 0.88;
  const DEFAULT_ICONS_PER_ROW = 3;
  const DEFAULT_HOTKEYS: OverlayHotkeys = {
    toggleInteraction: 'F8',
    pickLog: 'F9',
    toggleVisibility: 'F10',
    openSettings: 'F11',
  };
  const DEFAULT_RECENT_SKILLS_LAYOUT_DIRECTION: 'vertical' | 'horizontal' = 'horizontal';
  const DEFAULT_RECENT_SKILLS_GROWTH_DIRECTION: 'left' | 'right' | 'up' | 'down' = 'right';
  const DEFAULT_RECENT_SKILLS_TRACK_COUNT = 3;
  const DEFAULT_AUTO_SCALE_ENABLED = true;
  const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
    autoScaleEnabled: DEFAULT_AUTO_SCALE_ENABLED,
    playerPositions: {},
    panelPositions: {
      pullInfo: { ...DEFAULT_PULL_PANEL_POSITION },
      recentSkills: { ...DEFAULT_RECENT_SKILLS_PANEL_POSITION },
    },
    visibilitySettings: { ...DEFAULT_VISIBILITY_SETTINGS },
    recentSkillsLimit: DEFAULT_RECENT_SKILLS_LIMIT,
    selectedSkillsByClass: {},
    cardScale: DEFAULT_CARD_SCALE,
    frameGap: DEFAULT_FRAME_GAP,
    layoutDirection: DEFAULT_LAYOUT_DIRECTION,
    panelOpacity: DEFAULT_PANEL_OPACITY,
    iconsPerRow: DEFAULT_ICONS_PER_ROW,
    hotkeys: { ...DEFAULT_HOTKEYS },
    recentSkillsLayoutDirection: DEFAULT_RECENT_SKILLS_LAYOUT_DIRECTION,
    recentSkillsGrowthDirection: DEFAULT_RECENT_SKILLS_GROWTH_DIRECTION,
    recentSkillsTrackCount: DEFAULT_RECENT_SKILLS_TRACK_COUNT,
  };

  window.OverlayRendererConstants = {
    CARD_SCALE_KEY,
    CARD_SCALE_MAX,
    CARD_SCALE_MIN,
    CARD_SCALE_STEP,
    FRAME_GAP_MAX,
    FRAME_GAP_MIN,
    FRAME_GAP_STEP,
    ICONS_PER_ROW_MAX,
    ICONS_PER_ROW_MIN,
    PANEL_OPACITY_MAX,
    PANEL_OPACITY_MIN,
    RECENT_SKILLS_TRACK_COUNT_MAX,
    RECENT_SKILLS_TRACK_COUNT_MIN,
    DEFAULT_CARD_SCALE,
    DEFAULT_FRAME_GAP,
    DEFAULT_HOTKEYS,
    DEFAULT_ICONS_PER_ROW,
    DEFAULT_LAYOUT_DIRECTION,
    DEFAULT_OVERLAY_SETTINGS,
    DEFAULT_AUTO_SCALE_ENABLED,
    DEFAULT_PANEL_OPACITY,
    DEFAULT_PULL_PANEL_POSITION,
    DEFAULT_RECENT_SKILLS_GROWTH_DIRECTION,
    DEFAULT_RECENT_SKILLS_LIMIT,
    DEFAULT_RECENT_SKILLS_LAYOUT_DIRECTION,
    DEFAULT_RECENT_SKILLS_PANEL_POSITION,
    DEFAULT_RECENT_SKILLS_TRACK_COUNT,
    DEFAULT_VISIBILITY_SETTINGS,
    PULL_PANEL_POSITION_KEY,
    RECENT_SKILLS_PANEL_POSITION_KEY,
    SKILL_SELECTIONS_KEY,
    STORAGE_KEY,
    VISIBILITY_SETTINGS_KEY,
  };
})();
