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
const skillsModalTitle = document.getElementById("skillsModalTitle");
const skillsModalSubtitle = document.getElementById("skillsModalSubtitle");
const filePathEl = document.getElementById("filePath");
const watchStatusEl = document.getElementById("watchStatus");
const hudStatusEl = document.getElementById("hudStatus");
const overlayRoot = document.getElementById("overlay-root");
const skillsModal = document.getElementById("skillsModal");
const skillsCatalogEl = document.getElementById("skillsCatalog");

const STORAGE_KEY = "overlay-player-positions-v2";
const SKILL_SELECTIONS_KEY = "overlay-skill-selections-v1";
const CARD_SCALE_KEY = "overlay-card-scale-v1";
const CARD_SCALE_MIN = 0.75;
const CARD_SCALE_MAX = 1.8;
const CARD_SCALE_STEP = 0.05;
let overlayLocked = false;
let latestData = null;
const cardMap = new Map();
let cooldownTimer = null;
let hudActive = true;
let skillCatalog = { classes: [] };
let selectedSkillsByClass = loadSkillSelections();
let cardScale = loadCardScale();
let currentLanguage = "en";
let lastWatchStatusMessage = "";


const I18N = {
  ru: {
    htmlLang: 'ru',
    pickLog: 'Выбрать лог',
    reload: 'Обновить',
    lockOverlay: 'Lock overlay',
    unlockOverlay: 'Unlock overlay',
    skills: 'Skills',
    language: 'Язык',
    cardSizeTitle: 'Размер карточки',
    noFileSelected: 'Файл не выбран',
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
    chooseAbilities: 'Выберите одну или несколько способностей для каждого класса',
    skillsEmpty: 'skills.json не найден или пуст',
    unknown: 'Неизвестно',
    errorPrefix: 'Ошибка',
  },
  en: {
    htmlLang: 'en',
    pickLog: 'Select log',
    reload: 'Refresh',
    lockOverlay: 'Lock overlay',
    unlockOverlay: 'Unlock overlay',
    skills: 'Skills',
    language: 'Language',
    cardSizeTitle: 'Card size',
    noFileSelected: 'No file selected',
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
    chooseAbilities: 'Choose one or more abilities for each class',
    skillsEmpty: 'skills.json not found or empty',
    unknown: 'Unknown',
    errorPrefix: 'Error',
  },
};

function t(key) {
  return I18N[currentLanguage]?.[key] || I18N.en[key] || key;
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
  if (languageSelect) languageSelect.value = currentLanguage;
  const sizeControls = document.querySelector('.size-controls');
  if (sizeControls) sizeControls.title = t('cardSizeTitle');
  if (!filePathEl.textContent || filePathEl.textContent === I18N.en.noFileSelected || filePathEl.textContent === I18N.ru.noFileSelected) {
    filePathEl.textContent = t('noFileSelected');
  }
  watchStatusEl.textContent = lastWatchStatusMessage || t('noWatching');
  skillsModalTitle.textContent = t('trackedClassSkills');
  skillsModalSubtitle.textContent = t('chooseAbilities');
  if (!latestData?.players?.length) {
    setHudActiveState(hudActive);
  } else {
    renderPlayers(latestData.players || []);
  }
  renderSkillsModal();
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

function loadPositions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePositions(positions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

function loadSkillSelections() {
  try {
    const raw = JSON.parse(localStorage.getItem(SKILL_SELECTIONS_KEY) || "{}");
    const normalized = {};
    Object.entries(raw || {}).forEach(([classId, abilityIds]) => {
      normalized[String(Number(classId))] = (Array.isArray(abilityIds) ? abilityIds : []).map((id) => String(Number(id)));
    });
    return normalized;
  } catch {
    return {};
  }
}

function saveSkillSelections() {
  localStorage.setItem(SKILL_SELECTIONS_KEY, JSON.stringify(selectedSkillsByClass));
}

function loadCardScale() {
  const raw = Number(localStorage.getItem(CARD_SCALE_KEY) || 1);
  if (!Number.isFinite(raw)) return 1;
  return clamp(raw, CARD_SCALE_MIN, CARD_SCALE_MAX);
}

function saveCardScale() {
  localStorage.setItem(CARD_SCALE_KEY, String(cardScale));
}

function updateCardScaleUi() {
  overlayRoot.style.setProperty('--card-scale', String(cardScale));
  if (cardSizeValueEl) cardSizeValueEl.textContent = `${Math.round(cardScale * 100)}%`;
}

function setCardScale(nextScale) {
  const normalized = Math.round(clamp(nextScale, CARD_SCALE_MIN, CARD_SCALE_MAX) * 100) / 100;
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

function makeCardDraggable(card, dragHandle, _layoutKey, positions) {
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
    const layoutKey = card.dataset.layoutKey || getPlayerLayoutKey(0);
    positions[layoutKey] = { x: left, y: top };
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
    const lastActivation = activationTimestamps.length ? activationTimestamps[activationTimestamps.length - 1] : null;
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
  const history = player.spiritHistory || [];
  const last = history[history.length - 1];
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
  if (!latestData?.players?.length) return;
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
  if (!result?.canceled && result?.filePath) filePathEl.textContent = result.filePath;
});

reloadBtn.addEventListener("click", async () => {
  await window.api.reloadCurrentFile();
});

toggleLockBtn.addEventListener("click", async () => {
  await window.api.toggleOverlayLock();
});

skillsBtn.addEventListener('click', openSkillsModal);
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

window.api.onHudState((payload) => {
  setHudActiveState(payload?.active, payload?.foregroundExe || null);
});

window.api.onLogData((payload) => {
  if (!payload?.ok) {
    playersContainer.innerHTML = `<div class="panel player-card interactive floating-card" style="left:16px;top:64px;">${escapeHtml(t("errorPrefix"))}: ${escapeHtml(payload?.error || "unknown")}</div>`;
    cardMap.clear();
    return;
  }

  latestData = payload.data;
  filePathEl.textContent = payload.filePath || t("noFileSelected");
  renderPlayers(latestData.players || []);

  if (!cooldownTimer) cooldownTimer = setInterval(tickCooldowns, 1000);
});

window.api.onLanguageChanged((payload) => {
  setLanguage(payload?.language || "ru");
});

window.api.getCurrentFile().then((result) => {
  if (result?.filePath) filePathEl.textContent = result.filePath;
  else filePathEl.textContent = t("noFileSelected");
});

window.api.getLanguage().then((result) => {
  setLanguage(result?.language || "ru");
});

updateCardScaleUi();
applyTranslations();
ensureSkillCatalog();
