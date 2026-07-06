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
const buffsBtn = mustElement<HTMLButtonElement>('buffsBtn');
const hotkeysSettingsTitle = mustElement<HTMLElement>('hotkeysSettingsTitle');
const hotkeyToggleInteractionLabel = mustElement<HTMLElement>('hotkeyToggleInteractionLabel');
const hotkeyPickLogLabel = mustElement<HTMLElement>('hotkeyPickLogLabel');
const hotkeyToggleVisibilityLabel = mustElement<HTMLElement>('hotkeyToggleVisibilityLabel');
const hotkeyOpenSettingsLabel = mustElement<HTMLElement>('hotkeyOpenSettingsLabel');
const hotkeyToggleInteractionBtn = mustElement<HTMLButtonElement>('hotkeyToggleInteractionBtn');
const hotkeyPickLogBtn = mustElement<HTMLButtonElement>('hotkeyPickLogBtn');
const hotkeyToggleVisibilityBtn = mustElement<HTMLButtonElement>('hotkeyToggleVisibilityBtn');
const hotkeyOpenSettingsBtn = mustElement<HTMLButtonElement>('hotkeyOpenSettingsBtn');
const hotkeyStatusEl = mustElement<HTMLElement>('hotkeyStatus');
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
const partyFrameAlignmentSelect = mustElement<HTMLSelectElement>('partyFrameAlignmentSelect');
const layoutDirectionLabel = mustElement<HTMLElement>('layoutDirectionLabel');
const frameGapLabel = document.getElementById('frameGapLabel') as HTMLElement | null;
const iconsPerRowLabel = document.getElementById('iconsPerRowLabel') as HTMLElement | null;
const cardSizeDownBtn = mustElement<HTMLButtonElement>('cardSizeDownBtn');
const cardSizeUpBtn = mustElement<HTMLButtonElement>('cardSizeUpBtn');
const cardSizeValueEl = mustElement<HTMLElement>('cardSizeValue');
const cardSizeControls = mustElement<HTMLElement>('cardSizeControls');
const cardSizeLabel = document.getElementById('cardSizeLabel') as HTMLElement | null;
const autoHideWithWindowToggle = document.getElementById('autoHideWithWindowToggle') as HTMLInputElement | null;
const autoHideWithWindowToggleLabel = document.getElementById('autoHideWithWindowToggleLabel') as HTMLElement | null;
const closeSkillsModalBtn = mustElement<HTMLButtonElement>('closeSkillsModalBtn');
const closeBuffsModalBtn = mustElement<HTMLButtonElement>('closeBuffsModalBtn');
const languageSelect = mustElement<HTMLSelectElement>('languageSelect');
const languageLabel = mustElement<HTMLElement>('languageLabel');
const showPartyToggle = document.getElementById('showPartyToggle') as HTMLInputElement | null;
const showPullToggle = document.getElementById('showPullToggle') as HTMLInputElement | null;
const showPartyToggleLabel = document.getElementById('showPartyToggleLabel') as HTMLElement | null;
const showPullToggleLabel = document.getElementById('showPullToggleLabel') as HTMLElement | null;
const skillsModalTitle = mustElement<HTMLElement>('skillsModalTitle');
const skillsModalSubtitle = mustElement<HTMLElement>('skillsModalSubtitle');
const buffsModalTitle = mustElement<HTMLElement>('buffsModalTitle');
const buffsModalSubtitle = mustElement<HTMLElement>('buffsModalSubtitle');
const filePathEl = mustElement<HTMLElement>('filePath');
const watchStatusEl = mustElement<HTMLElement>('watchStatus');
const hudStatusEl = mustElement<HTMLElement>('hudStatus');
const overlayRoot = mustElement<HTMLElement>('overlay-root');
const skillsModal = mustElement<HTMLElement>('skillsModal');
const buffsModal = mustElement<HTMLElement>('buffsModal');
const skillsCatalogEl = mustElement<HTMLElement>('skillsCatalog');
const buffSearchInput = mustElement<HTMLInputElement>('buffSearchInput');
const buffsSummaryEl = mustElement<HTMLElement>('buffsSummary');
const pullInfoEl = mustElement<HTMLElement>('pullInfo');
const recentSkillsPanelEl = mustElement<HTMLElement>('recentSkillsPanel');
const recentSkillsSettingsGroup = mustElement<HTMLElement>('recentSkillsSettingsGroup');
const showRecentSkillsToggle = document.getElementById('showRecentSkillsToggle') as HTMLInputElement | null;
const showRecentSkillsToggleLabel = document.getElementById('showRecentSkillsToggleLabel') as HTMLElement | null;
const showBuffsButtonToggle = document.getElementById('showBuffsButtonToggle') as HTMLInputElement | null;
const showBuffsButtonToggleLabel = document.getElementById('showBuffsButtonToggleLabel') as HTMLElement | null;
const partyFrameFieldsTitle = mustElement<HTMLElement>('partyFrameFieldsTitle');
const partyFrameAlignmentLabel = mustElement<HTMLElement>('partyFrameAlignmentLabel');
const partyFieldPlayerNameToggle = mustElement<HTMLInputElement>('partyFieldPlayerNameToggle');
const partyFieldChampionNameToggle = mustElement<HTMLInputElement>('partyFieldChampionNameToggle');
const partyFieldSpiritToggle = mustElement<HTMLInputElement>('partyFieldSpiritToggle');
const partyFieldRelicsToggle = mustElement<HTMLInputElement>('partyFieldRelicsToggle');
const partyFieldPlayerNameLabel = mustElement<HTMLElement>('partyFieldPlayerNameLabel');
const partyFieldChampionNameLabel = mustElement<HTMLElement>('partyFieldChampionNameLabel');
const partyFieldSpiritLabel = mustElement<HTMLElement>('partyFieldSpiritLabel');
const partyFieldRelicsLabel = mustElement<HTMLElement>('partyFieldRelicsLabel');
const menuColorsTitle = mustElement<HTMLElement>('menuColorsTitle');
const menuColorTextInput = mustElement<HTMLInputElement>('menuColorTextInput');
const menuColorTitleInput = mustElement<HTMLInputElement>('menuColorTitleInput');
const menuColorMutedTextInput = mustElement<HTMLInputElement>('menuColorMutedTextInput');
const menuColorPanelBackgroundInput = mustElement<HTMLInputElement>('menuColorPanelBackgroundInput');
const menuColorSectionBackgroundInput = mustElement<HTMLInputElement>('menuColorSectionBackgroundInput');
const menuColorControlBackgroundInput = mustElement<HTMLInputElement>('menuColorControlBackgroundInput');
const menuColorBorderInput = mustElement<HTMLInputElement>('menuColorBorderInput');
const menuColorAccentInput = mustElement<HTMLInputElement>('menuColorAccentInput');
const menuColorTextLabel = mustElement<HTMLElement>('menuColorTextLabel');
const menuColorTitleLabel = mustElement<HTMLElement>('menuColorTitleLabel');
const menuColorMutedTextLabel = mustElement<HTMLElement>('menuColorMutedTextLabel');
const menuColorPanelBackgroundLabel = mustElement<HTMLElement>('menuColorPanelBackgroundLabel');
const menuColorSectionBackgroundLabel = mustElement<HTMLElement>('menuColorSectionBackgroundLabel');
const menuColorControlBackgroundLabel = mustElement<HTMLElement>('menuColorControlBackgroundLabel');
const menuColorBorderLabel = mustElement<HTMLElement>('menuColorBorderLabel');
const menuColorAccentLabel = mustElement<HTMLElement>('menuColorAccentLabel');
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
const recentSkillsTrackCountTitle = document.getElementById('recentSkillsTrackCountTitle') as HTMLElement | null;
const recentSkillsTrackCountLabel = mustElement<HTMLElement>('recentSkillsTrackCountLabel');

const {
  CARD_SCALE_STEP,
  DEFAULT_HOTKEYS,
  DEFAULT_FRAME_GAP,
  DEFAULT_ICONS_PER_ROW,
  DEFAULT_LAYOUT_DIRECTION,
  DEFAULT_PARTY_FRAME_ALIGNMENT,
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
  formatDurationMs,
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
let autoHideWithGameWindow = settingsController.loadAutoHideWithGameWindow();

let frameGap = settingsController.loadFrameGap();
let iconsPerRow = settingsController.loadIconsPerRow();
let panelOpacity = settingsController.loadPanelOpacity();
let layoutDirection = settingsController.loadLayoutDirection();
let partyFrameFields: PartyFrameFields = settingsController.loadPartyFrameFields();
const partyFrameColors: PartyFrameColors = window.OverlayRendererConstants.DEFAULT_PARTY_FRAME_COLORS;
let partyFrameAlignment: PartyFrameAlignment = settingsController.loadPartyFrameAlignment();
let menuColors: MenuColors = settingsController.loadMenuColors();
let hotkeys = settingsController.loadHotkeys();
let currentLanguage: LanguageCode = 'en';
let lastWatchStatusMessage = '';
let visibilitySettings: OverlayVisibilitySettings = settingsController.loadVisibilitySettings();
let recentSkillsLimit = settingsController.loadRecentSkillsLimit();
let recentSkillsLayoutDirection = settingsController.loadRecentSkillsLayoutDirection();
let recentSkillsGrowthDirection = settingsController.loadRecentSkillsGrowthDirection();
let recentSkillsTrackCount = settingsController.loadRecentSkillsTrackCount();
let playerCardRenderer: PlayerCardRenderer | null = null;
let settingsModalOpen = false;
let listeningHotkeyAction: HotkeyAction | null = null;
let buffSearchQuery = '';
let floatingInteractiveRegionActive = false;
let buffsModalOpenedFromClickThrough = false;
const expandedBuffPlayerKeys = new Set<string>();

function t(key: string): string {
  return translateText(currentLanguage, key);
}

function hexToRgbString(value: string): string {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(String(value || '')) ? String(value) : '#ffffff';
  const red = parseInt(normalized.slice(1, 3), 16);
  const green = parseInt(normalized.slice(3, 5), 16);
  const blue = parseInt(normalized.slice(5, 7), 16);
  return `${red}, ${green}, ${blue}`;
}

function applyMenuColorVariables(): void {
  overlayRoot.style.setProperty('--menu-text-color', menuColors.text);
  overlayRoot.style.setProperty('--menu-title-color', menuColors.title);
  overlayRoot.style.setProperty('--menu-muted-text-color', menuColors.mutedText);
  overlayRoot.style.setProperty('--menu-panel-bg-rgb', hexToRgbString(menuColors.panelBackground));
  overlayRoot.style.setProperty('--menu-section-bg-rgb', hexToRgbString(menuColors.sectionBackground));
  overlayRoot.style.setProperty('--menu-control-bg-rgb', hexToRgbString(menuColors.controlBackground));
  overlayRoot.style.setProperty('--menu-border-rgb', hexToRgbString(menuColors.border));
  overlayRoot.style.setProperty('--menu-accent-rgb', hexToRgbString(menuColors.accent));
}

function formatHotkeyLabel(accelerator: string): string {
  return String(accelerator || '')
    .split('+')
    .map((part) => {
      if (part === 'CommandOrControl') return 'Ctrl';
      if (part === 'Super') return 'Win';
      return part;
    })
    .join('+');
}

function setHotkeyStatus(messageKey: string = 'hotkeyHint'): void {
  hotkeyStatusEl.textContent = t(messageKey);
}

function updateHotkeyButtons(): void {
  hotkeyToggleInteractionBtn.textContent = formatHotkeyLabel(hotkeys.toggleInteraction);
  hotkeyPickLogBtn.textContent = formatHotkeyLabel(hotkeys.pickLog);
  hotkeyToggleVisibilityBtn.textContent = formatHotkeyLabel(hotkeys.toggleVisibility);
  hotkeyOpenSettingsBtn.textContent = formatHotkeyLabel(hotkeys.openSettings);

  hotkeyToggleInteractionBtn.classList.toggle('listening', listeningHotkeyAction === 'toggleInteraction');
  hotkeyPickLogBtn.classList.toggle('listening', listeningHotkeyAction === 'pickLog');
  hotkeyToggleVisibilityBtn.classList.toggle('listening', listeningHotkeyAction === 'toggleVisibility');
  hotkeyOpenSettingsBtn.classList.toggle('listening', listeningHotkeyAction === 'openSettings');

  if (listeningHotkeyAction === 'toggleInteraction') hotkeyToggleInteractionBtn.textContent = '...';
  if (listeningHotkeyAction === 'pickLog') hotkeyPickLogBtn.textContent = '...';
  if (listeningHotkeyAction === 'toggleVisibility') hotkeyToggleVisibilityBtn.textContent = '...';
  if (listeningHotkeyAction === 'openSettings') hotkeyOpenSettingsBtn.textContent = '...';
}

function keyEventToAccelerator(event: KeyboardEvent): string | null {
  if (event.key === 'Escape') return '__cancel__';

  let baseKey = '';
  if (/^F([1-9]|1\d|2[0-4])$/i.test(event.key)) {
    baseKey = event.key.toUpperCase();
  } else if (/^Key[A-Z]$/.test(event.code)) {
    baseKey = event.code.slice(3);
  } else if (/^Digit\d$/.test(event.code)) {
    baseKey = event.code.slice(5);
  } else if (event.code === 'Space') {
    baseKey = 'Space';
  } else if (event.key === 'ArrowUp') {
    baseKey = 'Up';
  } else if (event.key === 'ArrowDown') {
    baseKey = 'Down';
  } else if (event.key === 'ArrowLeft') {
    baseKey = 'Left';
  } else if (event.key === 'ArrowRight') {
    baseKey = 'Right';
  } else if (event.key === 'Tab') {
    baseKey = 'Tab';
  } else if (event.key === 'Enter') {
    baseKey = 'Enter';
  }

  if (!baseKey) return null;

  const modifiers: string[] = [];
  if (event.ctrlKey) modifiers.push('CommandOrControl');
  if (event.altKey) modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');
  if (event.metaKey) modifiers.push('Super');
  return [...modifiers, baseKey].join('+');
}

function saveHotkeys(nextHotkeys: OverlayHotkeys): void {
  hotkeys = settingsController.normalizeHotkeys(nextHotkeys);
  settingsController.saveHotkeys(hotkeys);
  updateHotkeyButtons();
  setHotkeyStatus();
}

function beginHotkeyCapture(action: HotkeyAction): void {
  listeningHotkeyAction = action;
  updateHotkeyButtons();
  setHotkeyStatus('hotkeyListening');
}

function endHotkeyCapture(): void {
  listeningHotkeyAction = null;
  updateHotkeyButtons();
}

function setLogSourceText(source: { filePath?: string | null; directoryPath?: string | null } | null | undefined): void {
  setLogSourceTextShared(filePathEl, t, source);
}

function setWatchStatusFromSource(source: { watching?: boolean; directoryPath?: string | null } | null | undefined): void {
  if (!source?.watching) return;
  lastWatchStatusMessage = currentLanguage === 'ru'
    ? 'Слежение за папкой и последним логом активно'
    : 'Watching folder for the newest log file';
  watchStatusEl.textContent = lastWatchStatusMessage;
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

function getEffectiveCardScale(): number {
  return settingsController.normalizeCardScaleValue(cardScale);
}

function getCardWidthForIconCount(iconCount: number, iconsInRow = iconsPerRow): number {
  return getCardWidthForIconCountShared(getEffectiveCardScale(), iconCount, iconsInRow);
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

function loadBuffsButtonPosition(): Point {
  return settingsController.loadBuffsButtonPosition();
}

function saveBuffsButtonPosition(position: Point): void {
  settingsController.saveBuffsButtonPosition(position);
}

function saveVisibilitySettings(): void {
  settingsController.saveVisibilitySettings(visibilitySettings);
}

function updateOverlayVisibility(): void {
  overlayRoot.classList.toggle('party-hidden', !visibilitySettings.showParty);
  overlayRoot.classList.toggle('pull-hidden', !visibilitySettings.showPull);
  overlayRoot.classList.toggle('recent-skills-hidden', !visibilitySettings.showRecentSkills);
  overlayRoot.classList.toggle('buffs-button-hidden', !visibilitySettings.showBuffsButton);
  buffsBtn.classList.toggle('hidden', !visibilitySettings.showBuffsButton);
  syncBuffsButtonInteractiveBounds();
  recentSkillsSettingsGroup.classList.toggle('hidden', !visibilitySettings.showRecentSkills);
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

function setBuffsButtonVisibility(enabled: boolean): void {
  visibilitySettings = { ...visibilitySettings, showBuffsButton: !!enabled };
  saveVisibilitySettings();
  updateOverlayVisibility();
  if (!visibilitySettings.showBuffsButton) setFloatingInteractiveRegionActive(false);
}

function elementContainsViewportPoint(element: HTMLElement | null | undefined, x: number, y: number): boolean {
  if (!element || element.classList.contains('hidden')) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0
    && rect.height > 0
    && x >= rect.left
    && x <= rect.right
    && y >= rect.top
    && y <= rect.bottom;
}

function setFloatingInteractiveRegionActive(active: boolean): void {
  const nextActive = !!active && !overlayLocked;
  if (floatingInteractiveRegionActive === nextActive) return;
  floatingInteractiveRegionActive = nextActive;
  window.api.setInteractiveRegionActive(nextActive);
}

function updateFloatingInteractiveRegionAt(x: number, y: number): void {
  if (overlayLocked) {
    setFloatingInteractiveRegionActive(false);
    return;
  }

  const overBuffsButton = visibilitySettings.showBuffsButton
    && !buffsBtn.classList.contains('hidden')
    && elementContainsViewportPoint(buffsBtn, x, y);
  const overBuffsModal = !buffsModal.classList.contains('hidden')
    && elementContainsViewportPoint(buffsModal.querySelector<HTMLElement>('.buffs-modal-card') || buffsModal, x, y);

  setFloatingInteractiveRegionActive(overBuffsButton || overBuffsModal);
}

function syncBuffsButtonInteractiveBounds(): void {
  if (!visibilitySettings.showBuffsButton || buffsBtn.classList.contains('hidden')) {
    window.api.setInteractiveRegionBounds(null);
    return;
  }

  const rect = buffsBtn.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    window.api.setInteractiveRegionBounds(null);
    return;
  }

  window.api.setInteractiveRegionBounds({
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  });
}

function handleFloatingInteractiveRegionMouseMove(event: MouseEvent): void {
  updateFloatingInteractiveRegionAt(event.clientX, event.clientY);
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

function updateAutoHideUi(): void {
  if (autoHideWithWindowToggle) autoHideWithWindowToggle.checked = !!autoHideWithGameWindow;
}

function updateCardScaleUi(): void {
  overlayRoot.style.setProperty('--card-scale', String(getEffectiveCardScale()));
  cardSizeValueEl.textContent = Math.round(cardScale * 100) + '%';
}

function applyAppearanceVariables(): void {
  overlayRoot.style.setProperty('--party-gap', `${frameGap}px`);
  overlayRoot.style.setProperty('--panel-bg-alpha', String(panelOpacity));
  applyMenuColorVariables();
  overlayRoot.dataset.layoutDirection = layoutDirection;
  overlayRoot.dataset.iconsPerRow = String(iconsPerRow);
  overlayRoot.dataset.partyFrameAlignment = partyFrameAlignment;
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

function updatePartyFrameFieldsUi(): void {
  partyFieldPlayerNameToggle.checked = !!partyFrameFields.playerName;
  partyFieldChampionNameToggle.checked = !!partyFrameFields.championName;
  partyFieldSpiritToggle.checked = !!partyFrameFields.spirit;
  partyFieldRelicsToggle.checked = !!partyFrameFields.relicsAndCooldowns;
}

function updatePartyFrameAlignmentUi(): void {
  partyFrameAlignmentSelect.value = partyFrameAlignment;
}

function updateMenuColorsUi(): void {
  menuColorTextInput.value = menuColors.text;
  menuColorTitleInput.value = menuColors.title;
  menuColorMutedTextInput.value = menuColors.mutedText;
  menuColorPanelBackgroundInput.value = menuColors.panelBackground;
  menuColorSectionBackgroundInput.value = menuColors.sectionBackground;
  menuColorControlBackgroundInput.value = menuColors.controlBackground;
  menuColorBorderInput.value = menuColors.border;
  menuColorAccentInput.value = menuColors.accent;
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

function setAutoHideWithGameWindow(enabled: boolean): void {
  const normalized = !!enabled;
  if (normalized === autoHideWithGameWindow) return;
  autoHideWithGameWindow = normalized;
  settingsController.saveAutoHideWithGameWindow(autoHideWithGameWindow);
  updateAutoHideUi();
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

function setPartyFrameField(field: keyof PartyFrameFields, enabled: boolean): void {
  partyFrameFields = settingsController.normalizePartyFrameFields({
    ...partyFrameFields,
    [field]: !!enabled,
  });
  settingsController.savePartyFrameFields(partyFrameFields);
  updatePartyFrameFieldsUi();
  rerenderPlayersIfNeeded();
}

function setPartyFrameAlignment(nextValue: unknown): void {
  const normalized = settingsController.normalizePartyFrameAlignment(nextValue);
  if (normalized === partyFrameAlignment) return;
  partyFrameAlignment = normalized;
  settingsController.savePartyFrameAlignment(partyFrameAlignment);
  applyAppearanceVariables();
  updatePartyFrameAlignmentUi();
  rerenderPlayersIfNeeded();
}

function setMenuColor(field: keyof MenuColors, value: unknown): void {
  menuColors = settingsController.normalizeMenuColors({
    ...menuColors,
    [field]: value,
  });
  settingsController.saveMenuColors(menuColors);
  applyMenuColorVariables();
  updateMenuColorsUi();
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

function formatBuffDuration(ms: unknown): string {
  return formatDurationMs(Math.max(0, Number(ms || 0)));
}

function normalizeBuffSearchTerm(value: unknown): string {
  return String(value || '').trim().toLocaleLowerCase();
}

function getBuffPlayerKey(player: FinalizedState['players'][number], index: number): string {
  return String(player.id || player.name || index);
}

function updateBuffsButtonDragState(): void {
  buffsBtn.classList.toggle('drag-enabled', overlayLocked);
}

function initializeBuffsButton(): void {
  const position = loadBuffsButtonPosition();
  buffsBtn.style.left = `${position.x}px`;
  buffsBtn.style.top = `${position.y}px`;
  updateBuffsButtonDragState();
  window.setTimeout(syncBuffsButtonInteractiveBounds, 0);

  let dragging = false;
  let moved = false;
  let startMouseX = 0;
  let startMouseY = 0;
  let startLeft = 0;
  let startTop = 0;
  let suppressNextClick = false;

  function onMove(event: MouseEvent): void {
    if (!dragging) return;
    const dx = event.clientX - startMouseX;
    const dy = event.clientY - startMouseY;
    if (!moved && Math.hypot(dx, dy) < 3) return;

    moved = true;
    const maxX = Math.max(0, window.innerWidth - buffsBtn.offsetWidth - 6);
    const maxY = Math.max(0, window.innerHeight - buffsBtn.offsetHeight - 6);
    const left = clamp(startLeft + dx, 0, maxX);
    const top = clamp(startTop + dy, 0, maxY);
    buffsBtn.style.left = `${left}px`;
    buffsBtn.style.top = `${top}px`;
    syncBuffsButtonInteractiveBounds();
  }

  function onUp(): void {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);

    if (!moved) return;
    suppressNextClick = true;
    saveBuffsButtonPosition({
      x: parseFloat(buffsBtn.style.left || '0'),
      y: parseFloat(buffsBtn.style.top || '0'),
    });
    syncBuffsButtonInteractiveBounds();
    window.setTimeout(() => {
      suppressNextClick = false;
    }, 0);
  }

  buffsBtn.addEventListener('mousedown', (event: MouseEvent) => {
    if (!overlayLocked || event.button !== 0) return;
    dragging = true;
    moved = false;
    startMouseX = event.clientX;
    startMouseY = event.clientY;
    startLeft = parseFloat(buffsBtn.style.left || '0');
    startTop = parseFloat(buffsBtn.style.top || '0');
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    event.stopPropagation();
  });

  buffsBtn.addEventListener('click', (event: MouseEvent) => {
    if (suppressNextClick) {
      suppressNextClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    openBuffsModal();
  });
}

function renderBuffsModal(): void {
  const players = latestData?.players || [];
  const query = normalizeBuffSearchTerm(buffSearchQuery);

  if (!players.length) {
    buffsSummaryEl.innerHTML = `<div class="pull-empty">${escapeHtml(t('noBuffData'))}</div>`;
    return;
  }

  const playerCards = players.map((player, playerIndex) => {
    const playerName = String(player.name || t('unknown'));
    const playerMatches = query.length > 0 && normalizeBuffSearchTerm(playerName).includes(query);
    const buffs = [...(player.buffUptimes || [])]
      .filter((buff) => Number(buff.uptimeMs || 0) > 0 || Number(buff.applications || 0) > 0 || Number(buff.refreshes || 0) > 0)
      .filter((buff) => {
        if (!query || playerMatches) return true;
        return normalizeBuffSearchTerm(`${buff.name || ''} ${buff.sourceName || ''}`).includes(query);
      })
      .sort((a, b) => Number(b.uptimeMs || 0) - Number(a.uptimeMs || 0));

    if (query && !playerMatches && !buffs.length) return '';

    const rows = buffs.length
      ? buffs.map((buff) => {
        const percent = clamp(Number(buff.uptimePercent || 0), 0, 100);
        const stacks = Number(buff.currentStacks || 0);
        const stackText = stacks > 1 ? ` · ${escapeHtml(t('buffStacks'))}: ${escapeHtml(String(stacks))}` : '';
        const sourceText = buff.sourceName ? `<span class="buff-source">${escapeHtml(buff.sourceName)}</span>` : '';

        return `
          <div class="buff-row">
            <div class="buff-name-cell">
              <div class="buff-name">${escapeHtml(buff.name || t('unknown'))}</div>
              <div class="buff-meta">${escapeHtml(t('buffApplications'))}: ${escapeHtml(String(Number(buff.applications || 0)))} · ${escapeHtml(t('buffRefreshes'))}: ${escapeHtml(String(Number(buff.refreshes || 0)))}${stackText} ${sourceText}</div>
            </div>
            <div class="buff-duration-cell">${escapeHtml(formatBuffDuration(buff.uptimeMs))}</div>
            <div class="buff-percent-cell">
              <span>${escapeHtml(formatPercent(percent))}%</span>
              <div class="buff-percent-bar"><div style="width:${percent.toFixed(2)}%"></div></div>
            </div>
          </div>
        `;
      }).join('')
      : `<div class="pull-empty">${escapeHtml(t('noPlayerBuffs'))}</div>`;

    const playerKey = getBuffPlayerKey(player, playerIndex);
    const isExpanded = expandedBuffPlayerKeys.has(playerKey);
    const toggleTitle = isExpanded ? t('collapseBuffPlayer') : t('expandBuffPlayer');

    return `
      <section class="buff-player-card">
        <button class="buff-player-header" type="button" data-buff-player-key="${escapeHtml(playerKey)}" aria-expanded="${isExpanded ? 'true' : 'false'}" title="${escapeHtml(toggleTitle)}">
          <div class="buff-player-title">
            <span class="buff-player-arrow" aria-hidden="true">${isExpanded ? '▾' : '▸'}</span>
            <div>
              <div class="buff-player-name">${escapeHtml(player.name || t('unknown'))}</div>
              <div class="buff-player-class" style="color:${escapeHtml(player.classColor || '#6b7280')}">${escapeHtml(player.className || t('unknown'))}</div>
            </div>
          </div>
          <div class="buff-player-count">${escapeHtml(String(buffs.length))}</div>
        </button>
        <div class="buff-table ${isExpanded ? '' : 'hidden'}">
          <div class="buff-table-head">
            <span>${escapeHtml(t('buffColumnName'))}</span>
            <span>${escapeHtml(t('buffColumnUptime'))}</span>
            <span>${escapeHtml(t('buffColumnPercent'))}</span>
          </div>
          ${rows}
        </div>
      </section>
    `;
  }).filter(Boolean).join('');

  buffsSummaryEl.innerHTML = playerCards
    ? `<div class="buff-summary-grid">${playerCards}</div>`
    : `<div class="pull-empty">${escapeHtml(t('noBuffSearchResults'))}</div>`;
}

function openBuffsModal(): void {
  buffsModalOpenedFromClickThrough = !overlayLocked;
  if (buffsModalOpenedFromClickThrough) {
    void window.api.openInteractiveModal();
  }
  expandedBuffPlayerKeys.clear();
  renderBuffsModal();
  buffsModal.classList.remove('hidden');
  window.setTimeout(() => {
    buffSearchInput.focus();
    buffSearchInput.select();
  }, 0);
}

function closeBuffsModal(): void {
  buffsModal.classList.add('hidden');
  setFloatingInteractiveRegionActive(false);
  if (buffsModalOpenedFromClickThrough) {
    void window.api.closeInteractiveModal();
  }
  buffsModalOpenedFromClickThrough = false;
}

function handleHotkeyCapture(event: KeyboardEvent): void {
  if (!listeningHotkeyAction) return;

  event.preventDefault();
  event.stopPropagation();

  const accelerator = keyEventToAccelerator(event);
  if (accelerator === '__cancel__') {
    endHotkeyCapture();
    setHotkeyStatus();
    return;
  }
  if (!accelerator) {
    setHotkeyStatus('hotkeyInvalid');
    return;
  }

  const duplicate = Object.entries(hotkeys).find(([action, value]) => action !== listeningHotkeyAction && value === accelerator);
  if (duplicate) {
    setHotkeyStatus('hotkeyDuplicate');
    return;
  }

  saveHotkeys({
    ...hotkeys,
    [listeningHotkeyAction]: accelerator,
  });
  endHotkeyCapture();
}

function applyTranslations(): void {
  applyTranslationsShared({
    appearanceSettingsTitle,
    autoHideWithWindowToggle,
    autoHideWithWindowToggleLabel,
    cardSizeControls,
    cardSizeLabel,
    currentLanguage,
    filePathEl,
    frameGapControls,
    frameGapLabel,
    hotkeyOpenSettingsLabel,
    hotkeyPickLogLabel,
    hotkeyToggleInteractionLabel,
    hotkeyToggleVisibilityLabel,
    hotkeysSettingsTitle,
    hudActive,
    iconsPerRowControls,
    iconsPerRowLabel,
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
    recentSkillsTrackCountTitle,
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
    showBuffsButtonToggle,
    showBuffsButtonToggleLabel,
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
  partyFrameFieldsTitle.textContent = t('partyFrameFieldsTitle');
  partyFieldPlayerNameLabel.textContent = t('partyFieldPlayerName');
  partyFieldChampionNameLabel.textContent = t('partyFieldChampionName');
  partyFieldSpiritLabel.textContent = t('partyFieldSpirit');
  partyFieldRelicsLabel.textContent = t('partyFieldRelics');
  partyFrameAlignmentLabel.textContent = t('partyFrameAlignment');
  const partyAlignmentLeftOption = partyFrameAlignmentSelect.querySelector<HTMLOptionElement>('option[value="left"]');
  const partyAlignmentCenterOption = partyFrameAlignmentSelect.querySelector<HTMLOptionElement>('option[value="center"]');
  const partyAlignmentRightOption = partyFrameAlignmentSelect.querySelector<HTMLOptionElement>('option[value="right"]');
  if (partyAlignmentLeftOption) partyAlignmentLeftOption.textContent = t('alignmentLeft');
  if (partyAlignmentCenterOption) partyAlignmentCenterOption.textContent = t('alignmentCenter');
  if (partyAlignmentRightOption) partyAlignmentRightOption.textContent = t('alignmentRight');
  menuColorsTitle.textContent = t('menuColorsTitle');
  menuColorTextLabel.textContent = t('menuColorText');
  menuColorTitleLabel.textContent = t('menuColorTitle');
  menuColorMutedTextLabel.textContent = t('menuColorMutedText');
  menuColorPanelBackgroundLabel.textContent = t('menuColorPanelBackground');
  menuColorSectionBackgroundLabel.textContent = t('menuColorSectionBackground');
  menuColorControlBackgroundLabel.textContent = t('menuColorControlBackground');
  menuColorBorderLabel.textContent = t('menuColorBorder');
  menuColorAccentLabel.textContent = t('menuColorAccent');
  updatePartyFrameFieldsUi();
  updatePartyFrameAlignmentUi();
  updateMenuColorsUi();
  buffsBtn.textContent = t('buffs');
  buffsBtn.title = t('buffUptimeTitle');
  syncBuffsButtonInteractiveBounds();
  buffsModalTitle.textContent = t('buffUptimeTitle');
  buffsModalSubtitle.textContent = t('buffUptimeSubtitle');
  buffSearchInput.placeholder = t('buffSearchPlaceholder');
  renderBuffsModal();
  if (!listeningHotkeyAction) setHotkeyStatus();
  updateHotkeyButtons();
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
  updatePartyFrameFieldsUi();
  updatePartyFrameAlignmentUi();
  updateMenuColorsUi();
  updateLayoutDirectionUi();
  updateRecentSkillsLayoutUi();
  settingsModal.classList.remove('hidden');
  settingsModalOpen = true;
  await window.api.setSettingsModalOpen(true);
}

async function closeSettingsModal(): Promise<void> {
  settingsModal.classList.add('hidden');
  settingsModalOpen = false;
  if (listeningHotkeyAction) {
    endHotkeyCapture();
    setHotkeyStatus();
  }
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
  getCardScale: () => getEffectiveCardScale(),
  getDefaultPosition,
  getFrameGap: () => frameGap,
  getIconsPerRow: () => iconsPerRow,
  getLayoutDirection: () => layoutDirection,
  getLatestData: () => latestData,
  getOverlayLocked: () => overlayLocked,
  getPartyFrameFields: () => partyFrameFields,
  getPartyFrameColors: () => partyFrameColors,
  getPartyFrameAlignment: () => partyFrameAlignment,
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

initializeBuffsButton();

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
buffSearchInput.addEventListener('input', (event: Event) => {
  buffSearchQuery = (event.currentTarget as HTMLInputElement).value;
  renderBuffsModal();
});

buffsSummaryEl.addEventListener('click', (event: MouseEvent) => {
  const toggle = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-buff-player-key]');
  if (!toggle) return;

  const playerKey = toggle.dataset.buffPlayerKey || '';
  if (!playerKey) return;

  if (expandedBuffPlayerKeys.has(playerKey)) {
    expandedBuffPlayerKeys.delete(playerKey);
  } else {
    expandedBuffPlayerKeys.add(playerKey);
  }

  renderBuffsModal();
});
showPartyToggle?.addEventListener('change', (event: Event) => {
  setPartyVisibility((event.currentTarget as HTMLInputElement).checked);
});
showPullToggle?.addEventListener('change', (event: Event) => {
  setPullVisibility((event.currentTarget as HTMLInputElement).checked);
});
showRecentSkillsToggle?.addEventListener('change', (event: Event) => {
  setRecentSkillsVisibility((event.currentTarget as HTMLInputElement).checked);
});
showBuffsButtonToggle?.addEventListener('change', (event: Event) => {
  setBuffsButtonVisibility((event.currentTarget as HTMLInputElement).checked);
});
partyFieldPlayerNameToggle.addEventListener('change', (event: Event) => {
  setPartyFrameField('playerName', (event.currentTarget as HTMLInputElement).checked);
});
partyFieldChampionNameToggle.addEventListener('change', (event: Event) => {
  setPartyFrameField('championName', (event.currentTarget as HTMLInputElement).checked);
});
partyFieldSpiritToggle.addEventListener('change', (event: Event) => {
  setPartyFrameField('spirit', (event.currentTarget as HTMLInputElement).checked);
});
partyFieldRelicsToggle.addEventListener('change', (event: Event) => {
  setPartyFrameField('relicsAndCooldowns', (event.currentTarget as HTMLInputElement).checked);
});
partyFrameAlignmentSelect.addEventListener('change', (event: Event) => {
  setPartyFrameAlignment((event.currentTarget as HTMLSelectElement).value || DEFAULT_PARTY_FRAME_ALIGNMENT);
});
menuColorTextInput.addEventListener('input', (event: Event) => {
  setMenuColor('text', (event.currentTarget as HTMLInputElement).value);
});
menuColorTitleInput.addEventListener('input', (event: Event) => {
  setMenuColor('title', (event.currentTarget as HTMLInputElement).value);
});
menuColorMutedTextInput.addEventListener('input', (event: Event) => {
  setMenuColor('mutedText', (event.currentTarget as HTMLInputElement).value);
});
menuColorPanelBackgroundInput.addEventListener('input', (event: Event) => {
  setMenuColor('panelBackground', (event.currentTarget as HTMLInputElement).value);
});
menuColorSectionBackgroundInput.addEventListener('input', (event: Event) => {
  setMenuColor('sectionBackground', (event.currentTarget as HTMLInputElement).value);
});
menuColorControlBackgroundInput.addEventListener('input', (event: Event) => {
  setMenuColor('controlBackground', (event.currentTarget as HTMLInputElement).value);
});
menuColorBorderInput.addEventListener('input', (event: Event) => {
  setMenuColor('border', (event.currentTarget as HTMLInputElement).value);
});
menuColorAccentInput.addEventListener('input', (event: Event) => {
  setMenuColor('accent', (event.currentTarget as HTMLInputElement).value);
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
autoHideWithWindowToggle?.addEventListener('change', (event: Event) => {
  setAutoHideWithGameWindow((event.currentTarget as HTMLInputElement).checked);
});

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
closeBuffsModalBtn.addEventListener('click', closeBuffsModal);
closeSettingsModalBtn.addEventListener('click', () => {
  void closeSettingsModal();
});
hotkeyToggleInteractionBtn.addEventListener('click', () => beginHotkeyCapture('toggleInteraction'));
hotkeyPickLogBtn.addEventListener('click', () => beginHotkeyCapture('pickLog'));
hotkeyToggleVisibilityBtn.addEventListener('click', () => beginHotkeyCapture('toggleVisibility'));
hotkeyOpenSettingsBtn.addEventListener('click', () => beginHotkeyCapture('openSettings'));
languageSelect.addEventListener('change', async (event: Event) => {
  const nextLanguage = (event.currentTarget as HTMLSelectElement).value === 'en' ? 'en' : 'ru';
  const result = await window.api.setLanguage(nextLanguage);
  setLanguage(result?.language || nextLanguage);
});
skillsModal.addEventListener('mousedown', (event: MouseEvent) => {
  if (event.target === skillsModal) closeSkillsModal();
});
buffsModal.addEventListener('mousedown', (event: MouseEvent) => {
  if (event.target === buffsModal) closeBuffsModal();
});
settingsModal.addEventListener('mousedown', (event: MouseEvent) => {
  if (event.target === settingsModal) {
    void closeSettingsModal();
  }
});
document.addEventListener('keydown', handleHotkeyCapture, true);
window.addEventListener('resize', syncBuffsButtonInteractiveBounds);
document.addEventListener('mousemove', handleFloatingInteractiveRegionMouseMove, true);
document.addEventListener('mouseleave', () => setFloatingInteractiveRegionActive(false), true);
window.addEventListener('blur', () => setFloatingInteractiveRegionActive(false));

window.api.onWatchStatus((payload) => {
  lastWatchStatusMessage = payload?.message || t('noWatching');
  watchStatusEl.textContent = lastWatchStatusMessage;
});

window.api.onOverlayMode((payload) => {
  overlayLocked = !!payload?.locked;
  setFloatingInteractiveRegionActive(false);
  toggleLockBtn.textContent = overlayLocked ? t('unlockOverlay') : t('lockOverlay');
  updateBuffsButtonDragState();
  rerenderPlayersIfNeeded();
});

window.api.onOpenSettings((payload) => {
  setLogSourceText(payload);
  setWatchStatusFromSource(payload);
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
    renderBuffsModal();
    updatePullPanelVisibility();
    updateRecentSkillsPanelVisibility();
    return;
  }

  latestData = payload.data || null;
  renderPlayers(latestData?.players || []);
  renderBuffsModal();
  updateRecentSkillsPanelVisibility();

  if (!cooldownTimer) cooldownTimer = setInterval(tickCooldowns, 1000);
});

window.api.onLanguageChanged((payload) => {
  setLanguage(payload?.language || 'ru');
});

window.api.onHudActivity((payload) => {
  setHudActiveState(!!payload?.active, payload?.foregroundExe || null);
});

window.api.getCurrentFile().then((result) => {
  setLogSourceText(result);
  setWatchStatusFromSource(result);
  if (result?.filePath || result?.directoryPath) {
    void window.api.reloadCurrentFile();
  }
  updatePullPanelVisibility();
  updateRecentSkillsPanelVisibility();
});

window.api.getLanguage().then((result) => {
  setLanguage(result?.language || 'ru');
});

void ensureSkillCatalog();
applyAppearanceVariables();
updateCardScaleUi();
updateAutoHideUi();
updateFrameGapUi();
updateIconsPerRowUi();
updatePanelOpacityUi();
updatePartyFrameFieldsUi();
updatePartyFrameAlignmentUi();
updateMenuColorsUi();
updateLayoutDirectionUi();
updateRecentSkillsLayoutUi();
updateOverlayVisibility();
applyTranslations();
updatePullPanelVisibility();
updateRecentSkillsPanelVisibility();

})();
