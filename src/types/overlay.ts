export type Nullable<T> = T | null;
export type LanguageCode = 'en' | 'ru';

export interface Point {
  x: number;
  y: number;
}

export type PlayerPositions = Record<string, Point>;
export type SkillSelectionMap = Record<string, string[]>;

export interface OverlayVisibilitySettings {
  showParty: boolean;
  showPull: boolean;
  showRecentSkills: boolean;
}

export interface OverlayPanelPositions {
  pullInfo: Point;
  recentSkills: Point;
}

export interface OverlaySettings {
  language?: LanguageCode;
  logDirectoryPath?: string | null;
  currentFilePath?: string | null;
  playerPositions: PlayerPositions;
  panelPositions: OverlayPanelPositions;
  visibilitySettings: OverlayVisibilitySettings;
  recentSkillsLimit: number;
  selectedSkillsByClass: SkillSelectionMap;
  cardScale: number;
}

export interface LogSourceInfo {
  filePath?: string | null;
  directoryPath?: string | null;
}

export interface WatchStatusPayload {
  ok: boolean;
  message: string;
}

export interface OverlayModePayload {
  clickThrough?: boolean;
  locked: boolean;
}

export interface LanguagePayload {
  language: LanguageCode;
}

export interface OpenSettingsPayload extends LogSourceInfo {
  watching: boolean;
  locked: boolean;
  language: LanguageCode;
}

export interface PickDirectoryResult extends LogSourceInfo {
  canceled: boolean;
  ok?: boolean;
}

export interface ReloadFileResult extends LogSourceInfo {
  ok: boolean;
}

export interface GetOverlaySettingsSyncResult {
  settings: OverlaySettings;
}

export interface GetPlayerPositionsSyncResult {
  playerPositions: PlayerPositions;
}

export interface SaveOverlaySettingsResult {
  ok: boolean;
  settings: OverlaySettings;
}

export interface SavePlayerPositionsResult {
  ok: boolean;
  playerPositions: PlayerPositions;
}

export interface AssetBackedEntry {
  id: number;
  name: string;
  icon: string | null;
}

export interface SkillCatalogAbility extends AssetBackedEntry {
  cooldown: number;
}

export interface SkillCatalogClass {
  id: number;
  name: string;
  abilities: SkillCatalogAbility[];
}

export interface SkillCatalog {
  classes: SkillCatalogClass[];
}

export interface SpiritSnapshot {
  ts: string;
  current: number;
  max: number;
  abilityId: number | null;
  abilityName: string | null;
}

export interface AbilityStat {
  id: number | null;
  name: string | null;
  damage: number;
  healing: number;
  activations: number;
  hits: number;
  lastActivationTs: string | null;
}

export interface SerializedAbilityStat extends AbilityStat {
  activationTimestamps: string[];
}

export interface RecentSkillActivation {
  ts: string;
  playerId: string | null;
  playerName: string | null;
  classId: number | null;
  className: string | null;
  abilityId: number | null;
  abilityName: string | null;
  icon?: string | null;
}

export interface RelicMeta extends AssetBackedEntry {
  baseCooldown: number;
}

export interface PlayerRelicState extends RelicMeta {
  cooldownModifier: number;
  effectiveCooldown: number;
  lastUsedAt: string | null;
  cooldownEndsAt: string | null;
  cooldownRemainingMs: number;
  isReady: boolean;
  key?: string;
}

export interface PlayerStones {
  raw: number[];
  blue: number;
  green: number;
  white: number;
}

export interface UsesPerBossEntry {
  encounterId: number | null;
  encounterName: string | null;
  abilities: SerializedAbilityStat[];
}

export interface PlayerState {
  id: string;
  name: string | null;
  classId: number | null;
  className: string;
  classColor: string;
  damageDone: number;
  healingDone: number;
  damageTaken: number;
  deaths: number;
  abilities: Map<string, AbilityStat> | SerializedAbilityStat[];
  spirit: SpiritSnapshot | null;
  spiritHistory?: SpiritSnapshot[];
  relics: PlayerRelicState[];
  stones: PlayerStones;
  combatAbilities?: SerializedAbilityStat[];
  usesPerBoss?: UsesPerBossEntry[];
}

export interface PlayerValueAmount {
  playerKey: string;
  amount: number;
}

export interface EncounterAbilitiesByPlayer {
  playerKey: string;
  abilities: SerializedAbilityStat[];
}

export interface NpcPercentMeta {
  templateId: number | null;
  name: string;
  score: number;
  percent: number;
}

export interface CurrentPullNpc extends NpcPercentMeta {
  unitId: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  deadAt: string | null;
  chickenizedAt: string | null;
  chickenized: boolean;
  bossSpawnedAt: string | null;
  bossSpawned: boolean;
  alive?: boolean;
  effectivePercent?: number;
}

export interface CurrentPullState {
  startedAt: string | null;
  lastCombatAtMs: number | null;
  npcMap: Map<string, CurrentPullNpc>;
}

export interface CurrentPullSummary {
  startedAt: string | null;
  lastCombatAt: string | null;
  totalPercent: number;
  alivePercent: number;
  killedPercent: number;
  mobCount: number;
  aliveCount: number;
  chickenizedCount?: number;
  aliveChickenizedCount?: number;
  chickenizedOriginalPercent?: number;
  aliveChickenizedOriginalPercent?: number;
  mobs: CurrentPullNpc[];
}

export interface EncounterState {
  id: number | null;
  name: string | null;
  startedAt: string | null;
  endedAt: string | null;
  success: boolean | null;
  damageByPlayer: Map<string, number>;
  healingByPlayer: Map<string, number>;
  npcDeaths: NpcDeathEntry[];
  abilitiesByPlayer: Map<string, Map<string, AbilityStat>>;
}

export interface FinalizedEncounter {
  id: number | null;
  name: string | null;
  startedAt: string | null;
  endedAt: string | null;
  success: boolean | null;
  damageByPlayer: PlayerValueAmount[];
  healingByPlayer: PlayerValueAmount[];
  abilitiesByPlayer: EncounterAbilitiesByPlayer[];
  npcDeaths: NpcDeathEntry[];
}

export interface DungeonDataMob {
  name?: string;
  score?: number;
  percent?: number;
}

export interface DungeonData {
  killcount?: number;
  bossesID?: number[];
  mobs?: Record<string, DungeonDataMob>;
}

export interface DungeonState {
  startedAt: string | null;
  timeCorrectionMs: number;
  timeCorrectionServerTs: string | null;
  timeCorrectionClientTs: string | null;
  endedAt: string | null;
  name: string | null;
  id: number | null;
  difficulty: number | null;
  affixes: unknown;
  success: boolean | null;
  durationMs: number | null;
  completionSeconds: number | null;
  deaths: number | null;
  extra: Record<string, unknown>;
  data: DungeonData | null;
  completedPercent: number;
  killCount?: number | null;
  countedNpcDeaths: Set<string>;
  chickenizedNpcIds: Set<string>;
  bossSpawnedNpcIds: Set<string>;
}

export interface BossFightState {
  active: boolean;
  encounterId: number | null;
  startedAt: string | null;
}

export interface NpcDeathEntry {
  ts: string | null;
  npcId: string;
  npcName: string | null;
  killerId: string | null;
  killerName: string | null;
  killingAbilityId: number | null;
  killingAbility: string | null;
}

export interface ParserState {
  dungeon: DungeonState;
  players: Map<string, PlayerState>;
  encounters: EncounterState[];
  currentEncounter: EncounterState | null;
  npcDeaths: NpcDeathEntry[];
  rawCounters: Map<string, number>;
  dungeonPartyIds: Set<string>;
  collectingDungeonParty: boolean;
  currentPull: CurrentPullState;
  bossFight: BossFightState;
  recentSkillActivations: RecentSkillActivation[];
  recentSkillsPlayerId: string | null;
  recentSkillsPlayerName: string | null;
}

export type FinalizedDungeonState = Omit<DungeonState, 'countedNpcDeaths' | 'chickenizedNpcIds' | 'bossSpawnedNpcIds'> & {
  killCount: number | null;
  completedPercent: number;
};

export interface FinalizedState {
  dungeon: FinalizedDungeonState;
  timeCorrectionMs: number;
  timeCorrectionServerTs: string | null;
  timeCorrectionClientTs: string | null;
  players: Array<PlayerState & {
    abilities: SerializedAbilityStat[];
    combatAbilities: SerializedAbilityStat[];
    spiritHistory: SpiritSnapshot[];
    usesPerBoss: UsesPerBossEntry[];
  }>;
  recentSkills: RecentSkillActivation[];
  recentSkillsPlayerId: string | null;
  recentSkillsPlayerName: string | null;
  partyPlayerIds: string[];
  encounters: FinalizedEncounter[];
  npcDeaths: NpcDeathEntry[];
  currentPull: CurrentPullSummary;
  counters: Record<string, number>;
}

export interface LogDataPayload extends LogSourceInfo {
  ok: boolean;
  data?: FinalizedState;
  error?: string;
}

export interface OverlayApi {
  pickLogFile(): Promise<PickDirectoryResult>;
  reloadCurrentFile(): Promise<ReloadFileResult>;
  toggleOverlayLock(): Promise<{ locked: boolean }>;
  getCurrentFile(): Promise<LogSourceInfo>;
  getSkillCatalog(): Promise<SkillCatalog>;
  getLanguage(): Promise<LanguagePayload>;
  setLanguage(language: LanguageCode): Promise<LanguagePayload>;
  getPlayerPositionsSync(): GetPlayerPositionsSyncResult;
  savePlayerPositions(playerPositions: PlayerPositions): Promise<SavePlayerPositionsResult>;
  getOverlaySettingsSync(): GetOverlaySettingsSyncResult;
  saveOverlaySettings(partialSettings: Partial<OverlaySettings>): Promise<SaveOverlaySettingsResult>;
  onLogData(callback: (payload: LogDataPayload) => void): void;
  onWatchStatus(callback: (payload: WatchStatusPayload) => void): void;
  onOverlayMode(callback: (payload: OverlayModePayload) => void): void;
  onLanguageChanged(callback: (payload: LanguagePayload) => void): void;
  onOpenSettings(callback: (payload: OpenSettingsPayload) => void): void;
}

export interface RendererConstantsApi {
  STORAGE_KEY: string;
  SKILL_SELECTIONS_KEY: string;
  CARD_SCALE_KEY: string;
  PULL_PANEL_POSITION_KEY: string;
  RECENT_SKILLS_PANEL_POSITION_KEY: string;
  VISIBILITY_SETTINGS_KEY: string;
  CARD_SCALE_MIN: number;
  CARD_SCALE_MAX: number;
  CARD_SCALE_STEP: number;
  DEFAULT_PULL_PANEL_POSITION: Point;
  DEFAULT_RECENT_SKILLS_PANEL_POSITION: Point;
  DEFAULT_VISIBILITY_SETTINGS: OverlayVisibilitySettings;
  DEFAULT_RECENT_SKILLS_LIMIT: number;
  DEFAULT_CARD_SCALE: number;
  DEFAULT_OVERLAY_SETTINGS: OverlaySettings;
}

export interface RendererFormattersApi {
  clamp(value: number, min: number, max: number): number;
  escapeHtml(value: unknown): string;
  formatDurationMs(ms: number): string;
  formatNumber(currentLanguage: LanguageCode, value: unknown): string;
  formatPercent(currentLanguage: LanguageCode, value: unknown): string;
  formatTimeShort(currentLanguage: LanguageCode, ts: string | null | undefined): string;
  toAssetSrc(relPath: string | null | undefined): string;
}

export interface ApplyTranslationsContext {
  appearanceSettingsTitle: HTMLElement;
  currentLanguage: LanguageCode;
  filePathEl: HTMLElement;
  hudActive: boolean;
  languageLabel: HTMLElement;
  languageSelect: HTMLSelectElement;
  lastWatchStatusMessage: string;
  latestData: FinalizedState | null;
  logSettingsTitle: HTMLElement;
  overlayLocked: boolean;
  overlaySettingsTitle: HTMLElement;
  pickFileBtn: HTMLButtonElement;
  recentSkillsLimit: number;
  recentSkillsLimitInput: HTMLInputElement;
  recentSkillsLimitLabel: HTMLElement;
  reloadBtn: HTMLButtonElement;
  renderPlayers(players?: FinalizedState['players']): void;
  renderPullInfo(currentPull: CurrentPullSummary | null | undefined, dungeon: FinalizedDungeonState | null | undefined): void;
  renderRecentSkillsPanel(recentSkills?: RecentSkillActivation[]): void;
  renderSkillsModal(): void;
  setHudActiveState(active: boolean, foregroundExe?: string | null): void;
  settingsModalSubtitle: HTMLElement;
  settingsModalTitle: HTMLElement;
  showPartyToggle: HTMLInputElement | null;
  showPartyToggleLabel: HTMLElement | null;
  showPullToggle: HTMLInputElement | null;
  showPullToggleLabel: HTMLElement | null;
  showRecentSkillsToggle: HTMLInputElement | null;
  showRecentSkillsToggleLabel: HTMLElement | null;
  skillsBtn: HTMLButtonElement;
  skillsModalSubtitle: HTMLElement;
  skillsModalTitle: HTMLElement;
  toggleLockBtn: HTMLButtonElement;
  updateOverlayVisibility(): void;
  updatePullPanelVisibility(): void;
  updateRecentSkillsPanelVisibility(): void;
  visibilitySettings: OverlayVisibilitySettings;
  watchStatusEl: HTMLElement;
}

export interface RendererI18nApi {
  I18N: Record<LanguageCode, Record<string, string>>;
  applyTranslations(ctx: ApplyTranslationsContext): void;
  setLogSourceText(filePathEl: HTMLElement, translate: (key: string) => string, source: LogSourceInfo | null | undefined): void;
  t(currentLanguage: LanguageCode, key: string): string;
}

export interface PullPanelVisibilityArgs {
  filePathEl: HTMLElement;
  latestData: FinalizedState | null;
  pullInfoEl: HTMLElement;
  translate: (key: string) => string;
  visibilitySettings: OverlayVisibilitySettings;
}

export interface RecentSkillsPanelVisibilityArgs {
  filePathEl: HTMLElement;
  latestData: FinalizedState | null;
  recentSkillsPanelEl: HTMLElement;
  translate: (key: string) => string;
  visibilitySettings: OverlayVisibilitySettings;
}

export interface RenderRecentSkillsPanelArgs {
  currentLanguage: LanguageCode;
  getCardWidthForIconCount(iconCount: number): number;
  recentSkills: RecentSkillActivation[];
  recentSkillsLimit: number;
  recentSkillsPanelEl: HTMLElement;
  skillCatalog: SkillCatalog;
  translate: (key: string) => string;
  updateRecentSkillsPanelVisibility(): void;
}

export interface RenderPullInfoArgs {
  currentLanguage: LanguageCode;
  currentPull: CurrentPullSummary | null | undefined;
  dungeon: FinalizedDungeonState | null | undefined;
  pullInfoEl: HTMLElement;
  renderRecentSkillsPanelEmpty(): void;
  translate: (key: string) => string;
  updatePullPanelVisibility(): void;
  updateRecentSkillsPanelVisibility(): void;
}

export interface RendererPanelsApi {
  getAbilityCatalogEntry(skillCatalog: SkillCatalog, classId: number | null, abilityId: number | null): SkillCatalogAbility | null;
  renderPullInfo(args: RenderPullInfoArgs): void;
  renderRecentSkillsPanel(args: RenderRecentSkillsPanelArgs): void;
  resolveRecentSkillIcon(skillCatalog: SkillCatalog, entry: RecentSkillActivation | null | undefined): string;
  updatePullPanelVisibility(args: PullPanelVisibilityArgs): void;
  updateRecentSkillsPanelVisibility(args: RecentSkillsPanelVisibilityArgs): void;
}

export interface OverlaySettingsController {
  normalizeCardScaleValue(value: unknown): number;
  normalizePosition(value: unknown, fallback?: Point): Point;
  normalizeRecentSkillsLimit(value: unknown): number;
  normalizeSkillSelections(value: unknown): SkillSelectionMap;
  normalizeVisibilitySettings(value: unknown): OverlayVisibilitySettings;
  loadCardScale(): number;
  loadPositions(): PlayerPositions;
  loadPullPanelPosition(): Point;
  loadRecentSkillsLimit(): number;
  loadRecentSkillsPanelPosition(): Point;
  loadSkillSelections(): SkillSelectionMap;
  loadVisibilitySettings(): OverlayVisibilitySettings;
  saveCardScale(cardScale: number): void;
  savePositions(positions: PlayerPositions): void;
  savePullPanelPosition(position: Point): void;
  saveRecentSkillsLimit(recentSkillsLimit: number): void;
  saveRecentSkillsPanelPosition(position: Point): void;
  saveSkillSelections(selectedSkillsByClass: SkillSelectionMap): void;
  saveVisibilitySettings(visibilitySettings: OverlayVisibilitySettings): void;
}

export interface RendererSettingsApi {
  createOverlaySettingsController(api: OverlayApi): OverlaySettingsController;
}

export interface MakeCardDraggableArgs {
  card: HTMLElement;
  dragHandle: HTMLElement;
  getOverlayLocked(): boolean;
  getPlayerLayoutKey(slotIndex?: number): string;
  layoutKey?: string;
  positions: PlayerPositions;
  savePositions(positions: PlayerPositions): void;
}

export interface InitializePanelArgs {
  panel: HTMLElement;
  position: Point;
  getDragHandle(): HTMLElement | null;
  getOverlayLocked(): boolean;
  savePosition?(position: Point): void;
  fallbackSavePosition?(position: Point): void;
}

export interface RendererLayoutApi {
  applyCardLayout(card: HTMLElement, cardScale: number, iconCount?: number): void;
  getCardWidthForIconCount(cardScale: number, iconCount: number): number;
  getDefaultPosition(index: number): Point;
  getScaledMetrics(cardScale: number): {
    scale: number;
    iconSize: number;
    iconGap: number;
    horizontalPadding: number;
    baseMinWidth: number;
  };
  initializePanel(args: InitializePanelArgs): void;
  makeCardDraggable(args: MakeCardDraggableArgs): void;
}

export interface PlayerCardRenderer {
  renderPlayers(players?: FinalizedState['players']): void;
  tickCooldowns(): void;
}

export interface PlayerCardRendererDeps {
  applyCardLayout(card: HTMLElement, cardScale: number, iconCount?: number): void;
  cardMap: Map<string, HTMLElement>;
  formatNumber(value: unknown): string;
  getCardScale(): number;
  getDefaultPosition(index: number): Point;
  getLatestData(): FinalizedState | null;
  getOverlayLocked(): boolean;
  getPartySlotIndex(player: PlayerState, index?: number): number;
  getPlayerLayoutKey(slotIndex?: number): string;
  getSelectedSkillsByClass(): SkillSelectionMap;
  getSkillCatalog(): SkillCatalog;
  loadPositions(): PlayerPositions;
  makeCardDraggable(args: MakeCardDraggableArgs): void;
  playersContainer: HTMLElement;
  renderPullInfo(currentPull: CurrentPullSummary | null | undefined, dungeon: FinalizedDungeonState | null | undefined): void;
  renderRecentSkillsPanel(recentSkills?: RecentSkillActivation[]): void;
  savePositions(positions: PlayerPositions): void;
  t(key: string): string;
}

export interface RendererPlayerCardsApi {
  createPlayerCardRenderer(deps: PlayerCardRendererDeps): PlayerCardRenderer;
}

export interface RenderSkillsModalArgs {
  latestData(): FinalizedState | null;
  renderPlayers(players?: FinalizedState['players']): void;
  saveSkillSelections(): void;
  selectedSkillsByClass: SkillSelectionMap;
  skillCatalog: SkillCatalog;
  skillsCatalogEl: HTMLElement;
  t(key: string): string;
}

export interface RendererSkillsModalApi {
  renderSkillsModal(args: RenderSkillsModalArgs): void;
}
