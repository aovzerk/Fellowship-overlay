import type { FinalizedState, NpcDeathEntry, ParserState } from '../../types/overlay';
import type { ParserCacheEntry } from '../../types/main-process';

import * as fs from 'fs';

import {
  createBossFightState,
  getNpcPercentMeta,
  isBossEncounterName,
  isChickenizeAbility,
  markCurrentPullDeath,
  markNpcChickenized,
  resetCurrentPull,
  resetDungeonScope,
  touchCurrentPull,
} from './parser-dungeon';
import {
  extractRelicsFromCombatantInfo,
  markRelicUse,
  resetPlayerRelicCooldowns,
  setPlayerRelics,
} from './parser-relics';
import {
  addAbilityStat,
  addEncounterAbilityStat,
  addRecentSkillActivation,
  addSpiritSnapshot,
  addToMapNumber,
  createEncounter,
  createState,
  ensurePlayer,
  extractSpiritFromResourcePart,
  extractSpiritStatFromCombatantInfo,
  getActorKey,
  isNpcId,
  isPlayerId,
  noteBossNpcInLine,
  parseEncounterName,
  setPlayerClass,
  setPlayerStones,
  splitLogLine,
  stopPartyCollectionForEvent,
  toNumber,
  unquote,
} from './parser-state';
import { findRecentDungeonParseOffset, getFileIdentity, processFileRange } from './parser-file';
import { parseTs } from './parser-line-utils';
import { finalizeState } from './parser-finalize';
import { loadDungeonData } from './game-database';

const MAX_STORED_ENCOUNTERS = 2;
const MAX_STORED_NPC_DEATHS = 400;
const MAX_STORED_ENCOUNTER_NPC_DEATHS = 200;
const NPC_UNDERFLOW_FALLBACK_MS = 1500;
const parserCache = new Map<string, ParserCacheEntry>();

function registerNpcDeath(state: ParserState, death: NpcDeathEntry, updateCurrentPull = true): void {
  const deathTs = death.ts || state.latestLogTs || new Date().toISOString();
  const normalizedDeath: NpcDeathEntry = { ...death, ts: deathTs };
  const alreadyCounted = state.dungeon.countedNpcDeaths.has(normalizedDeath.npcId);

  if (updateCurrentPull) {
    markCurrentPullDeath(state, deathTs, normalizedDeath.npcId, normalizedDeath.npcName || '');
  } else {
    const npc = state.currentPull?.npcMap?.get(normalizedDeath.npcId);
    if (npc && !npc.deadAt) npc.deadAt = deathTs;
  }

  if (alreadyCounted) return;

  state.npcDeaths.push(normalizedDeath);
  if (state.npcDeaths.length > MAX_STORED_NPC_DEATHS) {
    state.npcDeaths.splice(0, state.npcDeaths.length - MAX_STORED_NPC_DEATHS);
  }

  state.dungeon.countedNpcDeaths.add(normalizedDeath.npcId);
  const meta = getNpcPercentMeta(state, normalizedDeath.npcId, normalizedDeath.npcName || '');
  const wasChickenized = state.dungeon?.chickenizedNpcIds?.has(normalizedDeath.npcId);
  const wasBossSpawned = state.dungeon?.bossSpawnedNpcIds?.has(normalizedDeath.npcId);
  const percentToAdd = (wasChickenized || wasBossSpawned) ? 0 : (Number(meta?.percent) || 0);
  if (percentToAdd) state.dungeon.completedPercent += percentToAdd;

  if (state.currentEncounter) {
    state.currentEncounter.npcDeaths.push(normalizedDeath);
    if (state.currentEncounter.npcDeaths.length > MAX_STORED_ENCOUNTER_NPC_DEATHS) {
      state.currentEncounter.npcDeaths.splice(0, state.currentEncounter.npcDeaths.length - MAX_STORED_ENCOUNTER_NPC_DEATHS);
    }
  }
}

function markNpcUnderflowIfNeeded(
  state: ParserState,
  ts: string,
  npcId: string | null | undefined,
  npcName: string | null | undefined,
  targetCurrentHpRaw: unknown,
  targetMaxHpRaw: unknown,
): void {
  if (!isNpcId(npcId)) return;
  const targetCurrentHp = Number(targetCurrentHpRaw);
  const targetMaxHp = Number(targetMaxHpRaw);
  if (!Number.isFinite(targetCurrentHp) || !Number.isFinite(targetMaxHp) || targetMaxHp <= 0) return;
  if (targetCurrentHp <= targetMaxHp) return;

  touchCurrentPull(state, ts, npcId, npcName || '');
  const npc = state.currentPull?.npcMap?.get(npcId);
  if (npc && !npc.deadAt && !npc.suspectedDeadAt) {
    npc.suspectedDeadAt = ts;
  }
}

function resolvePendingNpcUnderflowDeaths(state: ParserState, ts: string | null, force = false): void {
  const tsMs = parseTs(ts);
  if (tsMs == null) return;

  for (const npc of state.currentPull?.npcMap?.values?.() || []) {
    if (!npc || npc.deadAt || !npc.suspectedDeadAt) continue;
    const suspectedMs = parseTs(npc.suspectedDeadAt);
    if (suspectedMs == null) continue;
    if (!force && (tsMs - suspectedMs) < NPC_UNDERFLOW_FALLBACK_MS) continue;

    registerNpcDeath(state, {
      ts: npc.suspectedDeadAt,
      npcId: npc.unitId,
      npcName: npc.name || null,
      killerId: null,
      killerName: null,
      killingAbilityId: null,
      killingAbility: null,
    }, false);

    npc.deadAt = npc.deadAt || npc.suspectedDeadAt || ts;
    npc.suspectedDeadAt = null;
  }
}

function updateSpiritFromResourcePart(
  state: ParserState,
  playerId: string | null | undefined,
  playerName: string | null | undefined,
  ts: string,
  raw: unknown,
  abilityId: number | null = null,
  abilityName: string | null = null,
): boolean {
  if (!isPlayerId(playerId)) return false;

  const spirit = extractSpiritFromResourcePart(raw);
  if (!spirit) return false;

  const player = ensurePlayer(state, playerId, playerName);
  addSpiritSnapshot(player, ts, spirit.current, spirit.max, abilityId, abilityName);
  return true;
}

function processLine(state: ParserState, line: string): void {
  if (!line || !line.trim()) return;

  const parts: string[] = splitLogLine(line);
  if (parts.length < 2) return;

  const ts = parts[0];
  const event = parts[1] || null;

  if (ts) {
    state.latestLogTs = ts;
    resolvePendingNpcUnderflowDeaths(state, ts);
  }

  if (event) {
    state.rawCounters.set(event, (state.rawCounters.get(event) || 0) + 1);
  }

  if (event && event !== 'COMBATANT_INFO' && event !== 'DUNGEON_START') {
    stopPartyCollectionForEvent(state, event);
  }

  noteBossNpcInLine(state, parts);

  switch (event) {
    case 'DUNGEON_START': {
      const dungeonName = String(unquote(parts[2]) || '');
      const clientTs = parts[7] || null;
      const serverTsMs = Date.parse(String(ts || ''));
      const clientTsMs = Date.parse(String(clientTs || ''));
      const timeCorrectionMs = Number.isFinite(serverTsMs) && Number.isFinite(clientTsMs)
        ? serverTsMs - clientTsMs
        : 0;

      resetDungeonScope(state);
      state.dungeon.startedAt = ts;
      state.dungeon.timeCorrectionMs = timeCorrectionMs;
      state.dungeon.timeCorrectionServerTs = ts || null;
      state.dungeon.timeCorrectionClientTs = clientTs;
      state.dungeon.endedAt = null;
      state.dungeon.name = dungeonName;
      state.dungeon.id = toNumber(parts[3]);
      state.dungeon.difficulty = toNumber(parts[4]);
      state.dungeon.data = loadDungeonData(state.dungeon.id, dungeonName);
      state.dungeon.affixes = parts[5];
      state.dungeon.success = false;
      state.dungeon.completedPercent = 0;
      state.collectingDungeonParty = true;
      resetCurrentPull(state);
      break;
    }
    case 'DUNGEON_END': {
      resolvePendingNpcUnderflowDeaths(state, ts, true);
      state.dungeon.endedAt = ts;
      state.dungeon.name = String(unquote(parts[2]) || '');
      state.dungeon.id = toNumber(parts[3]);
      state.dungeon.difficulty = toNumber(parts[4]);
      state.dungeon.data = loadDungeonData(state.dungeon.id, state.dungeon.name);
      state.dungeon.affixes = parts[5];
      state.dungeon.success = parts[6] === '1';
      state.dungeon.durationMs = toNumber(parts[7]);
      state.dungeon.completionSeconds = toNumber(parts[8]);
      state.dungeon.deaths = toNumber(parts[9]);
      state.dungeon.extra = { chestCount: toNumber(parts[10]) };
      state.collectingDungeonParty = false;
      state.bossFight = createBossFightState();
      state.players.forEach((player) => {
        resetPlayerRelicCooldowns(player);
        player.spiritRegenPerSecond = 0;
      });
      break;
    }
    case 'ZONE_CHANGE': {
      resolvePendingNpcUnderflowDeaths(state, ts, true);
      const dungeonName = String(unquote(parts[2]) || '');
      const dungeonId = toNumber(parts[3]);
      const dungeonData = loadDungeonData(dungeonId, dungeonName);
      if (dungeonData) {
        resetDungeonScope(state);
      }
      state.dungeon.name = dungeonName;
      state.dungeon.id = toNumber(parts[3]);
      state.dungeon.difficulty = toNumber(parts[4]);
      state.dungeon.data = dungeonData;
      state.dungeon.completedPercent = 0;
      break;
    }
    case 'COMBATANT_INFO': {
      const unitId = parts[3];
      const name = String(unquote(parts[4]) || '');
      const classId = toNumber(parts[6]);
      if (isPlayerId(unitId)) {
        const player = ensurePlayer(state, unitId, name);
        setPlayerClass(player, classId);
        setPlayerStones(player, parts[10]);
        setPlayerRelics(player, extractRelicsFromCombatantInfo(parts));
        const spiritStatValue = extractSpiritStatFromCombatantInfo(parts[8]);
        if (spiritStatValue != null) {
          player.spiritStatValue = spiritStatValue;
          player.spiritRegenPerSecond = 0.3 + (spiritStatValue / 100);
        }

        if (state.collectingDungeonParty) {
          state.dungeonPartyIds.add(unitId);
          if (!state.recentSkillsPlayerId) {
            state.recentSkillsPlayerId = unitId;
            state.recentSkillsPlayerName = name || null;
          }
        }
      }
      break;
    }
    case 'ENCOUNTER_START': {
      const encounterId = toNumber(parts[2]);
      const encounterName = parseEncounterName(parts[3]);
      const enc = createEncounter(encounterName, encounterId, ts);
      state.currentEncounter = enc;
      state.encounters.push(enc);
      if (state.encounters.length > MAX_STORED_ENCOUNTERS) {
        state.encounters.splice(0, state.encounters.length - MAX_STORED_ENCOUNTERS);
      }
      state.collectingDungeonParty = false;
      state.bossFight = {
        active: isBossEncounterName(state, encounterName),
        encounterId,
        startedAt: ts,
      };
      break;
    }
    case 'ENCOUNTER_END': {
      resolvePendingNpcUnderflowDeaths(state, ts, true);
      const encounterId = toNumber(parts[2]);
      const success = parts[4] === '1';
      const enc = state.currentEncounter || state.encounters[state.encounters.length - 1];
      if (enc) {
        enc.id = enc.id ?? encounterId;
        enc.endedAt = ts;
        enc.success = success;
      }
      state.currentEncounter = null;
      state.bossFight = createBossFightState();
      break;
    }
    case 'ABILITY_ACTIVATED':
    case 'ABILITY_CAST_START':
    case 'ABILITY_CAST_SUCCESS':
    case 'ABILITY_CAST_FAIL':
    case 'ABILITY_CHANNEL_START':
    case 'ABILITY_CHANNEL_SUCCESS':
    case 'ABILITY_CHANNEL_FAIL': {
      const sourceId = parts[2];
      const sourceName = String(unquote(parts[3]) || '');
      const abilityId = toNumber(parts[4]);
      const abilityName = String(unquote(parts[5]) || '');
      const targetId = parts[7];
      const targetName = String(unquote(parts[8]) || '');
      if (event === 'ABILITY_ACTIVATED' && isPlayerId(sourceId) && abilityName) {
        const player = ensurePlayer(state, sourceId, sourceName);
        addAbilityStat(player, abilityId, abilityName, 'activation', 0, ts);
        addEncounterAbilityStat(state.currentEncounter, sourceId, sourceName, abilityId, abilityName, 'activation', 0, ts);
        markRelicUse(player, abilityId, ts);
        addRecentSkillActivation(state, player, abilityId, abilityName, ts);
        if (isChickenizeAbility(abilityId, abilityName) && isNpcId(targetId)) {
          markNpcChickenized(state, ts, targetId, targetName);
        }
      }
      updateSpiritFromResourcePart(state, sourceId, sourceName, ts, parts[15], abilityId, abilityName);
      break;
    }
    case 'EVENT_INVALID': {
      const sourceId = parts[2];
      const sourceName = String(unquote(parts[3]) || '');
      const targetId = parts[4];
      const targetName = String(unquote(parts[5]) || '');
      const abilityId = toNumber(parts[6]);
      const abilityName = String(unquote(parts[7]) || '');
      updateSpiritFromResourcePart(state, sourceId, sourceName, ts, parts[22], abilityId, abilityName);
      updateSpiritFromResourcePart(state, targetId, targetName, ts, parts[29], abilityId, abilityName);
      break;
    }
    case 'ABILITY_DAMAGE':
    case 'SWING_DAMAGE':
    case 'ABILITY_PERIODIC_DAMAGE': {
      const sourceId = parts[2];
      const sourceName = String(unquote(parts[3]) || '');
      const targetId = parts[4];
      const targetName = String(unquote(parts[5]) || '');
      const abilityId = toNumber(parts[6]);
      const abilityName = String(unquote(parts[7]) || '');
      const amount = toNumber(parts[9]) || 0;
      if (isNpcId(sourceId) && isPlayerId(targetId)) touchCurrentPull(state, ts, sourceId, sourceName);
      if (isNpcId(targetId) && isPlayerId(sourceId)) touchCurrentPull(state, ts, targetId, targetName);
      markNpcUnderflowIfNeeded(state, ts, targetId, targetName, parts[23], parts[24]);
      if (isPlayerId(sourceId) && isNpcId(targetId) && isChickenizeAbility(abilityId, abilityName)) {
        markNpcChickenized(state, ts, targetId, targetName);
      }
      if (isPlayerId(sourceId)) {
        const player = ensurePlayer(state, sourceId, sourceName);
        player.damageDone += amount;
        addAbilityStat(player, abilityId, abilityName, 'damage', amount);
        addEncounterAbilityStat(state.currentEncounter, sourceId, sourceName, abilityId, abilityName, 'damage', amount);
        if (state.currentEncounter) addToMapNumber(state.currentEncounter.damageByPlayer, getActorKey(sourceId, sourceName), amount);
      }
      updateSpiritFromResourcePart(state, sourceId, sourceName, ts, parts[22], abilityId, abilityName);
      if (isPlayerId(targetId)) {
        const player = ensurePlayer(state, targetId, targetName);
        player.damageTaken += amount;
      }
      updateSpiritFromResourcePart(state, targetId, targetName, ts, parts[29], abilityId, abilityName);
      break;
    }
    case 'ABILITY_HEAL':
    case 'ABILITY_PERIODIC_HEAL': {
      const sourceId = parts[2];
      const sourceName = String(unquote(parts[3]) || '');
      const targetId = parts[4];
      const targetName = String(unquote(parts[5]) || '');
      const abilityId = toNumber(parts[6]);
      const abilityName = String(unquote(parts[7]) || '');
      const amount = toNumber(parts[11]) || 0;
      if (isNpcId(sourceId) && isPlayerId(targetId)) touchCurrentPull(state, ts, sourceId, sourceName);
      if (isNpcId(targetId) && isPlayerId(sourceId)) touchCurrentPull(state, ts, targetId, targetName);
      if (isPlayerId(sourceId)) {
        const player = ensurePlayer(state, sourceId, sourceName);
        player.healingDone += amount;
        addAbilityStat(player, abilityId, abilityName, 'healing', amount);
        addEncounterAbilityStat(state.currentEncounter, sourceId, sourceName, abilityId, abilityName, 'healing', amount);
        if (state.currentEncounter) addToMapNumber(state.currentEncounter.healingByPlayer, getActorKey(sourceId, sourceName), amount);
      }
      updateSpiritFromResourcePart(state, sourceId, sourceName, ts, parts[22], abilityId, abilityName);
      if (isPlayerId(targetId)) ensurePlayer(state, targetId, targetName);
      updateSpiritFromResourcePart(state, targetId, targetName, ts, parts[29], abilityId, abilityName);
      break;
    }
    case 'EFFECT_APPLIED':
    case 'EFFECT_REFRESHED':
    case 'EFFECT_REMOVED': {
      const sourceId = parts[2];
      const sourceName = String(unquote(parts[3]) || '');
      const targetId = parts[4];
      const targetName = String(unquote(parts[5]) || '');
      const abilityId = toNumber(parts[6]);
      const abilityName = String(unquote(parts[7]) || '');
      if (isNpcId(sourceId) && isPlayerId(targetId)) touchCurrentPull(state, ts, sourceId, sourceName);
      if (isNpcId(targetId) && isPlayerId(sourceId)) touchCurrentPull(state, ts, targetId, targetName);
      if (isPlayerId(sourceId) && isNpcId(targetId) && isChickenizeAbility(abilityId, abilityName)) {
        markNpcChickenized(state, ts, targetId, targetName);
      }
      updateSpiritFromResourcePart(state, targetId, targetName, ts, parts[17], abilityId, abilityName);
      break;
    }
    case 'UNIT_DEATH':
    case 'UNIT_DESTROYED': {
      const deadId = parts[2];
      const deadName = String(unquote(parts[3]) || '');
      const killerId = event === 'UNIT_DEATH' ? (parts[4] || null) : null;
      const killerName = event === 'UNIT_DEATH' ? (String(unquote(parts[5]) || '') || null) : null;
      const killingAbilityId = event === 'UNIT_DEATH' ? toNumber(parts[6]) : null;
      const killingAbility = event === 'UNIT_DEATH' ? (String(unquote(parts[7]) || '') || null) : null;
      if (isNpcId(deadId)) {
        registerNpcDeath(state, {
          ts,
          npcId: deadId,
          npcName: deadName || null,
          killerId,
          killerName,
          killingAbilityId,
          killingAbility,
        });
        const npc = state.currentPull?.npcMap?.get(deadId);
        if (npc) npc.suspectedDeadAt = null;
      }
      if (event === 'UNIT_DEATH' && isPlayerId(deadId)) ensurePlayer(state, deadId, deadName).deaths += 1;
      break;
    }
    default:
      break;
  }
}

async function parseCombatLog(filePath: string): Promise<FinalizedState> {
  const stat = await fs.promises.stat(filePath);
  const currentIdentity = getFileIdentity(stat);
  const cached = parserCache.get(filePath);

  const shouldReset = !cached || cached.identity !== currentIdentity || stat.size < cached.offset;
  const startOffset = shouldReset ? await findRecentDungeonParseOffset(filePath, stat.size) : cached.offset;
  const entry: ParserCacheEntry = shouldReset
    ? { identity: currentIdentity, offset: startOffset, leftover: '', state: createState() }
    : cached;

  await processFileRange(filePath, entry.offset, stat.size, entry, processLine);

  entry.offset = stat.size;
  entry.identity = currentIdentity;

  parserCache.set(filePath, entry);
  return finalizeState(entry.state);
}

export {
  parseCombatLog,
  splitLogLine,
};
