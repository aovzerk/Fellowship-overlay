const playersContainer = document.getElementById("playersContainer");
const settingsModal = document.getElementById("settingsModal");
const closeSettingsModalBtn = document.getElementById("closeSettingsModalBtn");
const settingsModalTitle = document.getElementById("settingsModalTitle");
const settingsModalSubtitle = document.getElementById("settingsModalSubtitle");
const logSettingsTitle = document.getElementById("logSettingsTitle");
const overlaySettingsTitle = document.getElementById("overlaySettingsTitle");
const appearanceSettingsTitle = document.getElementById("appearanceSettingsTitle");
const pickFileBtn = document.getElementById("pickFileBtn");
const reloadBtn = document.getElementById("reloadBtn");
const toggleLockBtn = document.getElementById("toggleLockBtn");
const skillsBtn = document.getElementById("skillsBtn");
const cardSizeDownBtn = document.getElementById("cardSizeDownBtn");
const cardSizeUpBtn = document.getElementById("cardSizeUpBtn");
const cardSizeValueEl = document.getElementById("cardSizeValue");
const closeSkillsModalBtn = document.getElementById("closeSkillsModalBtn");
const languageSelect = document.getElementById("languageSelect");
const languageLabel = document.getElementById("languageLabel");
const showPartyToggle = document.getElementById("showPartyToggle");
const showPullToggle = document.getElementById("showPullToggle");
const showPartyToggleLabel = document.getElementById("showPartyToggleLabel");
const showPullToggleLabel = document.getElementById("showPullToggleLabel");
const skillsModalTitle = document.getElementById("skillsModalTitle");
const skillsModalSubtitle = document.getElementById("skillsModalSubtitle");
const filePathEl = document.getElementById("filePath");
const watchStatusEl = document.getElementById("watchStatus");
const hudStatusEl = document.getElementById("hudStatus");
const overlayRoot = document.getElementById("overlay-root");
const skillsModal = document.getElementById("skillsModal");
const skillsCatalogEl = document.getElementById("skillsCatalog");
const pullInfoEl = document.getElementById("pullInfo");
const recentSkillsPanelEl = document.getElementById("recentSkillsPanel");
const showRecentSkillsToggle = document.getElementById("showRecentSkillsToggle");
const showRecentSkillsToggleLabel = document.getElementById("showRecentSkillsToggleLabel");
const recentSkillsLimitInput = document.getElementById("recentSkillsLimitInput");
const recentSkillsLimitLabel = document.getElementById("recentSkillsLimitLabel");

const STORAGE_KEY = "overlay-player-positions-v2";
const SKILL_SELECTIONS_KEY = "overlay-skill-selections-v1";
const CARD_SCALE_KEY = "overlay-card-scale-v1";
const PULL_PANEL_POSITION_KEY = "overlay-pull-panel-position-v1";
const RECENT_SKILLS_PANEL_POSITION_KEY = "overlay-recent-skills-panel-position-v1";
const VISIBILITY_SETTINGS_KEY = "overlay-visibility-settings-v2";
const CARD_SCALE_MIN = 0.75;
const CARD_SCALE_MAX = 1.8;
const CARD_SCALE_STEP = 0.05;
const DEFAULT_PULL_PANEL_POSITION = { x: 16, y: 12 };
const DEFAULT_RECENT_SKILLS_PANEL_POSITION = { x: 16, y: 200 };
const DEFAULT_VISIBILITY_SETTINGS = { showParty: true, showPull: true, showRecentSkills: true };
const DEFAULT_RECENT_SKILLS_LIMIT = 7;
const DEFAULT_CARD_SCALE = 1;
const DEFAULT_OVERLAY_SETTINGS = {
  playerPositions: {},
  panelPositions: {
    pullInfo: DEFAULT_PULL_PANEL_POSITION,
    recentSkills: DEFAULT_RECENT_SKILLS_PANEL_POSITION,
  },
  visibilitySettings: DEFAULT_VISIBILITY_SETTINGS,
  recentSkillsLimit: DEFAULT_RECENT_SKILLS_LIMIT,
  selectedSkillsByClass: {},
  cardScale: DEFAULT_CARD_SCALE,
};
let overlayLocked = false;
let latestData = null;
const cardMap = new Map();
let cooldownTimer = null;
let hudActive = true;
let skillCatalog = { classes: [] };
let overlaySettingsCache = loadOverlaySettings();
let selectedSkillsByClass = loadSkillSelections();
let cardScale = loadCardScale();
let currentLanguage = "en";
let lastWatchStatusMessage = "";
let visibilitySettings = loadVisibilitySettings();
let recentSkillsLimit = loadRecentSkillsLimit();
let playerPositionsCache = overlaySettingsCache.playerPositions;


const I18N = {
  ru: {
    htmlLang: 'ru',
    pickLog: 'Выбрать папку',
    reload: 'Обновить',
    lockOverlay: 'Lock overlay',
    unlockOverlay: 'Unlock overlay',
    skills: 'Skills',
    language: 'Язык',
    cardSizeTitle: 'Размер карточки',
    noFileSelected: 'Папка не выбрана',
    noWatching: 'Нет слежения',
    hudActive: 'HUD active',
    hudHidden: 'HUD hidden',
    spirit: 'Spirit',
    trackedClassSkills: 'Отслеживаемые способности классов',
    settings: 'Настройки',
    settingsSubtitle: 'Общие настройки оверлея',
    logSettings: 'Лог',
    overlaySettings: 'Оверлей',
    appearanceSettings: 'Внешний вид',
    showParty: 'Показывать группу и кулдауны',
    showPull: 'Показывать информацию по пулам и %',
    showRecentSkills: 'Показывать последние скиллы',
    recentSkillsLimit: 'Лимит последних скиллов',
    chooseAbilities: 'Выберите одну или несколько способностей для каждого класса',
    skillsEmpty: 'skills.json не найден или пуст',
    unknown: 'Неизвестно',
    errorPrefix: 'Ошибка',
    currentPull: 'Текущий пул',
    pullTotal: 'Всего',
    noPullData: 'Нет данных по текущему бою',
    recentSkillsTitle: 'Последние скиллы',
    noRecentSkills: 'Нет использованных скиллов',
    chickenizedInfo: 'Chickenize',
    chickenizedSuffix: 'моб(ов) = 0%',
    chickenizedAlive: 'живых',
  },
  en: {
    htmlLang: 'en',
    pickLog: 'Select folder',
    reload: 'Refresh',
    lockOverlay: 'Lock overlay',
    unlockOverlay: 'Unlock overlay',
    skills: 'Skills',
    language: 'Language',
    cardSizeTitle: 'Card size',
    noFileSelected: 'No folder selected',
    noWatching: 'Not watching',
    hudActive: 'HUD active',
    hudHidden: 'HUD hidden',
    spirit: 'Spirit',
    trackedClassSkills: 'Tracked class skills',
    settings: 'Settings',
    settingsSubtitle: 'General overlay settings',
    logSettings: 'Log',
    overlaySettings: 'Overlay',
    appearanceSettings: 'Appearance',
    showParty: 'Show party and cooldowns',
    showPull: 'Show pull and % info',
    showRecentSkills: 'Show recent skills',
    recentSkillsLimit: 'Recent skills limit',
    chooseAbilities: 'Choose one or more abilities for each class',
    skillsEmpty: 'skills.json not found or empty',
    unknown: 'Unknown',
    errorPrefix: 'Error',
    currentPull: 'Current pull',
    pullTotal: 'Total',
    noPullData: 'No current pull data',
    recentSkillsTitle: 'Recent skills',
    noRecentSkills: 'No used skills yet',
    chickenizedInfo: 'Chickenize',
    chickenizedSuffix: 'mob(s) = 0%',
    chickenizedAlive: 'alive',
  },
};

function t(key) {
  return I18N[currentLanguage]?.[key] || I18N.en[key] || key;
}

function setLogSourceText(source) {
  const text = source?.filePath || source?.directoryPath || t('noFileSelected');
  filePathEl.textContent = text;
}

function applyTranslations() {
  document.documentElement.lang = t('htmlLang');
  settingsModalTitle.textContent = t('settings');
  settingsModalSubtitle.textContent = t('settingsSubtitle');
  logSettingsTitle.textContent = t('logSettings');
  overlaySettingsTitle.textContent = t('overlaySettings');
  appearanceSettingsTitle.textContent = t('appearanceSettings');
  pickFileBtn.textContent = t('pickLog');
  reloadBtn.textContent = t('reload');
  toggleLockBtn.textContent = overlayLocked ? t('unlockOverlay') : t('lockOverlay');
  skillsBtn.textContent = t('skills');
  languageLabel.textContent = t('language');
  if (showPartyToggleLabel) showPartyToggleLabel.textContent = t('showParty');
  if (showPullToggleLabel) showPullToggleLabel.textContent = t('showPull');
  if (showRecentSkillsToggleLabel) showRecentSkillsToggleLabel.textContent = t('showRecentSkills');
  if (recentSkillsLimitLabel) recentSkillsLimitLabel.textContent = t('recentSkillsLimit');
  if (showPartyToggle) showPartyToggle.checked = !!visibilitySettings.showParty;
  if (showPullToggle) showPullToggle.checked = !!visibilitySettings.showPull;
  if (showRecentSkillsToggle) showRecentSkillsToggle.checked = !!visibilitySettings.showRecentSkills;
  if (recentSkillsLimitInput) recentSkillsLimitInput.value = String(recentSkillsLimit);
  if (languageSelect) languageSelect.value = currentLanguage;
  const sizeControls = document.querySelector('.size-controls');
  if (sizeControls) sizeControls.title = t('cardSizeTitle');
  if (!filePathEl.textContent || filePathEl.textContent === I18N.en.noFileSelected || filePathEl.textContent === I18N.ru.noFileSelected) {
    filePathEl.textContent = t('noFileSelected');
  }
  watchStatusEl.textContent = lastWatchStatusMessage || t('noWatching');
  skillsModalTitle.textContent = t('trackedClassSkills');
  skillsModalSubtitle.textContent = t('chooseAbilities');
  updateOverlayVisibility();
  renderPullInfo(latestData?.currentPull, latestData?.dungeon);
  renderRecentSkillsPanel(latestData?.recentSkills || []);
  if (!latestData?.players?.length) {
    setHudActiveState(hudActive);
  } else {
    renderPlayers(latestData.players || []);
  }
  renderSkillsModal();
  updateRecentSkillsPanelVisibility();
}

function formatPercent(value) {
  const number = Number(value || 0);
  const locale = currentLanguage === "en" ? "en-US" : "ru-RU";
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(number);
}

function updatePullPanelVisibility() {
  if (!pullInfoEl) return;
  const hasSelectedFile = !!(latestData || (filePathEl && filePathEl.textContent && filePathEl.textContent !== t("noFileSelected")));
  const isVisible = hasSelectedFile && visibilitySettings.showPull;
  pullInfoEl.classList.toggle('hidden', !isVisible);
}

function updateRecentSkillsPanelVisibility() {
  if (!recentSkillsPanelEl) return;
  const hasSelectedFile = !!(latestData || (filePathEl && filePathEl.textContent && filePathEl.textContent !== t("noFileSelected")));
  const isVisible = hasSelectedFile && visibilitySettings.showRecentSkills;
  recentSkillsPanelEl.classList.toggle('hidden', !isVisible);
}

function getDefaultSkillIcon() {
  return 'Heroes/Default/default_skill.jpg';
}

function getAbilityCatalogEntry(classId, abilityId) {
  const normalizedClassId = String(Number(classId || 0));
  const wantedAbilityId = String(Number(abilityId || 0));
  const classEntry = (skillCatalog.classes || []).find((entry) => String(Number(entry.id || 0)) === normalizedClassId);
  if (!classEntry) return null;
  return (classEntry.abilities || []).find((ability) => String(Number(ability.id || 0)) === wantedAbilityId) || null;
}

function resolveRecentSkillIcon(entry) {
  const catalogEntry = getAbilityCatalogEntry(entry?.classId, entry?.abilityId);
  return catalogEntry?.icon || getDefaultSkillIcon();
}

function renderRecentSkillsPanel(recentSkills = []) {
  if (!recentSkillsPanelEl) return;
  const allItems = Array.isArray(recentSkills) ? recentSkills : [];
  const normalizedLimit = clamp(Number(recentSkillsLimit || 7), 1, 20);
  const items = allItems.slice(-normalizedLimit).map((entry) => ({
    ...entry,
    icon: resolveRecentSkillIcon(entry),
  }));

  if (!items.length) {
    recentSkillsPanelEl.innerHTML = `
      <div class="player-header drag-handle recent-skills-header">
        <div class="player-title-block">
          <div class="player-name">${escapeHtml(t("recentSkillsTitle"))}</div>
        </div>
      </div>
      <div class="pull-empty">${escapeHtml(t("noRecentSkills"))}</div>
    `;
    updateRecentSkillsPanelVisibility();
    return;
  }

  recentSkillsPanelEl.innerHTML = `
    <div class="player-header drag-handle recent-skills-header">
      <div class="player-title-block">
        <div class="player-name">${escapeHtml(t("recentSkillsTitle"))}</div>
      </div>
    </div>
    <div class="recent-skills-row"></div>
  `;

  const row = recentSkillsPanelEl.querySelector('.recent-skills-row');
  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const chip = document.createElement('div');
    chip.className = 'relic-chip recent-skill-chip';
    chip.dataset.key = `${item.playerId || 'player'}-${item.abilityId || 'skill'}-${item.ts || index}`;
    chip.innerHTML = `
      <img class="relic-icon" alt="" />
    `;
    const icon = chip.querySelector('.relic-icon');
    icon.src = toAssetSrc(item.icon || getDefaultSkillIcon());
    icon.alt = escapeHtml(item.abilityName || 'Skill');
    const timeLabel = formatTimeShort(item.ts);
    chip.title = `${item.playerName || t('unknown')} — ${item.abilityName || t('unknown')}${timeLabel ? ` — ${timeLabel}` : ''}`;
    fragment.appendChild(chip);
  });
  row.appendChild(fragment);
  recentSkillsPanelEl.style.width = `${getCardWidthForIconCount(items.length)}px`;
  updateRecentSkillsPanelVisibility();
}

function renderPullInfo(currentPull, dungeon) {
  if (!pullInfoEl) return;
  const mobs = Array.isArray(currentPull?.mobs) ? currentPull.mobs : [];
  const alivePercent = Number(currentPull?.alivePercent || 0);
  const completedPercent = Number(dungeon?.completedPercent || 0);
  const projectedTotalPercent = completedPercent + alivePercent;
  const chickenizedCount = Number(currentPull?.chickenizedCount || 0);
  const chickenizedOriginalPercent = Number(currentPull?.chickenizedOriginalPercent || 0);
  const aliveChickenizedCount = Number(currentPull?.aliveChickenizedCount || 0);
  const aliveChickenizedOriginalPercent = Number(currentPull?.aliveChickenizedOriginalPercent || 0);
  const dungeonTitle = String(dungeon?.name || '').trim() || t("currentPull");

  if (!mobs.length) {
    pullInfoEl.innerHTML = `
      <div class="pull-title pull-drag-handle">${escapeHtml(dungeonTitle)}</div>
      <div class="pull-empty">${escapeHtml(t("noPullData"))}</div>
    `;
    renderRecentSkillsPanel([]);
    updatePullPanelVisibility();
    updateRecentSkillsPanelVisibility();
    return;
  }

  const chickenizedLine = chickenizedCount > 0
    ? `<div class="pull-note chickenized">${escapeHtml(t("chickenizedInfo"))}: <strong>${escapeHtml(String(chickenizedCount))}</strong> ${escapeHtml(t("chickenizedSuffix"))} <span>(-${escapeHtml(formatPercent(chickenizedOriginalPercent))}%${aliveChickenizedCount > 0 ? `, ${escapeHtml(t("chickenizedAlive"))}: ${escapeHtml(String(aliveChickenizedCount))} / -${escapeHtml(formatPercent(aliveChickenizedOriginalPercent))}%` : ''})</span></div>`
    : '';

  pullInfoEl.innerHTML = `
    <div class="pull-title pull-drag-handle">${escapeHtml(dungeonTitle)}</div>
    <div class="pull-stats">
      <div class="pull-stat"><span>${escapeHtml(t("pullTotal"))}</span><strong>${escapeHtml(formatPercent(projectedTotalPercent))}% (+${escapeHtml(formatPercent(alivePercent))}%)</strong></div>
    </div>
    ${chickenizedLine}
  `;
  updatePullPanelVisibility();
}

function setLanguage(language) {
  currentLanguage = String(language || '').toLowerCase() === 'en' ? 'en' : 'ru';
  applyTranslations();
}

function formatNumber(value) {
  const locale = currentLanguage === "en" ? "en-US" : "ru-RU";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDurationMs(ms) {
  const totalSeconds = Math.max(0, Math.ceil((ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatTimeShort(ts) {
  const date = new Date(ts);
  if (!Number.isFinite(date.getTime())) return '';
  const locale = currentLanguage === 'en' ? 'en-US' : 'ru-RU';
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}


function toAssetSrc(relPath) {
  const normalized = String(relPath || 'icons_trink/empty.png').replace(/^\.\//, '').replace(/^\/+/, '');
  return `../../${escapeHtml(normalized)}`;
}

function getPlayerLayoutKey(slotIndex = 0) {
  return `party-slot:${slotIndex}`;
}

function getPartySlotIndex(player, index = 0) {
  const partyIds = latestData?.partyPlayerIds || [];
  const byPartyOrder = Array.isArray(partyIds) ? partyIds.indexOf(player?.id) : -1;
  if (byPartyOrder >= 0) return byPartyOrder;
  return index;
}

function normalizePosition(value, fallback = { x: 0, y: 0 }) {
  const x = Number(value?.x);
  const y = Number(value?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { x: Math.round(Number(fallback?.x || 0)), y: Math.round(Number(fallback?.y || 0)) };
  }
  return { x: Math.round(x), y: Math.round(y) };
}

function normalizePlayerPositions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized = {};
  Object.entries(value).forEach(([key, position]) => {
    const x = Number(position?.x);
    const y = Number(position?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    normalized[String(key)] = { x: Math.round(x), y: Math.round(y) };
  });
  return normalized;
}

function normalizePanelPositions(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    pullInfo: normalizePosition(source.pullInfo, DEFAULT_PULL_PANEL_POSITION),
    recentSkills: normalizePosition(source.recentSkills, DEFAULT_RECENT_SKILLS_PANEL_POSITION),
  };
}

function normalizeVisibilitySettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    showParty: source.showParty !== false,
    showPull: source.showPull !== false,
    showRecentSkills: source.showRecentSkills !== false,
  };
}

function normalizeRecentSkillsLimit(value) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return DEFAULT_RECENT_SKILLS_LIMIT;
  return Math.round(clamp(normalized, 1, 20));
}

function normalizeSkillSelections(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized = {};
  Object.entries(value).forEach(([classId, abilityIds]) => {
    const parsedClassId = String(Number(classId));
    if (!parsedClassId || parsedClassId === 'NaN') return;
    normalized[parsedClassId] = (Array.isArray(abilityIds) ? abilityIds : [])
      .map((id) => String(Number(id)))
      .filter((id) => id && id !== 'NaN');
  });
  return normalized;
}

function normalizeCardScaleValue(value) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return DEFAULT_CARD_SCALE;
  return Math.round(clamp(normalized, CARD_SCALE_MIN, CARD_SCALE_MAX) * 100) / 100;
}

function normalizeOverlaySettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    playerPositions: normalizePlayerPositions(source.playerPositions),
    panelPositions: normalizePanelPositions(source.panelPositions),
    visibilitySettings: normalizeVisibilitySettings(source.visibilitySettings),
    recentSkillsLimit: normalizeRecentSkillsLimit(source.recentSkillsLimit),
    selectedSkillsByClass: normalizeSkillSelections(source.selectedSkillsByClass),
    cardScale: normalizeCardScaleValue(source.cardScale),
  };
}

function mergeOverlaySettings(baseSettings, partialSettings) {
  const base = normalizeOverlaySettings(baseSettings);
  const partial = partialSettings && typeof partialSettings === 'object' && !Array.isArray(partialSettings) ? partialSettings : {};
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

function getLocalStorageJson(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

function loadLegacySettingsFromLocalStorage() {
  const legacySettings = {};

  const playerPositions = normalizePlayerPositions(getLocalStorageJson(STORAGE_KEY, {}));
  if (Object.keys(playerPositions).length) legacySettings.playerPositions = playerPositions;

  const visibilityRaw = getLocalStorageJson(VISIBILITY_SETTINGS_KEY, {});
  if (visibilityRaw && typeof visibilityRaw === 'object' && !Array.isArray(visibilityRaw)) {
    legacySettings.visibilitySettings = normalizeVisibilitySettings(visibilityRaw);
    if (visibilityRaw.recentSkillsLimit !== undefined) {
      legacySettings.recentSkillsLimit = normalizeRecentSkillsLimit(visibilityRaw.recentSkillsLimit);
    }
  }

  const pullPosition = getLocalStorageJson(PULL_PANEL_POSITION_KEY, null);
  const recentSkillsPosition = getLocalStorageJson(RECENT_SKILLS_PANEL_POSITION_KEY, null);
  if (pullPosition || recentSkillsPosition) {
    legacySettings.panelPositions = {
      pullInfo: normalizePosition(pullPosition, DEFAULT_PULL_PANEL_POSITION),
      recentSkills: normalizePosition(recentSkillsPosition, DEFAULT_RECENT_SKILLS_PANEL_POSITION),
    };
  }

  const selectedSkillsByClass = normalizeSkillSelections(getLocalStorageJson(SKILL_SELECTIONS_KEY, {}));
  if (Object.keys(selectedSkillsByClass).length) legacySettings.selectedSkillsByClass = selectedSkillsByClass;

  const cardScaleRaw = Number(localStorage.getItem(CARD_SCALE_KEY));
  if (Number.isFinite(cardScaleRaw)) {
    legacySettings.cardScale = normalizeCardScaleValue(cardScaleRaw);
  }

  return legacySettings;
}

function clearLegacyLocalStorage() {
  [
    STORAGE_KEY,
    SKILL_SELECTIONS_KEY,
    CARD_SCALE_KEY,
    PULL_PANEL_POSITION_KEY,
    RECENT_SKILLS_PANEL_POSITION_KEY,
    VISIBILITY_SETTINGS_KEY,
  ].forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  });
}

function loadOverlaySettings() {
  let persistedSettings = DEFAULT_OVERLAY_SETTINGS;
  try {
    const response = window.api?.getOverlaySettingsSync?.();
    persistedSettings = normalizeOverlaySettings(response?.settings || DEFAULT_OVERLAY_SETTINGS);
  } catch {
    persistedSettings = normalizeOverlaySettings(DEFAULT_OVERLAY_SETTINGS);
  }

  const legacySettings = loadLegacySettingsFromLocalStorage();
  const hasLegacySettings = Object.keys(legacySettings).length > 0;
  if (!hasLegacySettings) {
    return persistedSettings;
  }

  const mergedSettings = mergeOverlaySettings(persistedSettings, legacySettings);
  if (JSON.stringify(mergedSettings) !== JSON.stringify(persistedSettings)) {
    window.api?.saveOverlaySettings?.(mergedSettings).catch(() => {});
  }
  clearLegacyLocalStorage();
  return mergedSettings;
}

function getOverlaySettings() {
  overlaySettingsCache = mergeOverlaySettings(DEFAULT_OVERLAY_SETTINGS, overlaySettingsCache || {});
  return overlaySettingsCache;
}

function saveOverlaySettingsPatch(patch) {
  overlaySettingsCache = mergeOverlaySettings(getOverlaySettings(), patch);
  window.api?.saveOverlaySettings?.(patch).catch(() => {});
  return overlaySettingsCache;
}

function loadPositions() {
  if (playerPositionsCache && typeof playerPositionsCache === 'object') {
    return playerPositionsCache;
  }
  playerPositionsCache = normalizePlayerPositions(getOverlaySettings().playerPositions);
  return playerPositionsCache;
}

function savePositions(positions) {
  const normalized = normalizePlayerPositions(positions);
  playerPositionsCache = normalized;
  saveOverlaySettingsPatch({ playerPositions: normalized });
}

function loadPullPanelPosition() {
  return normalizePosition(getOverlaySettings().panelPositions?.pullInfo, DEFAULT_PULL_PANEL_POSITION);
}

function savePullPanelPosition(position) {
  saveOverlaySettingsPatch({
    panelPositions: {
      pullInfo: normalizePosition(position, DEFAULT_PULL_PANEL_POSITION),
    },
  });
}

function loadRecentSkillsPanelPosition() {
  return normalizePosition(getOverlaySettings().panelPositions?.recentSkills, DEFAULT_RECENT_SKILLS_PANEL_POSITION);
}

function saveRecentSkillsPanelPosition(position) {
  saveOverlaySettingsPatch({
    panelPositions: {
      recentSkills: normalizePosition(position, DEFAULT_RECENT_SKILLS_PANEL_POSITION),
    },
  });
}

function loadVisibilitySettings() {
  return normalizeVisibilitySettings(getOverlaySettings().visibilitySettings);
}

function saveVisibilitySettings() {
  saveOverlaySettingsPatch({
    visibilitySettings: normalizeVisibilitySettings(visibilitySettings),
  });
}

function updateOverlayVisibility() {
  overlayRoot.classList.toggle('party-hidden', !visibilitySettings.showParty);
  overlayRoot.classList.toggle('pull-hidden', !visibilitySettings.showPull);
  overlayRoot.classList.toggle('recent-skills-hidden', !visibilitySettings.showRecentSkills);
}

function setPartyVisibility(enabled) {
  visibilitySettings = { ...visibilitySettings, showParty: !!enabled };
  saveVisibilitySettings();
  updateOverlayVisibility();
}

function setPullVisibility(enabled) {
  visibilitySettings = { ...visibilitySettings, showPull: !!enabled };
  saveVisibilitySettings();
  updateOverlayVisibility();
  updatePullPanelVisibility();
}

function setRecentSkillsVisibility(enabled) {
  visibilitySettings = { ...visibilitySettings, showRecentSkills: !!enabled };
  saveVisibilitySettings();
  updateOverlayVisibility();
  updateRecentSkillsPanelVisibility();
}

function loadRecentSkillsLimit() {
  return normalizeRecentSkillsLimit(getOverlaySettings().recentSkillsLimit);
}

function setRecentSkillsLimit(value) {
  recentSkillsLimit = normalizeRecentSkillsLimit(value);
  if (recentSkillsLimitInput) recentSkillsLimitInput.value = String(recentSkillsLimit);
  saveOverlaySettingsPatch({ recentSkillsLimit });
  renderRecentSkillsPanel(latestData?.recentSkills || []);
}

function loadSkillSelections() {
  return normalizeSkillSelections(getOverlaySettings().selectedSkillsByClass);
}

function saveSkillSelections() {
  saveOverlaySettingsPatch({ selectedSkillsByClass: normalizeSkillSelections(selectedSkillsByClass) });
}

function loadCardScale() {
  return normalizeCardScaleValue(getOverlaySettings().cardScale);
}

function saveCardScale() {
  saveOverlaySettingsPatch({ cardScale });
}

function updateCardScaleUi() {
  overlayRoot.style.setProperty('--card-scale', String(cardScale));
  if (cardSizeValueEl) cardSizeValueEl.textContent = `${Math.round(cardScale * 100)}%`;
}

function setCardScale(nextScale) {
  const normalized = normalizeCardScaleValue(nextScale);
  if (normalized === cardScale) return;
  cardScale = normalized;
  saveCardScale();
  updateCardScaleUi();
  if (latestData?.players) renderPlayers(latestData.players);
}

function getDefaultPosition(index) {
  return { x: 16, y: 64 + index * 122 };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setHudActiveState(active, foregroundExe = null) {
  hudActive = !!active;
  overlayRoot.classList.toggle('hud-hidden', !hudActive);
  const suffix = foregroundExe ? ` (${foregroundExe})` : '';
  hudStatusEl.textContent = hudActive ? t('hudActive') : `${t('hudHidden')}${suffix}`;
}

function getScaledMetrics() {
  const scale = Number(cardScale || 1);
  const iconSize = Math.round(60 * scale);
  const iconGap = Math.max(6, Math.round(8 * scale));
  const horizontalPadding = Math.round(20 * scale);
  const baseMinWidth = Math.round(180 * scale);
  return { scale, iconSize, iconGap, horizontalPadding, baseMinWidth };
}

function getCardWidthForIconCount(iconCount) {
  const { iconSize, iconGap, horizontalPadding, baseMinWidth } = getScaledMetrics();
  if (!iconCount) return baseMinWidth;
  return Math.max(baseMinWidth, horizontalPadding + (iconCount * iconSize) + (Math.max(0, iconCount - 1) * iconGap));
}

function applyCardLayout(card, iconCount = 0) {
  card.style.width = `${getCardWidthForIconCount(iconCount)}px`;
}

function makeCardDraggable(card, dragHandle, layoutKey, positions) {
  let dragging = false;
  let startMouseX = 0;
  let startMouseY = 0;
  let startLeft = 0;
  let startTop = 0;

  function onMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startMouseX;
    const dy = e.clientY - startMouseY;
    const maxX = Math.max(0, window.innerWidth - card.offsetWidth - 6);
    const maxY = Math.max(0, window.innerHeight - card.offsetHeight - 6);
    const left = clamp(startLeft + dx, 0, maxX);
    const top = clamp(startTop + dy, 0, maxY);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    const resolvedLayoutKey = layoutKey || card.dataset.layoutKey || getPlayerLayoutKey(0);
    if (positions && typeof positions === 'object') positions[resolvedLayoutKey] = { x: left, y: top };
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    savePositions(positions);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  }

  dragHandle.addEventListener("mousedown", (e) => {
    if (!overlayLocked) return;
    dragging = true;
    startMouseX = e.clientX;
    startMouseY = e.clientY;
    startLeft = parseFloat(card.style.left || "0");
    startTop = parseFloat(card.style.top || "0");
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    e.preventDefault();
    e.stopPropagation();
  });
}


function makePanelDraggable(panel, getDragHandle, savePosition = null) {
  let dragging = false;
  let startMouseX = 0;
  let startMouseY = 0;
  let startLeft = 0;
  let startTop = 0;

  function onMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startMouseX;
    const dy = e.clientY - startMouseY;
    const maxX = Math.max(0, window.innerWidth - panel.offsetWidth - 6);
    const maxY = Math.max(0, window.innerHeight - panel.offsetHeight - 6);
    const left = clamp(startLeft + dx, 0, maxX);
    const top = clamp(startTop + dy, 0, maxY);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    const position = {
      x: parseFloat(panel.style.left || '16'),
      y: parseFloat(panel.style.top || '12'),
    };
    if (typeof savePosition === 'function') savePosition(position);
    else savePullPanelPosition(position);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  }

  panel.addEventListener('mousedown', (e) => {
    const dragHandle = getDragHandle();
    if (!dragHandle || !dragHandle.contains(e.target)) return;
    if (!overlayLocked) return;
    dragging = true;
    startMouseX = e.clientX;
    startMouseY = e.clientY;
    startLeft = parseFloat(panel.style.left || '0');
    startTop = parseFloat(panel.style.top || '0');
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
    e.stopPropagation();
  });
}

function initializePullPanel() {
  if (!pullInfoEl) return;
  const pos = loadPullPanelPosition();
  pullInfoEl.style.left = `${pos.x}px`;
  pullInfoEl.style.top = `${pos.y}px`;
  pullInfoEl.classList.add('interactive');
  pullInfoEl.classList.add('hidden');
  makePanelDraggable(pullInfoEl, () => pullInfoEl.querySelector('.pull-drag-handle'), savePullPanelPosition);
}

function initializeRecentSkillsPanel() {
  if (!recentSkillsPanelEl) return;
  const pos = loadRecentSkillsPanelPosition();
  recentSkillsPanelEl.style.left = `${pos.x}px`;
  recentSkillsPanelEl.style.top = `${pos.y}px`;
  recentSkillsPanelEl.classList.add('interactive');
  recentSkillsPanelEl.classList.add('hidden');
  makePanelDraggable(recentSkillsPanelEl, () => recentSkillsPanelEl.querySelector('.drag-handle'), saveRecentSkillsPanelPosition);
}

function createCard(player, slotIndex, positions) {
  const layoutKey = getPlayerLayoutKey(slotIndex);
  const pos = positions[layoutKey] || getDefaultPosition(slotIndex);
  const card = document.createElement("div");
  card.className = "panel player-card interactive floating-card";
  card.dataset.playerId = player.id || '';
  card.dataset.layoutKey = layoutKey;
  card.style.left = `${pos.x}px`;
  card.style.top = `${pos.y}px`;
  card.innerHTML = `
    <div class="player-header drag-handle">
      <div class="player-title-block">
        <div class="player-name"></div>
        <div class="player-class"></div>
      </div>
    </div>
    <div class="player-info-row">
      <div class="spirit-inline">
        <span class="spirit-label">${escapeHtml(t("spirit"))}</span>
        <span class="spirit-total">-</span>
      </div>
      <div class="relics-block"></div>
    </div>
  `;
  applyCardLayout(card, 0);
  makeCardDraggable(card, card.querySelector('.drag-handle'), layoutKey, positions);
  playersContainer.appendChild(card);
  cardMap.set(player.id, card);
  return card;
}

function updateIconNodes(container, items) {
  const existing = new Map([...container.children].map((node) => [node.dataset.key, node]));
  const fragment = document.createDocumentFragment();

  for (const item of items) {
    const key = String(item.key || item.id);
    let row = existing.get(key);
    if (!row) {
      row = document.createElement('div');
      row.className = 'relic-chip';
      row.dataset.key = key;
      row.innerHTML = `
        <img class="relic-icon" alt="" />
        <div class="relic-cooldown-mask"></div>
        <div class="relic-cooldown-hand"></div>
        <div class="relic-timer"></div>
      `;
    }
    row.classList.toggle('ready', item.isReady);
    row.classList.toggle('cooldown', !item.isReady);

    const icon = row.querySelector('.relic-icon');
    icon.src = toAssetSrc(item.icon || 'icons_trink/empty.png');
    icon.alt = escapeHtml(item.name);
    row.title = item.name || '';

    const baseCooldownMs = Math.max(0, Number(item.effectiveCooldown || item.cooldown || item.baseCooldown || 0) * 1000);
    const remainingMs = Math.max(0, Number(item.cooldownRemainingMs || 0));
    const progress = item.isReady || !baseCooldownMs ? 1 : Math.max(0, Math.min(1, 1 - (remainingMs / baseCooldownMs)));
    const angle = progress * 360;

    row.style.setProperty('--cooldown-progress', `${angle}deg`);
    row.querySelector('.relic-timer').textContent = item.isReady ? '' : formatDurationMs(remainingMs);

    fragment.appendChild(row);
    existing.delete(key);
  }

  container.innerHTML = '';
  container.appendChild(fragment);
}

function getSpiritHighlight(player, spiritSnapshot) {
  const currentSpirit = Number(spiritSnapshot?.current || 0);
  const blueStone = Number(player?.stones?.blue || 0);

  if (blueStone >= 2640 && currentSpirit >= 85) return 'spirit-glow-blue';
  if (blueStone >= 960 && blueStone < 2640 && currentSpirit >= 95) return 'spirit-glow-blue';
  if (blueStone < 960 && currentSpirit >= 100) return 'spirit-glow-blue';
  return '';
}

function getSelectedSkillEntriesForClass(classId) {
  const normalizedClassId = String(Number(classId || 0));
  const selectedAbilityIds = selectedSkillsByClass[normalizedClassId] || [];
  if (!selectedAbilityIds.length) return [];
  const classEntry = (skillCatalog.classes || []).find((entry) => String(entry.id) === normalizedClassId);
  if (!classEntry) return [];
  const wanted = new Set(selectedAbilityIds.map((id) => String(Number(id))));
  return (classEntry.abilities || []).filter((ability) => wanted.has(String(ability.id)));
}

function getSkillCooldownModifier(player) {
  const greenStone = Number(player?.stones?.green || 0);
  if (greenStone >= 2640) return 0.88;
  if (greenStone >= 960) return 0.96;
  return 1;
}

function buildTrackedSkillCooldowns(player) {
  const selectedSkills = getSelectedSkillEntriesForClass(player.classId);
  if (!selectedSkills.length) return [];

  const abilityMap = new Map((player.abilities || []).map((ability) => [String(Number(ability.id)), ability]));
  const now = Date.now();
  const cooldownModifier = getSkillCooldownModifier(player);

  return selectedSkills.map((skill) => {
    const ability = abilityMap.get(String(skill.id));
    const activationTimestamps = Array.isArray(ability?.activationTimestamps) ? ability.activationTimestamps : [];
    const lastActivation = ability?.lastActivationTs || (activationTimestamps.length ? activationTimestamps[activationTimestamps.length - 1] : null);
    const lastUsedMs = lastActivation ? Date.parse(lastActivation) : NaN;
    const adjustedCooldownSeconds = Number(skill.cooldown || 0) * cooldownModifier;
    const cooldownEndsAt = Number.isFinite(lastUsedMs) ? lastUsedMs + adjustedCooldownSeconds * 1000 : null;
    const cooldownRemainingMs = cooldownEndsAt ? Math.max(0, cooldownEndsAt - now) : 0;

    return {
      key: `skill-${player.classId}-${skill.id}`,
      id: skill.id,
      name: skill.name,
      icon: skill.icon,
      baseCooldown: adjustedCooldownSeconds,
      originalCooldown: Number(skill.cooldown || 0),
      cooldownRemainingMs,
      isReady: cooldownRemainingMs <= 0,
    };
  }).sort((a, b) => {
    if (a.isReady !== b.isReady) return a.isReady ? 1 : -1;
    return a.id - b.id;
  });
}

function updateCard(card, player) {
  const history = Array.isArray(player.spiritHistory) ? player.spiritHistory : [];
  const last = player.spirit || history[history.length - 1] || null;
  const classColor = player.classColor || '#6b7280';
  const trackedSkills = buildTrackedSkillCooldowns(player);
  const displayIcons = [...trackedSkills, ...(player.relics || []).map((relic) => ({ ...relic, key: `relic-${relic.id}` }))];
  applyCardLayout(card, displayIcons.length);

  card.dataset.playerId = player.id || '';
  card.querySelector('.player-name').textContent = player.name || t('unknown');
  card.querySelector('.player-class').textContent = player.className || t('unknown');
  card.querySelector('.player-class').style.color = classColor;
  const spiritEl = card.querySelector('.spirit-total');
  spiritEl.textContent = last ? `${formatNumber(last.current)} / ${formatNumber(last.max)}` : '-';
  spiritEl.classList.remove('spirit-glow-blue');
  const spiritHighlightClass = getSpiritHighlight(player, last);
  if (spiritHighlightClass) spiritEl.classList.add(spiritHighlightClass);
  updateIconNodes(card.querySelector('.relics-block'), displayIcons);
}

function renderPlayers(players = []) {
  const positions = loadPositions();
  const activeIds = new Set(players.map((player) => player.id));

  for (const [playerId, card] of cardMap.entries()) {
    if (!activeIds.has(playerId)) {
      card.remove();
      cardMap.delete(playerId);
    }
  }

  renderPullInfo(latestData?.currentPull, latestData?.dungeon);
  renderRecentSkillsPanel(latestData?.recentSkills || []);

  players.forEach((player, index) => {
    const slotIndex = getPartySlotIndex(player, index);
    const layoutKey = getPlayerLayoutKey(slotIndex);
    let card = cardMap.get(player.id);

    if (!card) {
      card = createCard(player, slotIndex, positions);
    }

    if (card.dataset.layoutKey !== layoutKey) {
      const previousLayoutKey = card.dataset.layoutKey;
      const currentLeft = parseFloat(card.style.left || '0');
      const currentTop = parseFloat(card.style.top || '0');
      if (previousLayoutKey && !positions[layoutKey] && Number.isFinite(currentLeft) && Number.isFinite(currentTop)) {
        positions[layoutKey] = { x: currentLeft, y: currentTop };
        savePositions(positions);
      }

      card.dataset.layoutKey = layoutKey;
      const savedPos = positions[layoutKey] || getDefaultPosition(slotIndex);
      card.style.left = `${savedPos.x}px`;
      card.style.top = `${savedPos.y}px`;
    }

    updateCard(card, player);
  });
}

function tickCooldowns() {
  if (!latestData?.players?.length) {
    renderPullInfo(latestData?.currentPull, latestData?.dungeon);
    renderRecentSkillsPanel(latestData?.recentSkills || []);
    return;
  }
  const now = Date.now();
  latestData.players.forEach((player) => {
    const card = cardMap.get(player.id);
    if (!card) return;
    (player.relics || []).forEach((relic) => {
      if (!relic.cooldownEndsAt) return;
      const endMs = Date.parse(relic.cooldownEndsAt);
      relic.cooldownRemainingMs = Number.isFinite(endMs) ? Math.max(0, endMs - now) : 0;
      relic.isReady = relic.cooldownRemainingMs <= 0;
    });
    updateCard(card, player);
  });
}

function buildAbilityOption(classId, ability, selected) {
  const checked = selected ? 'checked' : '';
  return `
    <label class="skill-option">
      <input type="checkbox" data-class-id="${classId}" data-ability-id="${ability.id}" ${checked} />
      <img class="skill-option-icon" src="${toAssetSrc(ability.icon || 'icons_trink/empty.png')}" alt="${escapeHtml(ability.name)}" />
      <span class="skill-option-text">
        <span class="skill-option-name">${escapeHtml(ability.name)}</span>
        <span class="skill-option-cooldown">${escapeHtml(ability.cooldown)}s</span>
      </span>
    </label>
  `;
}

function renderSkillsModal() {
  const classes = skillCatalog.classes || [];
  if (!classes.length) {
    skillsCatalogEl.innerHTML = `<div class="empty-state">${escapeHtml(t('skillsEmpty'))}</div>`;
    return;
  }

  skillsCatalogEl.innerHTML = classes.map((heroClass) => {
    const selected = new Set((selectedSkillsByClass[String(heroClass.id)] || []).map((id) => String(Number(id))));
    const options = (heroClass.abilities || []).map((ability) => buildAbilityOption(heroClass.id, ability, selected.has(String(ability.id)))).join('');
    return `
      <section class="skill-class-group">
        <div class="skill-class-title">${escapeHtml(heroClass.name)}</div>
        <div class="skill-options-grid">${options}</div>
      </section>
    `;
  }).join('');

  skillsCatalogEl.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const input = event.currentTarget;
      const classId = String(Number(input.dataset.classId || 0));
      const abilityId = String(Number(input.dataset.abilityId || 0));
      const current = new Set(selectedSkillsByClass[classId] || []);
      if (input.checked) current.add(abilityId);
      else current.delete(abilityId);
      selectedSkillsByClass[classId] = [...current];
      saveSkillSelections();
      if (latestData?.players) renderPlayers(latestData.players);
    });
  });
}

function openSettingsModal() {
  updateCardScaleUi();
  settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
  settingsModal.classList.add('hidden');
}

async function ensureSkillCatalog() {
  if (skillCatalog.classes?.length) return;
  skillCatalog = await window.api.getSkillCatalog();
  renderSkillsModal();
  updateRecentSkillsPanelVisibility();
}

function openSkillsModal() {
  updateCardScaleUi();
  ensureSkillCatalog();
  skillsModal.classList.remove('hidden');
}

function closeSkillsModal() {
  skillsModal.classList.add('hidden');
}

pickFileBtn.addEventListener("click", async () => {
  const result = await window.api.pickLogFile();
  if (!result?.canceled) setLogSourceText(result);
  updatePullPanelVisibility();
  updateRecentSkillsPanelVisibility();
});

reloadBtn.addEventListener("click", async () => {
  await window.api.reloadCurrentFile();
});

toggleLockBtn.addEventListener("click", async () => {
  await window.api.toggleOverlayLock();
});

skillsBtn.addEventListener('click', openSkillsModal);
showPartyToggle?.addEventListener('change', (event) => {
  setPartyVisibility(event.currentTarget.checked);
});
showPullToggle?.addEventListener('change', (event) => {
  setPullVisibility(event.currentTarget.checked);
});
showRecentSkillsToggle?.addEventListener('change', (event) => {
  setRecentSkillsVisibility(event.currentTarget.checked);
});
recentSkillsLimitInput?.addEventListener('change', (event) => {
  setRecentSkillsLimit(event.currentTarget.value);
});
recentSkillsLimitInput?.addEventListener('input', (event) => {
  const value = clamp(Number(event.currentTarget.value || 7), 1, 20);
  event.currentTarget.value = String(value);
});
cardSizeDownBtn.addEventListener('click', () => setCardScale(cardScale - CARD_SCALE_STEP));
cardSizeUpBtn.addEventListener('click', () => setCardScale(cardScale + CARD_SCALE_STEP));
closeSkillsModalBtn.addEventListener('click', closeSkillsModal);
closeSettingsModalBtn.addEventListener('click', closeSettingsModal);
languageSelect.addEventListener("change", async (event) => {
  const nextLanguage = event.currentTarget.value === "en" ? "en" : "ru";
  const result = await window.api.setLanguage(nextLanguage);
  setLanguage(result?.language || nextLanguage);
});
skillsModal.addEventListener('mousedown', (event) => {
  if (event.target === skillsModal) closeSkillsModal();
});
settingsModal.addEventListener('mousedown', (event) => {
  if (event.target === settingsModal) closeSettingsModal();
});

window.api.onWatchStatus((payload) => {
  lastWatchStatusMessage = payload?.message || t("noWatching");
  watchStatusEl.textContent = lastWatchStatusMessage;
});

window.api.onOverlayMode((payload) => {
  overlayLocked = !!payload?.locked;
  toggleLockBtn.textContent = overlayLocked ? t("unlockOverlay") : t("lockOverlay");
});

window.api.onOpenSettings(() => {
  openSettingsModal();
});


window.api.onLogData((payload) => {
  setLogSourceText(payload);

  if (!payload?.ok) {
    latestData = null;
    playersContainer.innerHTML = `<div class="panel player-card interactive floating-card" style="left:16px;top:64px;">${escapeHtml(t("errorPrefix"))}: ${escapeHtml(payload?.error || "unknown")}</div>`;
    cardMap.clear();
    renderRecentSkillsPanel([]);
    updatePullPanelVisibility();
    updateRecentSkillsPanelVisibility();
    return;
  }

  latestData = payload.data;
  renderPlayers(latestData.players || []);
  updateRecentSkillsPanelVisibility();

  if (!cooldownTimer) cooldownTimer = setInterval(tickCooldowns, 1000);
});

window.api.onLanguageChanged((payload) => {
  setLanguage(payload?.language || "ru");
});

window.api.getCurrentFile().then((result) => {
  setLogSourceText(result);
  updatePullPanelVisibility();
  updateRecentSkillsPanelVisibility();
});

window.api.getLanguage().then((result) => {
  setLanguage(result?.language || "ru");
});

updateCardScaleUi();
initializePullPanel();
initializeRecentSkillsPanel();
updateOverlayVisibility();
applyTranslations();
updatePullPanelVisibility();
updateRecentSkillsPanelVisibility();
ensureSkillCatalog();
