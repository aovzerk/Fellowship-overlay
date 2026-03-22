(() => {
function mustElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as T;
}

const playersContainer = mustElement<HTMLElement>('playersContainer');
const settingsModal = mustElement<HTMLElement>('settingsModal');
const closeSettingsModalBtn = mustElement<HTMLButtonElement>('closeSettingsModalBtn');
const settingsModalTitle = mustElement<HTMLElement>('settingsModalTitle');
const settingsModalSubtitle = mustElement<HTMLElement>('settingsModalSubtitle');
const logSettingsTitle = mustElement<HTMLElement>('logSettingsTitle');
const overlaySettingsTitle = mustElement<HTMLElement>('overlaySettingsTitle');
const appearanceSettingsTitle = mustElement<HTMLElement>('appearanceSettingsTitle');
const pickFileBtn = mustElement<HTMLButtonElement>('pickFileBtn');
const reloadBtn = mustElement<HTMLButtonElement>('reloadBtn');
const toggleLockBtn = mustElement<HTMLButtonElement>('toggleLockBtn');
const skillsBtn = mustElement<HTMLButtonElement>('skillsBtn');
const cardSizeDownBtn = mustElement<HTMLButtonElement>('cardSizeDownBtn');
const cardSizeUpBtn = mustElement<HTMLButtonElement>('cardSizeUpBtn');
const cardSizeValueEl = mustElement<HTMLElement>('cardSizeValue');
const closeSkillsModalBtn = mustElement<HTMLButtonElement>('closeSkillsModalBtn');
const languageSelect = mustElement<HTMLSelectElement>('languageSelect');
const languageLabel = mustElement<HTMLElement>('languageLabel');
const showPartyToggle = document.getElementById('showPartyToggle') as HTMLInputElement | null;
const showPullToggle = document.getElementById('showPullToggle') as HTMLInputElement | null;
const showPartyToggleLabel = document.getElementById('showPartyToggleLabel') as HTMLElement | null;
const showPullToggleLabel = document.getElementById('showPullToggleLabel') as HTMLElement | null;
const skillsModalTitle = mustElement<HTMLElement>('skillsModalTitle');
const skillsModalSubtitle = mustElement<HTMLElement>('skillsModalSubtitle');
const filePathEl = mustElement<HTMLElement>('filePath');
const watchStatusEl = mustElement<HTMLElement>('watchStatus');
const hudStatusEl = mustElement<HTMLElement>('hudStatus');
const overlayRoot = mustElement<HTMLElement>('overlay-root');
const skillsModal = mustElement<HTMLElement>('skillsModal');
const skillsCatalogEl = mustElement<HTMLElement>('skillsCatalog');
const pullInfoEl = mustElement<HTMLElement>('pullInfo');
const recentSkillsPanelEl = mustElement<HTMLElement>('recentSkillsPanel');
const showRecentSkillsToggle = document.getElementById('showRecentSkillsToggle') as HTMLInputElement | null;
const showRecentSkillsToggleLabel = document.getElementById('showRecentSkillsToggleLabel') as HTMLElement | null;
const recentSkillsLimitInput = mustElement<HTMLInputElement>('recentSkillsLimitInput');
const recentSkillsLimitLabel = mustElement<HTMLElement>('recentSkillsLimitLabel');

const { CARD_SCALE_STEP } = window.OverlayRendererConstants;
const {
  applyTranslations: applyTranslationsShared,
  setLogSourceText: setLogSourceTextShared,
  t: translateText,
} = window.OverlayRendererI18n;
const {
  clamp,
  escapeHtml,
  formatNumber: formatNumberShared,
  formatPercent: formatPercentShared,
} = window.OverlayRendererFormatters;
const {
  getAbilityCatalogEntry: getAbilityCatalogEntryShared,
  renderPullInfo: renderPullInfoShared,
  renderRecentSkillsPanel: renderRecentSkillsPanelShared,
  resolveRecentSkillIcon: resolveRecentSkillIconShared,
  updatePullPanelVisibility: updatePullPanelVisibilityShared,
  updateRecentSkillsPanelVisibility: updateRecentSkillsPanelVisibilityShared,
} = window.OverlayRendererPanels;
const { createOverlaySettingsController } = window.OverlayRendererSettings;
const {
  applyCardLayout,
  getCardWidthForIconCount: getCardWidthForIconCountShared,
  getDefaultPosition,
  initializePanel,
  makeCardDraggable,
} = window.OverlayRendererLayout;
const { createPlayerCardRenderer } = window.OverlayRendererPlayerCards;
const { renderSkillsModal: renderSkillsModalShared } = window.OverlayRendererSkillsModal;

const settingsController: OverlaySettingsController = createOverlaySettingsController(window.api);

let overlayLocked = false;
let latestData: FinalizedState | null = null;
const cardMap = new Map<string, HTMLElement>();
let cooldownTimer: ReturnType<typeof setInterval> | null = null;
let hudActive = true;
let skillCatalog: SkillCatalog = { classes: [] };
let selectedSkillsByClass: SkillSelectionMap = settingsController.loadSkillSelections();
let cardScale = settingsController.loadCardScale();
let currentLanguage: LanguageCode = 'en';
let lastWatchStatusMessage = '';
let visibilitySettings: OverlayVisibilitySettings = settingsController.loadVisibilitySettings();
let recentSkillsLimit = settingsController.loadRecentSkillsLimit();
let playerCardRenderer: PlayerCardRenderer | null = null;
let settingsModalOpen = false;

function t(key: string): string {
  return translateText(currentLanguage, key);
}

function setLogSourceText(source: { filePath?: string | null; directoryPath?: string | null } | null | undefined): void {
  setLogSourceTextShared(filePathEl, t, source);
}

function formatPercent(value: unknown): string {
  return formatPercentShared(currentLanguage, value);
}

function formatNumber(value: unknown): string {
  return formatNumberShared(currentLanguage, value);
}

function getPlayerLayoutKey(slotIndex = 0): string {
  return `party-slot:${slotIndex}`;
}

function getPartySlotIndex(player: { id: string } | null | undefined, index = 0): number {
  const partyIds = latestData?.partyPlayerIds || [];
  const byPartyOrder = Array.isArray(partyIds) ? partyIds.indexOf(player?.id || '') : -1;
  if (byPartyOrder >= 0) return byPartyOrder;
  return index;
}

function getCardWidthForIconCount(iconCount: number): number {
  return getCardWidthForIconCountShared(cardScale, iconCount);
}

function setLanguage(language: LanguageCode | string | null | undefined): void {
  currentLanguage = String(language || '').toLowerCase() === 'en' ? 'en' : 'ru';
  applyTranslations();
}

function updatePullPanelVisibility(): void {
  updatePullPanelVisibilityShared({ filePathEl, latestData, pullInfoEl, translate: t, visibilitySettings });
}

function updateRecentSkillsPanelVisibility(): void {
  updateRecentSkillsPanelVisibilityShared({ filePathEl, latestData, recentSkillsPanelEl, translate: t, visibilitySettings });
}

function getAbilityCatalogEntry(classId: number | null, abilityId: number | null) {
  return getAbilityCatalogEntryShared(skillCatalog, classId, abilityId);
}

function resolveRecentSkillIcon(entry: RecentSkillActivation | null | undefined): string {
  return resolveRecentSkillIconShared(skillCatalog, entry);
}

function renderRecentSkillsPanel(recentSkills: RecentSkillActivation[] = []): void {
  renderRecentSkillsPanelShared({
    currentLanguage,
    getCardWidthForIconCount,
    recentSkills,
    recentSkillsLimit,
    recentSkillsPanelEl,
    skillCatalog,
    translate: t,
    updateRecentSkillsPanelVisibility,
  });
}

function renderPullInfo(currentPull: CurrentPullSummary | null | undefined, dungeon: FinalizedDungeonState | null | undefined): void {
  renderPullInfoShared({
    currentLanguage,
    currentPull,
    dungeon,
    pullInfoEl,
    renderRecentSkillsPanelEmpty: () => renderRecentSkillsPanel([]),
    translate: t,
    updatePullPanelVisibility,
    updateRecentSkillsPanelVisibility,
  });
}

function loadPositions(): PlayerPositions {
  return settingsController.loadPositions();
}

function savePositions(positions: PlayerPositions): void {
  settingsController.savePositions(positions);
}

function loadPullPanelPosition(): Point {
  return settingsController.loadPullPanelPosition();
}

function savePullPanelPosition(position: Point): void {
  settingsController.savePullPanelPosition(position);
}

function loadRecentSkillsPanelPosition(): Point {
  return settingsController.loadRecentSkillsPanelPosition();
}

function saveRecentSkillsPanelPosition(position: Point): void {
  settingsController.saveRecentSkillsPanelPosition(position);
}

function saveVisibilitySettings(): void {
  settingsController.saveVisibilitySettings(visibilitySettings);
}

function updateOverlayVisibility(): void {
  overlayRoot.classList.toggle('party-hidden', !visibilitySettings.showParty);
  overlayRoot.classList.toggle('pull-hidden', !visibilitySettings.showPull);
  overlayRoot.classList.toggle('recent-skills-hidden', !visibilitySettings.showRecentSkills);
}

function setPartyVisibility(enabled: boolean): void {
  visibilitySettings = { ...visibilitySettings, showParty: !!enabled };
  saveVisibilitySettings();
  updateOverlayVisibility();
}

function setPullVisibility(enabled: boolean): void {
  visibilitySettings = { ...visibilitySettings, showPull: !!enabled };
  saveVisibilitySettings();
  updateOverlayVisibility();
  updatePullPanelVisibility();
}

function setRecentSkillsVisibility(enabled: boolean): void {
  visibilitySettings = { ...visibilitySettings, showRecentSkills: !!enabled };
  saveVisibilitySettings();
  updateOverlayVisibility();
  updateRecentSkillsPanelVisibility();
}

function saveSkillSelections(): void {
  settingsController.saveSkillSelections(selectedSkillsByClass);
}

function setRecentSkillsLimit(value: unknown): void {
  recentSkillsLimit = settingsController.normalizeRecentSkillsLimit(value);
  recentSkillsLimitInput.value = String(recentSkillsLimit);
  settingsController.saveRecentSkillsLimit(recentSkillsLimit);
  renderRecentSkillsPanel(latestData?.recentSkills || []);
}

function updateCardScaleUi(): void {
  overlayRoot.style.setProperty('--card-scale', String(cardScale));
  cardSizeValueEl.textContent = `${Math.round(cardScale * 100)}%`;
}

function setCardScale(nextScale: number): void {
  const normalized = settingsController.normalizeCardScaleValue(nextScale);
  if (normalized === cardScale) return;
  cardScale = normalized;
  settingsController.saveCardScale(cardScale);
  updateCardScaleUi();
  if (latestData?.players) renderPlayers(latestData.players);
}

function setHudActiveState(active: boolean, foregroundExe: string | null = null): void {
  hudActive = !!active;
  overlayRoot.classList.toggle('hud-hidden', !hudActive);
  const suffix = foregroundExe ? ` (${foregroundExe})` : '';
  hudStatusEl.textContent = hudActive ? t('hudActive') : `${t('hudHidden')}${suffix}`;
}

function renderPlayers(players: FinalizedState['players'] = []): void {
  playerCardRenderer?.renderPlayers(players);
}

function tickCooldowns(): void {
  playerCardRenderer?.tickCooldowns();
}

function renderSkillsModal(): void {
  renderSkillsModalShared({
    latestData: () => latestData,
    renderPlayers,
    saveSkillSelections,
    selectedSkillsByClass,
    skillCatalog,
    skillsCatalogEl,
    t,
  });
}

function applyTranslations(): void {
  applyTranslationsShared({
    appearanceSettingsTitle,
    currentLanguage,
    filePathEl,
    hudActive,
    languageLabel,
    languageSelect,
    lastWatchStatusMessage,
    latestData,
    logSettingsTitle,
    overlayLocked,
    overlaySettingsTitle,
    pickFileBtn,
    recentSkillsLimit,
    recentSkillsLimitInput,
    recentSkillsLimitLabel,
    reloadBtn,
    renderPlayers,
    renderPullInfo,
    renderRecentSkillsPanel,
    renderSkillsModal,
    setHudActiveState,
    settingsModalSubtitle,
    settingsModalTitle,
    showPartyToggle,
    showPartyToggleLabel,
    showPullToggle,
    showPullToggleLabel,
    showRecentSkillsToggle,
    showRecentSkillsToggleLabel,
    skillsBtn,
    skillsModalSubtitle,
    skillsModalTitle,
    toggleLockBtn,
    updateOverlayVisibility,
    updatePullPanelVisibility,
    updateRecentSkillsPanelVisibility,
    visibilitySettings,
    watchStatusEl,
  });
}

async function ensureSkillCatalog(): Promise<void> {
  if (skillCatalog.classes?.length) return;
  skillCatalog = await window.api.getSkillCatalog();
  renderSkillsModal();
  updateRecentSkillsPanelVisibility();
}

async function openSettingsModal(): Promise<void> {
  updateCardScaleUi();
  settingsModal.classList.remove('hidden');
  settingsModalOpen = true;
  await window.api.setSettingsModalOpen(true);
}

async function closeSettingsModal(): Promise<void> {
  settingsModal.classList.add('hidden');
  settingsModalOpen = false;
  await window.api.setSettingsModalOpen(false);
  await window.api.closeInteractiveModal();
}

function openSkillsModal(): void {
  updateCardScaleUi();
  void ensureSkillCatalog();
  skillsModal.classList.remove('hidden');
}

function closeSkillsModal(): void {
  skillsModal.classList.add('hidden');
}

playerCardRenderer = createPlayerCardRenderer({
  applyCardLayout,
  cardMap,
  formatNumber,
  getCardScale: () => cardScale,
  getDefaultPosition,
  getLatestData: () => latestData,
  getOverlayLocked: () => overlayLocked,
  getPartySlotIndex,
  getPlayerLayoutKey,
  getSelectedSkillsByClass: () => selectedSkillsByClass,
  getSkillCatalog: () => skillCatalog,
  loadPositions,
  makeCardDraggable,
  playersContainer,
  renderPullInfo,
  renderRecentSkillsPanel,
  savePositions,
  t,
});

initializePanel({
  panel: pullInfoEl,
  position: loadPullPanelPosition(),
  getDragHandle: () => pullInfoEl?.querySelector<HTMLElement>('.pull-drag-handle'),
  getOverlayLocked: () => overlayLocked,
  savePosition: savePullPanelPosition,
});

initializePanel({
  panel: recentSkillsPanelEl,
  position: loadRecentSkillsPanelPosition(),
  getDragHandle: () => recentSkillsPanelEl?.querySelector<HTMLElement>('.drag-handle'),
  getOverlayLocked: () => overlayLocked,
  savePosition: saveRecentSkillsPanelPosition,
});

pickFileBtn.addEventListener('click', async () => {
  const result = await window.api.pickLogFile();
  if (!result?.canceled) setLogSourceText(result);
  updatePullPanelVisibility();
  updateRecentSkillsPanelVisibility();
});

reloadBtn.addEventListener('click', async () => {
  await window.api.reloadCurrentFile();
});

toggleLockBtn.addEventListener('click', async () => {
  await window.api.toggleOverlayLock();
});

skillsBtn.addEventListener('click', openSkillsModal);
showPartyToggle?.addEventListener('change', (event: Event) => {
  setPartyVisibility((event.currentTarget as HTMLInputElement).checked);
});
showPullToggle?.addEventListener('change', (event: Event) => {
  setPullVisibility((event.currentTarget as HTMLInputElement).checked);
});
showRecentSkillsToggle?.addEventListener('change', (event: Event) => {
  setRecentSkillsVisibility((event.currentTarget as HTMLInputElement).checked);
});
recentSkillsLimitInput.addEventListener('change', (event: Event) => {
  setRecentSkillsLimit((event.currentTarget as HTMLInputElement).value);
});
recentSkillsLimitInput.addEventListener('input', (event: Event) => {
  const input = event.currentTarget as HTMLInputElement;
  const value = clamp(Number(input.value || 7), 1, 20);
  input.value = String(value);
});
cardSizeDownBtn.addEventListener('click', () => setCardScale(cardScale - CARD_SCALE_STEP));
cardSizeUpBtn.addEventListener('click', () => setCardScale(cardScale + CARD_SCALE_STEP));
closeSkillsModalBtn.addEventListener('click', closeSkillsModal);
closeSettingsModalBtn.addEventListener('click', () => {
  void closeSettingsModal();
});
languageSelect.addEventListener('change', async (event: Event) => {
  const nextLanguage = (event.currentTarget as HTMLSelectElement).value === 'en' ? 'en' : 'ru';
  const result = await window.api.setLanguage(nextLanguage);
  setLanguage(result?.language || nextLanguage);
});
skillsModal.addEventListener('mousedown', (event: MouseEvent) => {
  if (event.target === skillsModal) closeSkillsModal();
});
settingsModal.addEventListener('mousedown', (event: MouseEvent) => {
  if (event.target === settingsModal) {
    void closeSettingsModal();
  }
});

window.api.onWatchStatus((payload) => {
  lastWatchStatusMessage = payload?.message || t('noWatching');
  watchStatusEl.textContent = lastWatchStatusMessage;
});

window.api.onOverlayMode((payload) => {
  overlayLocked = !!payload?.locked;
  toggleLockBtn.textContent = overlayLocked ? t('unlockOverlay') : t('lockOverlay');
});

window.api.onOpenSettings(() => {
  void openSettingsModal();
});

window.api.onRequestCloseSettings(() => {
  if (!settingsModalOpen) return;
  void closeSettingsModal();
});

window.api.onLogData((payload) => {
  setLogSourceText(payload);

  if (!payload?.ok) {
    latestData = null;
    playersContainer.innerHTML = `<div class="panel player-card interactive floating-card" style="left:16px;top:64px;">${escapeHtml(t('errorPrefix'))}: ${escapeHtml(payload?.error || 'unknown')}</div>`;
    cardMap.clear();
    renderRecentSkillsPanel([]);
    updatePullPanelVisibility();
    updateRecentSkillsPanelVisibility();
    return;
  }

  latestData = payload.data || null;
  renderPlayers(latestData?.players || []);
  updateRecentSkillsPanelVisibility();

  if (!cooldownTimer) cooldownTimer = setInterval(tickCooldowns, 1000);
});

window.api.onLanguageChanged((payload) => {
  setLanguage(payload?.language || 'ru');
});

window.api.getCurrentFile().then((result) => {
  setLogSourceText(result);
  updatePullPanelVisibility();
  updateRecentSkillsPanelVisibility();
});

window.api.getLanguage().then((result) => {
  setLanguage(result?.language || 'ru');
});

void ensureSkillCatalog();
updateCardScaleUi();
updateOverlayVisibility();
applyTranslations();
updatePullPanelVisibility();
updateRecentSkillsPanelVisibility();

})();
