import type { FinalizedState, NpcDeathEntry, ParserState } from '../../types/overlay';
import type { ParserCacheEntry } from '../../types/main-process';

import * as fs from 'fs';

import {
  createBossFightState,
  getNpcPercentMeta,
  isBossEncounterName,
  isChickenizeAbility,
  loadDungeonDataByName,
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
  extractSpiritFromResourceList,
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
import { finalizeState } from './parser-finalize';

const MAX_STORED_ENCOUNTERS = 2;
const MAX_STORED_NPC_DEATHS = 400;
const MAX_STORED_ENCOUNTER_NPC_DEATHS = 200;
const parserCache = new Map<string, ParserCacheEntry>();

function processLine(state: ParserState, line: string): void {
  if (!line || !line.trim()) return;

  const parts: string[] = splitLogLine(line);
  if (parts.length < 2) return;

  const ts = parts[0];
  const event = parts[1] || null;

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
      state.dungeon.data = loadDungeonDataByName(dungeonName);
      state.dungeon.affixes = parts[5];
      state.dungeon.success = false;
      state.dungeon.completedPercent = 0;
      state.collectingDungeonParty = true;
      resetCurrentPull(state);
      break;
    }
    case 'DUNGEON_END': {
      state.dungeon.endedAt = ts;
      state.dungeon.name = String(unquote(parts[2]) || '');
      state.dungeon.id = toNumber(parts[3]);
      state.dungeon.difficulty = toNumber(parts[4]);
      state.dungeon.data = loadDungeonDataByName(state.dungeon.name);
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
      const dungeonName = String(unquote(parts[2]) || '');
      const dungeonData = loadDungeonDataByName(dungeonName);
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
          player.spiritRegenPerSecond = 0.35 + (spiritStatValue / 100);
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
    case 'ABILITY_ACTIVATED': {
      const sourceId = parts[2];
      const sourceName = String(unquote(parts[3]) || '');
      const abilityId = toNumber(parts[4]);
      const abilityName = String(unquote(parts[5]) || '');
      const targetId = parts[7];
      const targetName = String(unquote(parts[8]) || '');
      if (isPlayerId(sourceId) && abilityName) {
        const player = ensurePlayer(state, sourceId, sourceName);
        addAbilityStat(player, abilityId, abilityName, 'activation', 0, ts);
        addEncounterAbilityStat(state.currentEncounter, sourceId, sourceName, abilityId, abilityName, 'activation', 0, ts);
        markRelicUse(player, abilityId, ts);
        addRecentSkillActivation(state, player, abilityId, abilityName, ts);
        if (isChickenizeAbility(abilityId, abilityName) && isNpcId(targetId)) {
          markNpcChickenized(state, ts, targetId, targetName);
        }
        const spirit = extractSpiritFromResourceList(parts);
        if (spirit) addSpiritSnapshot(player, ts, spirit.current, spirit.max, abilityId, abilityName);
      }
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
      if (isPlayerId(targetId)) {
        const player = ensurePlayer(state, targetId, targetName);
        player.damageTaken += amount;
      }
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
      if (isPlayerId(targetId)) ensurePlayer(state, targetId, targetName);
      break;
    }
    case 'EFFECT_APPLIED':
    case 'EFFECT_REFRESHED': {
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
      break;
    }
    case 'UNIT_DEATH': {
      const deadId = parts[2];
      const deadName = String(unquote(parts[3]) || '');
      const killerId = parts[4] || null;
      const killerName = String(unquote(parts[5]) || '') || null;
      const killingAbilityId = toNumber(parts[6]);
      const killingAbility = String(unquote(parts[7]) || '') || null;
      if (isNpcId(deadId)) {
        const death: NpcDeathEntry = {
          ts,
          npcId: deadId,
          npcName: deadName || null,
          killerId,
          killerName,
          killingAbilityId,
          killingAbility,
        };
        state.npcDeaths.push(death);
        if (state.npcDeaths.length > MAX_STORED_NPC_DEATHS) {
          state.npcDeaths.splice(0, state.npcDeaths.length - MAX_STORED_NPC_DEATHS);
        }
        markCurrentPullDeath(state, ts, deadId, deadName);
        if (!state.dungeon.countedNpcDeaths.has(deadId)) {
          state.dungeon.countedNpcDeaths.add(deadId);
          const meta = getNpcPercentMeta(state, deadId, deadName);
          const wasChickenized = state.dungeon?.chickenizedNpcIds?.has(deadId);
          const wasBossSpawned = state.dungeon?.bossSpawnedNpcIds?.has(deadId);
          const percentToAdd = (wasChickenized || wasBossSpawned) ? 0 : (Number(meta?.percent) || 0);
          if (percentToAdd) state.dungeon.completedPercent += percentToAdd;
        }
        if (state.currentEncounter) {
          state.currentEncounter.npcDeaths.push(death);
          if (state.currentEncounter.npcDeaths.length > MAX_STORED_ENCOUNTER_NPC_DEATHS) {
            state.currentEncounter.npcDeaths.splice(0, state.currentEncounter.npcDeaths.length - MAX_STORED_ENCOUNTER_NPC_DEATHS);
          }
        }
      }
      if (isPlayerId(deadId)) ensurePlayer(state, deadId, deadName).deaths += 1;
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
