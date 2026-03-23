import type {
  BossFightState,
  CurrentPullNpc,
  CurrentPullState,
  CurrentPullSummary,
  DungeonData,
  DungeonState,
  NpcPercentMeta,
  ParserState,
} from '../../types/overlay';

import { isNpcId, parseTs } from './parser-line-utils';
import { loadDungeonDataByName } from './game-database';
const CURRENT_PULL_RESET_MS = 8000;
const CHICKENIZE_RELIC_ID = 1478;
const BOSS_SUMMON_MIN_DELAY_MS = 12000;


function extractNpcTemplateId(unitId: string | null | undefined): number | null {
  if (!isNpcId(unitId)) return null;
  const match = String(unitId).match(/^Npc-[^-]+-(\d+)$/i);
  return match ? Number(match[1]) : null;
}

function getNpcPercentMeta(state: ParserState, unitId: string, fallbackName: string | null = null): NpcPercentMeta | null {
  const templateId = extractNpcTemplateId(unitId);
  if (templateId == null) return null;
  const dungeonData = state?.dungeon?.data;
  const mob = dungeonData?.mobs?.[String(templateId)];
  if (!mob) return null;
  return {
    templateId,
    name: mob.name || fallbackName || `NPC ${templateId}`,
    score: Number(mob.score) || 0,
    percent: Number(mob.percent) || 0,
  };
}

function getBossTemplateIds(state: ParserState): Set<number> {
  const raw = state?.dungeon?.data?.bossesID;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.map((value) => Number(value)).filter((value) => Number.isFinite(value)));
}

function isBossTemplateId(state: ParserState, templateId: number | null): boolean {
  if (templateId == null) return false;
  return getBossTemplateIds(state).has(Number(templateId));
}

function getBossEncounterNames(state: ParserState): Set<string> {
  const bossIds = getBossTemplateIds(state);
  const mobs = state?.dungeon?.data?.mobs;
  const names = new Set<string>();
  if (!mobs) return names;
  for (const bossId of bossIds) {
    const name = String(mobs[String(bossId)]?.name || '').trim().toLowerCase();
    if (name) names.add(name);
  }
  return names;
}

function isBossEncounterName(state: ParserState, encounterName: string | null): boolean {
  const bossNames = getBossEncounterNames(state);
  if (!bossNames.size) return false;
  return String(encounterName || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .some((value) => bossNames.has(value));
}

function createCurrentPull(): CurrentPullState {
  return {
    startedAt: null,
    lastCombatAtMs: null,
    npcMap: new Map<string, CurrentPullNpc>(),
  };
}

function createBossFightState(): BossFightState {
  return {
    active: false,
    encounterId: null,
    startedAt: null,
  };
}

function createDungeonState(): DungeonState {
  return {
    startedAt: null,
    timeCorrectionMs: 0,
    timeCorrectionServerTs: null,
    timeCorrectionClientTs: null,
    endedAt: null,
    name: null,
    id: null,
    difficulty: null,
    affixes: [],
    success: null,
    durationMs: null,
    completionSeconds: null,
    deaths: null,
    extra: {},
    data: null,
    completedPercent: 0,
    countedNpcDeaths: new Set<string>(),
    chickenizedNpcIds: new Set<string>(),
    bossSpawnedNpcIds: new Set<string>(),
  };
}

function resetDungeonScope(state: ParserState): void {
  state.dungeon = createDungeonState();
  state.players = new Map();
  state.encounters = [];
  state.currentEncounter = null;
  state.npcDeaths = [];
  state.dungeonPartyIds = new Set();
  state.collectingDungeonParty = false;
  state.currentPull = createCurrentPull();
  state.bossFight = createBossFightState();
  state.recentSkillActivations = [];
  state.recentSkillsPlayerId = null;
  state.recentSkillsPlayerName = null;
}

function isChickenizeAbility(abilityId: number | null, abilityName: string | null | undefined): boolean {
  if (Number(abilityId) === CHICKENIZE_RELIC_ID) return true;
  return String(abilityName || '').trim().toLowerCase() === 'chickenize';
}

function shouldTreatNpcAsBossSpawned(state: ParserState, templateId: number | null, ts: string | null = null): boolean {
  if (templateId == null) return false;
  if (!state?.currentEncounter || !state?.bossFight?.active) return false;
  if (isBossTemplateId(state, templateId)) return false;

  const encounterStartedAtMs = parseTs(state?.bossFight?.startedAt);
  const seenAtMs = parseTs(ts);
  if (encounterStartedAtMs == null || seenAtMs == null) return false;

  return seenAtMs - encounterStartedAtMs >= BOSS_SUMMON_MIN_DELAY_MS;
}

function resetCurrentPull(state: ParserState, tsMs: number | null = null): void {
  state.currentPull = createCurrentPull();
  if (tsMs != null) {
    state.currentPull.startedAt = new Date(tsMs).toISOString();
    state.currentPull.lastCombatAtMs = tsMs;
  }
}

function touchCurrentPull(state: ParserState, ts: string, npcId: string | null | undefined, npcName: string | null | undefined): void {
  const tsMs = parseTs(ts);
  if (tsMs == null || !npcId) return;
  if (!state.currentPull) resetCurrentPull(state);
  const lastCombatAtMs = state.currentPull.lastCombatAtMs;
  const existingMobs = [...state.currentPull.npcMap.values()];
  const lastDeathMs = existingMobs
    .map((mob) => parseTs(mob.deadAt))
    .filter((value): value is number => value != null)
    .reduce((max, value) => Math.max(max, value), 0);
  const allKnownMobsDead = existingMobs.length > 0 && existingMobs.every((mob) => !!mob.deadAt);
  if (lastCombatAtMs != null && tsMs - lastCombatAtMs > CURRENT_PULL_RESET_MS) {
    resetCurrentPull(state, tsMs);
  } else if (allKnownMobsDead && lastDeathMs && tsMs - lastDeathMs > 500) {
    resetCurrentPull(state, tsMs);
  }
  if (!state.currentPull.startedAt) state.currentPull.startedAt = ts;
  state.currentPull.lastCombatAtMs = tsMs;

  const meta = getNpcPercentMeta(state, npcId, npcName || null) || {
    templateId: extractNpcTemplateId(npcId),
    name: npcName || `NPC ${extractNpcTemplateId(npcId) || '?'}`,
    score: 0,
    percent: 0,
  };

  let npc = state.currentPull.npcMap.get(npcId) || null;
  if (!npc) {
    const bossSpawned = shouldTreatNpcAsBossSpawned(state, meta.templateId, ts);
    npc = {
      unitId: npcId,
      templateId: meta.templateId,
      name: meta.name || npcName || `NPC ${meta.templateId || '?'}`,
      score: Number(meta.score) || 0,
      percent: Number(meta.percent) || 0,
      firstSeenAt: ts,
      lastSeenAt: ts,
      deadAt: null,
      chickenizedAt: null,
      chickenized: false,
      bossSpawnedAt: bossSpawned ? ts : null,
      bossSpawned,
    };
    if (bossSpawned) state.dungeon.bossSpawnedNpcIds.add(npcId);
    state.currentPull.npcMap.set(npcId, npc);
  } else {
    npc.lastSeenAt = ts;
    if (meta.name) npc.name = meta.name;
    if (meta.templateId != null) npc.templateId = meta.templateId;
    if (Number.isFinite(meta.score)) npc.score = Number(meta.score);
    if (Number.isFinite(meta.percent)) npc.percent = Number(meta.percent);
    if (npc.chickenizedAt) npc.chickenized = true;
    if (npc.bossSpawnedAt || state.dungeon.bossSpawnedNpcIds.has(npcId)) npc.bossSpawned = true;
  }
}

function markNpcChickenized(state: ParserState, ts: string, npcId: string | null | undefined, npcName: string | null | undefined): void {
  if (!npcId || !isNpcId(npcId)) return;
  touchCurrentPull(state, ts, npcId, npcName);
  const npc = state.currentPull?.npcMap?.get(npcId);
  if (npc) {
    npc.chickenizedAt = npc.chickenizedAt || ts;
    npc.chickenized = true;
  }
  if (!state.dungeon.chickenizedNpcIds) state.dungeon.chickenizedNpcIds = new Set();
  state.dungeon.chickenizedNpcIds.add(npcId);
}

function markCurrentPullDeath(state: ParserState, ts: string, npcId: string, npcName: string | null | undefined): void {
  const tsMs = parseTs(ts);
  if (tsMs == null) return;
  touchCurrentPull(state, ts, npcId, npcName);
  const npc = state.currentPull?.npcMap?.get(npcId);
  if (npc) npc.deadAt = ts;
}

function buildCurrentPullSummary(state: ParserState): CurrentPullSummary {
  const pull = state.currentPull;
  if (!pull?.npcMap?.size) {
    return {
      startedAt: null,
      lastCombatAt: null,
      totalPercent: 0,
      alivePercent: 0,
      killedPercent: 0,
      mobCount: 0,
      aliveCount: 0,
      mobs: [],
    };
  }

  const mobs = [...pull.npcMap.values()]
    .map((mob) => ({ ...mob, alive: !mob.deadAt, effectivePercent: (mob.chickenized || mob.bossSpawned) ? 0 : (Number(mob.percent) || 0) }))
    .sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      if (b.percent !== a.percent) return b.percent - a.percent;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

  const totalPercent = mobs.reduce((sum, mob) => sum + (Number(mob.effectivePercent) || 0), 0);
  const alivePercent = mobs.reduce((sum, mob) => sum + (mob.alive ? (Number(mob.effectivePercent) || 0) : 0), 0);
  const chickenizedMobs = mobs.filter((mob) => mob.chickenized);
  const aliveChickenizedMobs = chickenizedMobs.filter((mob) => mob.alive);
  const chickenizedOriginalPercent = chickenizedMobs.reduce((sum, mob) => sum + (Number(mob.percent) || 0), 0);
  const aliveChickenizedOriginalPercent = aliveChickenizedMobs.reduce((sum, mob) => sum + (Number(mob.percent) || 0), 0);

  return {
    startedAt: pull.startedAt,
    lastCombatAt: pull.lastCombatAtMs != null ? new Date(pull.lastCombatAtMs).toISOString() : null,
    totalPercent,
    alivePercent,
    killedPercent: totalPercent - alivePercent,
    mobCount: mobs.length,
    aliveCount: mobs.filter((mob) => mob.alive).length,
    chickenizedCount: chickenizedMobs.length,
    aliveChickenizedCount: aliveChickenizedMobs.length,
    chickenizedOriginalPercent,
    aliveChickenizedOriginalPercent,
    mobs,
  };
}

export {
  buildCurrentPullSummary,
  createBossFightState,
  createCurrentPull,
  createDungeonState,
  extractNpcTemplateId,
  getNpcPercentMeta,
  isBossEncounterName,
  isBossTemplateId,
  isChickenizeAbility,
  loadDungeonDataByName,
  markCurrentPullDeath,
  markNpcChickenized,
  resetCurrentPull,
  resetDungeonScope,
  touchCurrentPull,
};
