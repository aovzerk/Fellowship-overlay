declare interface BufferLike {
  length: number;
  toString(encoding?: string): string;
  subarray(start: number, end?: number): BufferLike;
  lastIndexOf(value: number, byteOffset?: number): number;
}

declare const Buffer: {
  alloc(size: number): BufferLike;
  allocUnsafe(size: number): BufferLike;
  concat(chunks: BufferLike[]): BufferLike;
};

declare const require: any;
declare const module: any;
declare const __dirname: string;
declare const process: any;

declare interface Window {
  api: import('./overlay').OverlayApi;
  OverlayRendererConstants: import('./overlay').RendererConstantsApi;
  OverlayRendererFormatters: import('./overlay').RendererFormattersApi;
  OverlayRendererI18n: import('./overlay').RendererI18nApi;
  OverlayRendererPanels: import('./overlay').RendererPanelsApi;
  OverlayRendererSettings: import('./overlay').RendererSettingsApi;
  OverlayRendererLayout: import('./overlay').RendererLayoutApi;
  OverlayRendererPlayerCards: import('./overlay').RendererPlayerCardsApi;
  OverlayRendererSkillsModal: import('./overlay').RendererSkillsModalApi;
}


type Nullable<T> = import('./overlay').Nullable<T>;
type LanguageCode = import('./overlay').LanguageCode;
type Point = import('./overlay').Point;
type PlayerPositions = import('./overlay').PlayerPositions;
type SkillSelectionMap = import('./overlay').SkillSelectionMap;
type OverlayVisibilitySettings = import('./overlay').OverlayVisibilitySettings;
type OverlayPanelPositions = import('./overlay').OverlayPanelPositions;
type OverlaySettings = import('./overlay').OverlaySettings;
type LogSourceInfo = import('./overlay').LogSourceInfo;
type WatchStatusPayload = import('./overlay').WatchStatusPayload;
type OverlayModePayload = import('./overlay').OverlayModePayload;
type LanguagePayload = import('./overlay').LanguagePayload;
type OpenSettingsPayload = import('./overlay').OpenSettingsPayload;
type PickDirectoryResult = import('./overlay').PickDirectoryResult;
type ReloadFileResult = import('./overlay').ReloadFileResult;
type GetOverlaySettingsSyncResult = import('./overlay').GetOverlaySettingsSyncResult;
type GetPlayerPositionsSyncResult = import('./overlay').GetPlayerPositionsSyncResult;
type SaveOverlaySettingsResult = import('./overlay').SaveOverlaySettingsResult;
type SavePlayerPositionsResult = import('./overlay').SavePlayerPositionsResult;
type AssetBackedEntry = import('./overlay').AssetBackedEntry;
type SkillCatalogAbility = import('./overlay').SkillCatalogAbility;
type SkillCatalogClass = import('./overlay').SkillCatalogClass;
type SkillCatalog = import('./overlay').SkillCatalog;
type SpiritSnapshot = import('./overlay').SpiritSnapshot;
type AbilityStat = import('./overlay').AbilityStat;
type SerializedAbilityStat = import('./overlay').SerializedAbilityStat;
type RecentSkillActivation = import('./overlay').RecentSkillActivation;
type RelicMeta = import('./overlay').RelicMeta;
type PlayerRelicState = import('./overlay').PlayerRelicState;
type PlayerStones = import('./overlay').PlayerStones;
type UsesPerBossEntry = import('./overlay').UsesPerBossEntry;
type PlayerState = import('./overlay').PlayerState;
type PlayerValueAmount = import('./overlay').PlayerValueAmount;
type EncounterAbilitiesByPlayer = import('./overlay').EncounterAbilitiesByPlayer;
type NpcPercentMeta = import('./overlay').NpcPercentMeta;
type CurrentPullNpc = import('./overlay').CurrentPullNpc;
type CurrentPullState = import('./overlay').CurrentPullState;
type CurrentPullSummary = import('./overlay').CurrentPullSummary;
type EncounterState = import('./overlay').EncounterState;
type FinalizedEncounter = import('./overlay').FinalizedEncounter;
type DungeonDataMob = import('./overlay').DungeonDataMob;
type DungeonData = import('./overlay').DungeonData;
type DungeonState = import('./overlay').DungeonState;
type BossFightState = import('./overlay').BossFightState;
type NpcDeathEntry = import('./overlay').NpcDeathEntry;
type ParserState = import('./overlay').ParserState;
type FinalizedDungeonState = import('./overlay').FinalizedDungeonState;
type FinalizedState = import('./overlay').FinalizedState;
type LogDataPayload = import('./overlay').LogDataPayload;
type OverlayApi = import('./overlay').OverlayApi;
type RendererConstantsApi = import('./overlay').RendererConstantsApi;
type RendererFormattersApi = import('./overlay').RendererFormattersApi;
type ApplyTranslationsContext = import('./overlay').ApplyTranslationsContext;
type RendererI18nApi = import('./overlay').RendererI18nApi;
type PullPanelVisibilityArgs = import('./overlay').PullPanelVisibilityArgs;
type RecentSkillsPanelVisibilityArgs = import('./overlay').RecentSkillsPanelVisibilityArgs;
type RenderRecentSkillsPanelArgs = import('./overlay').RenderRecentSkillsPanelArgs;
type RenderPullInfoArgs = import('./overlay').RenderPullInfoArgs;
type RendererPanelsApi = import('./overlay').RendererPanelsApi;
type OverlaySettingsController = import('./overlay').OverlaySettingsController;
type RendererSettingsApi = import('./overlay').RendererSettingsApi;
type MakeCardDraggableArgs = import('./overlay').MakeCardDraggableArgs;
type InitializePanelArgs = import('./overlay').InitializePanelArgs;
type RendererLayoutApi = import('./overlay').RendererLayoutApi;
type PlayerCardRenderer = import('./overlay').PlayerCardRenderer;
type PlayerCardRendererDeps = import('./overlay').PlayerCardRendererDeps;
type RendererPlayerCardsApi = import('./overlay').RendererPlayerCardsApi;
type RenderSkillsModalArgs = import('./overlay').RenderSkillsModalArgs;
type RendererSkillsModalApi = import('./overlay').RendererSkillsModalApi;
