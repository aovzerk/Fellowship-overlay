(() => {
  const STORAGE_KEY = 'overlay-player-positions-v2';
  const SKILL_SELECTIONS_KEY = 'overlay-skill-selections-v1';
  const CARD_SCALE_KEY = 'overlay-card-scale-v1';
  const PULL_PANEL_POSITION_KEY = 'overlay-pull-panel-position-v1';
  const RECENT_SKILLS_PANEL_POSITION_KEY = 'overlay-recent-skills-panel-position-v1';
  const VISIBILITY_SETTINGS_KEY = 'overlay-visibility-settings-v2';
  const CARD_SCALE_MIN = 0.75;
  const CARD_SCALE_MAX = 1.8;
  const CARD_SCALE_STEP = 0.05;
  const DEFAULT_PULL_PANEL_POSITION: Point = { x: 16, y: 12 };
  const DEFAULT_RECENT_SKILLS_PANEL_POSITION: Point = { x: 16, y: 200 };
  const DEFAULT_VISIBILITY_SETTINGS: OverlayVisibilitySettings = { showParty: true, showPull: false, showRecentSkills: false };
  const DEFAULT_RECENT_SKILLS_LIMIT = 7;
  const DEFAULT_CARD_SCALE = 1;
  const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
    playerPositions: {},
    panelPositions: {
      pullInfo: { ...DEFAULT_PULL_PANEL_POSITION },
      recentSkills: { ...DEFAULT_RECENT_SKILLS_PANEL_POSITION },
    },
    visibilitySettings: { ...DEFAULT_VISIBILITY_SETTINGS },
    recentSkillsLimit: DEFAULT_RECENT_SKILLS_LIMIT,
    selectedSkillsByClass: {},
    cardScale: DEFAULT_CARD_SCALE,
  };

  window.OverlayRendererConstants = {
    CARD_SCALE_KEY,
    CARD_SCALE_MAX,
    CARD_SCALE_MIN,
    CARD_SCALE_STEP,
    DEFAULT_CARD_SCALE,
    DEFAULT_OVERLAY_SETTINGS,
    DEFAULT_PULL_PANEL_POSITION,
    DEFAULT_RECENT_SKILLS_LIMIT,
    DEFAULT_RECENT_SKILLS_PANEL_POSITION,
    DEFAULT_VISIBILITY_SETTINGS,
    PULL_PANEL_POSITION_KEY,
    RECENT_SKILLS_PANEL_POSITION_KEY,
    SKILL_SELECTIONS_KEY,
    STORAGE_KEY,
    VISIBILITY_SETTINGS_KEY,
  };
})();
