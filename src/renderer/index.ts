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
const hotkeysSettingsTitle = mustElement<HTMLElement>('hotkeysSettingsTitle');
const hotkeyToggleInteractionLabel = mustElement<HTMLElement>('hotkeyToggleInteractionLabel');
const hotkeyPickLogLabel = mustElement<HTMLElement>('hotkeyPickLogLabel');
const hotkeyToggleVisibilityLabel = mustElement<HTMLElement>('hotkeyToggleVisibilityLabel');
const hotkeyOpenSettingsLabel = mustElement<HTMLElement>('hotkeyOpenSettingsLabel');
const frameGapDownBtn = mustElement<HTMLButtonElement>('frameGapDownBtn');
const frameGapUpBtn = mustElement<HTMLButtonElement>('frameGapUpBtn');
const frameGapValueEl = mustElement<HTMLElement>('frameGapValue');
const frameGapControls = mustElement<HTMLElement>('frameGapControls');
const iconsPerRowDownBtn = mustElement<HTMLButtonElement>('iconsPerRowDownBtn');
const iconsPerRowUpBtn = mustElement<HTMLButtonElement>('iconsPerRowUpBtn');
const iconsPerRowValueEl = mustElement<HTMLElement>('iconsPerRowValue');
const iconsPerRowControls = mustElement<HTMLElement>('iconsPerRowControls');
const panelOpacitySlider = mustElement<HTMLInputElement>('panelOpacitySlider');
const panelOpacityValueEl = mustElement<HTMLElement>('panelOpacityValue');
const panelOpacityLabel = mustElement<HTMLElement>('panelOpacityLabel');
const layoutDirectionSelect = mustElement<HTMLSelectElement>('layoutDirectionSelect');
const layoutDirectionLabel = mustElement<HTMLElement>('layoutDirectionLabel');
const cardSizeDownBtn = mustElement<HTMLButtonElement>('cardSizeDownBtn');
const cardSizeUpBtn = mustElement<HTMLButtonElement>('cardSizeUpBtn');
const cardSizeValueEl = mustElement<HTMLElement>('cardSizeValue');
const cardSizeControls = mustElement<HTMLElement>('cardSizeControls');
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
const recentSkillsLayoutDirectionSelect = mustElement<HTMLSelectElement>('recentSkillsLayoutDirectionSelect');
const recentSkillsLayoutDirectionLabel = mustElement<HTMLElement>('recentSkillsLayoutDirectionLabel');
const recentSkillsGrowthDirectionSelect = mustElement<HTMLSelectElement>('recentSkillsGrowthDirectionSelect');
const recentSkillsGrowthDirectionLabel = mustElement<HTMLElement>('recentSkillsGrowthDirectionLabel');
const recentSkillsTrackCountDownBtn = mustElement<HTMLButtonElement>('recentSkillsTrackCountDownBtn');
const recentSkillsTrackCountUpBtn = mustElement<HTMLButtonElement>('recentSkillsTrackCountUpBtn');
const recentSkillsTrackCountValueEl = mustElement<HTMLElement>('recentSkillsTrackCountValue');
const recentSkillsTrackCountControls = mustElement<HTMLElement>('recentSkillsTrackCountControls');
const recentSkillsTrackCountLabel = mustElement<HTMLElement>('recentSkillsTrackCountLabel');

const {
  CARD_SCALE_STEP,
  DEFAULT_FRAME_GAP,
  DEFAULT_ICONS_PER_ROW,
  DEFAULT_LAYOUT_DIRECTION,
  DEFAULT_PANEL_OPACITY,
  DEFAULT_RECENT_SKILLS_GROWTH_DIRECTION,
  DEFAULT_RECENT_SKILLS_LAYOUT_DIRECTION,
  DEFAULT_RECENT_SKILLS_TRACK_COUNT,
  FRAME_GAP_STEP,
} = window.OverlayRendererConstants;
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
let frameGap = settingsController.loadFrameGap();
let iconsPerRow = settingsController.loadIconsPerRow();
let panelOpacity = settingsController.loadPanelOpacity();
let layoutDirection = settingsController.loadLayoutDirection();
let currentLanguage: LanguageCode = 'en';
let lastWatchStatusMessage = '';
let visibilitySettings: OverlayVisibilitySettings = settingsController.loadVisibilitySettings();
let recentSkillsLimit = settingsController.loadRecentSkillsLimit();
let recentSkillsLayoutDirection = settingsController.loadRecentSkillsLayoutDirection();
let recentSkillsGrowthDirection = settingsController.loadRecentSkillsGrowthDirection();
let recentSkillsTrackCount = settingsController.loadRecentSkillsTrackCount();
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

function getCardWidthForIconCount(iconCount: number, iconsInRow = iconsPerRow): number {
  return getCardWidthForIconCountShared(cardScale, iconCount, iconsInRow);
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
    recentSkillsLayoutDirection,
    recentSkillsGrowthDirection,
    recentSkillsTrackCount,
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

function applyAppearanceVariables(): void {
  overlayRoot.style.setProperty('--party-gap', `${frameGap}px`);
  overlayRoot.style.setProperty('--panel-bg-alpha', String(panelOpacity));
  overlayRoot.dataset.layoutDirection = layoutDirection;
  overlayRoot.dataset.iconsPerRow = String(iconsPerRow);
}

function updateFrameGapUi(): void {
  frameGapValueEl.textContent = `${frameGap}px`;
}

function updateIconsPerRowUi(): void {
  iconsPerRowValueEl.textContent = String(iconsPerRow);
}

function updatePanelOpacityUi(): void {
  const percent = Math.round(panelOpacity * 100);
  panelOpacitySlider.value = String(percent);
  panelOpacityValueEl.textContent = `${percent}%`;
}

function updateLayoutDirectionUi(): void {
  layoutDirectionSelect.value = layoutDirection === 'horizontal' ? 'horizontal' : 'vertical';
}

function updateRecentSkillsLayoutUi(): void {
  recentSkillsLayoutDirectionSelect.value = recentSkillsLayoutDirection;
  const isHorizontal = recentSkillsLayoutDirection === 'horizontal';
  recentSkillsGrowthDirectionSelect.innerHTML = isHorizontal
    ? `<option value="right">${escapeHtml(t('growthRight'))}</option><option value="left">${escapeHtml(t('growthLeft'))}</option>`
    : `<option value="down">${escapeHtml(t('growthDown'))}</option><option value="up">${escapeHtml(t('growthUp'))}</option>`;
  const normalizedGrowth = settingsController.normalizeRecentSkillsGrowthDirection(recentSkillsGrowthDirection);
  recentSkillsGrowthDirection = isHorizontal
    ? (normalizedGrowth === 'left' ? 'left' : 'right')
    : (normalizedGrowth === 'up' ? 'up' : 'down');
  recentSkillsGrowthDirectionSelect.value = recentSkillsGrowthDirection;
  recentSkillsTrackCountValueEl.textContent = String(recentSkillsTrackCount);
  recentSkillsTrackCountLabel.textContent = isHorizontal ? t('recentSkillsTrackCountRows') : t('recentSkillsTrackCountColumns');
}

function rerenderPlayersIfNeeded(): void {
  if (latestData?.players) renderPlayers(latestData.players);
}

function setCardScale(nextScale: number): void {
  const normalized = settingsController.normalizeCardScaleValue(nextScale);
  if (normalized === cardScale) return;
  cardScale = normalized;
  settingsController.saveCardScale(cardScale);
  updateCardScaleUi();
  if (latestData?.players) renderPlayers(latestData.players);
}

function setFrameGap(nextValue: unknown): void {
  const normalized = settingsController.normalizeFrameGap(nextValue);
  if (normalized === frameGap) return;
  frameGap = normalized;
  settingsController.saveFrameGap(frameGap);
  applyAppearanceVariables();
  updateFrameGapUi();
  rerenderPlayersIfNeeded();
}

function setIconsPerRow(nextValue: unknown): void {
  const normalized = settingsController.normalizeIconsPerRow(nextValue);
  if (normalized === iconsPerRow) return;
  iconsPerRow = normalized;
  settingsController.saveIconsPerRow(iconsPerRow);
  applyAppearanceVariables();
  updateIconsPerRowUi();
  rerenderPlayersIfNeeded();
}

function setPanelOpacity(nextValue: unknown): void {
  const normalized = settingsController.normalizePanelOpacity(nextValue);
  if (normalized === panelOpacity) return;
  panelOpacity = normalized;
  settingsController.savePanelOpacity(panelOpacity);
  applyAppearanceVariables();
  updatePanelOpacityUi();
}

function setLayoutDirection(nextValue: unknown): void {
  const normalized = settingsController.normalizeLayoutDirection(nextValue);
  if (normalized === layoutDirection) return;
  layoutDirection = normalized;
  settingsController.saveLayoutDirection(layoutDirection);
  applyAppearanceVariables();
  updateLayoutDirectionUi();
  rerenderPlayersIfNeeded();
}

function rerenderRecentSkillsPanel(): void {
  renderRecentSkillsPanel(latestData?.recentSkills || []);
}

function setRecentSkillsLayoutDirection(nextValue: unknown): void {
  const normalized = settingsController.normalizeRecentSkillsLayoutDirection(nextValue);
  if (normalized === recentSkillsLayoutDirection) return;
  recentSkillsLayoutDirection = normalized;
  recentSkillsGrowthDirection = normalized === 'horizontal'
    ? (recentSkillsGrowthDirection === 'left' ? 'left' : 'right')
    : (recentSkillsGrowthDirection === 'up' ? 'up' : 'down');
  settingsController.saveRecentSkillsLayoutDirection(recentSkillsLayoutDirection);
  settingsController.saveRecentSkillsGrowthDirection(recentSkillsGrowthDirection);
  updateRecentSkillsLayoutUi();
  rerenderRecentSkillsPanel();
}

function setRecentSkillsGrowthDirection(nextValue: unknown): void {
  const normalized = settingsController.normalizeRecentSkillsGrowthDirection(nextValue);
  const allowed = recentSkillsLayoutDirection === 'horizontal'
    ? (normalized === 'left' ? 'left' : 'right')
    : (normalized === 'up' ? 'up' : 'down');
  if (allowed === recentSkillsGrowthDirection) return;
  recentSkillsGrowthDirection = allowed;
  settingsController.saveRecentSkillsGrowthDirection(recentSkillsGrowthDirection);
  updateRecentSkillsLayoutUi();
  rerenderRecentSkillsPanel();
}

function setRecentSkillsTrackCount(nextValue: number): void {
  const normalized = settingsController.normalizeRecentSkillsTrackCount(nextValue);
  if (normalized === recentSkillsTrackCount) return;
  recentSkillsTrackCount = normalized;
  settingsController.saveRecentSkillsTrackCount(recentSkillsTrackCount);
  updateRecentSkillsLayoutUi();
  rerenderRecentSkillsPanel();
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
    cardSizeControls,
    cardSizeLabel: null,
    currentLanguage,
    filePathEl,
    frameGapControls,
    frameGapLabel: null,
    hotkeyOpenSettingsLabel,
    hotkeyPickLogLabel,
    hotkeyToggleInteractionLabel,
    hotkeyToggleVisibilityLabel,
    hotkeysSettingsTitle,
    hudActive,
    iconsPerRowControls,
    iconsPerRowLabel: null,
    languageLabel,
    languageSelect,
    layoutDirection,
    layoutDirectionLabel,
    layoutDirectionSelect,
    lastWatchStatusMessage,
    latestData,
    logSettingsTitle,
    overlayLocked,
    overlaySettingsTitle,
    panelOpacityLabel,
    pickFileBtn,
    recentSkillsGrowthDirection,
    recentSkillsGrowthDirectionLabel,
    recentSkillsGrowthDirectionSelect,
    recentSkillsLayoutDirection,
    recentSkillsLayoutDirectionLabel,
    recentSkillsLayoutDirectionSelect,
    recentSkillsLimit,
    recentSkillsLimitInput,
    recentSkillsLimitLabel,
    recentSkillsTrackCount,
    recentSkillsTrackCountControls,
    recentSkillsTrackCountLabel,
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
  applyAppearanceVariables();
  updateCardScaleUi();
  updateFrameGapUi();
  updateIconsPerRowUi();
  updatePanelOpacityUi();
  updateLayoutDirectionUi();
  updateRecentSkillsLayoutUi();
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
  getFrameGap: () => frameGap,
  getIconsPerRow: () => iconsPerRow,
  getLayoutDirection: () => layoutDirection,
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
recentSkillsLayoutDirectionSelect.addEventListener('change', (event: Event) => {
  setRecentSkillsLayoutDirection((event.currentTarget as HTMLSelectElement).value);
});
recentSkillsGrowthDirectionSelect.addEventListener('change', (event: Event) => {
  setRecentSkillsGrowthDirection((event.currentTarget as HTMLSelectElement).value);
});
recentSkillsTrackCountDownBtn.addEventListener('click', () => setRecentSkillsTrackCount(recentSkillsTrackCount - 1));
recentSkillsTrackCountUpBtn.addEventListener('click', () => setRecentSkillsTrackCount(recentSkillsTrackCount + 1));
frameGapDownBtn.addEventListener('click', () => setFrameGap(frameGap - FRAME_GAP_STEP));
frameGapUpBtn.addEventListener('click', () => setFrameGap(frameGap + FRAME_GAP_STEP));
iconsPerRowDownBtn.addEventListener('click', () => setIconsPerRow(iconsPerRow - 1));
iconsPerRowUpBtn.addEventListener('click', () => setIconsPerRow(iconsPerRow + 1));
panelOpacitySlider.addEventListener('input', (event: Event) => {
  const value = Number((event.currentTarget as HTMLInputElement).value || Math.round(DEFAULT_PANEL_OPACITY * 100));
  setPanelOpacity(value / 100);
});
layoutDirectionSelect.addEventListener('change', (event: Event) => {
  setLayoutDirection((event.currentTarget as HTMLSelectElement).value || DEFAULT_LAYOUT_DIRECTION);
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
  rerenderPlayersIfNeeded();
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
applyAppearanceVariables();
updateCardScaleUi();
updateFrameGapUi();
updateIconsPerRowUi();
updatePanelOpacityUi();
updateLayoutDirectionUi();
updateRecentSkillsLayoutUi();
updateOverlayVisibility();
applyTranslations();
updatePullPanelVisibility();
updateRecentSkillsPanelVisibility();

})();
