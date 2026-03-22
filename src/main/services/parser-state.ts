import type { AbilityStatKind } from '../../types/main-process';
import type {
  AbilityStat,
  EncounterState,
  ParserState,
  PlayerState,
  RecentSkillActivation,
  SerializedAbilityStat,
  SpiritSnapshot,
  UsesPerBossEntry,
} from '../../types/overlay';

import {
  createBossFightState,
  createCurrentPull,
  createDungeonState,
  extractNpcTemplateId,
  isBossTemplateId,
} from './parser-dungeon';
import { getPlayerEquippedRelicByAnyId } from './parser-relics';

const MAX_RECENT_SKILL_ACTIVATIONS = 30;

type InternalPlayerState = Omit<PlayerState, 'abilities'> & {
  abilities: Map<string, AbilityStat>;
};

const CLASS_INFO: Record<number, { name: string; color: string }> = {
  22: { name: 'Helena', color: '#b46831' },
  13: { name: 'Meiko', color: '#28e05c' },
  25: { name: 'Xavian', color: '#077365' },
  24: { name: 'Aeona', color: '#fc9fec' },
  14: { name: 'Sylvie', color: '#ea4f84' },
  20: { name: 'Vigour', color: '#dddbc5' },
  11: { name: 'Mara', color: '#965a90' },
  10: { name: 'Tariq', color: '#527af5' },
  7: { name: 'Ardeos', color: '#eb6328' },
  2: { name: 'Elarion', color: '#935dff' },
  17: { name: 'Rime', color: '#1ea3ee' },
};

function getClassInfo(classId: number | null): { id: number | null; name: string; color: string } {
  if (classId == null) return { id: null, name: 'Unknown', color: '#6b7280' };
  const info = CLASS_INFO[classId];
  if (!info) return { id: classId, name: `Unknown (${classId})`, color: '#6b7280' };
  return { id: classId, ...info };
}

function splitLogLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let squareDepth = 0;
  let roundDepth = 0;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }

    if (!inQuotes) {
      if (ch === '[') squareDepth++;
      else if (ch === ']') squareDepth--;
      else if (ch === '(') roundDepth++;
      else if (ch === ')') roundDepth--;

      if (ch === '|' && squareDepth === 0 && roundDepth === 0) {
        result.push(current);
        current = '';
        continue;
      }
    }

    current += ch;
  }

  result.push(current);
  return result;
}

function unquote(value: unknown): string | unknown {
  if (typeof value !== 'string') return value;
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  return value;
}

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getActorKey(id: string | null | undefined, name: string | null | undefined): string {
  return `${id || 'unknown'}::${name || 'unknown'}`;
}

function getAbilityKey(abilityId: number | null | undefined, abilityName: string | null | undefined): string {
  return `${abilityId ?? 'unknown'}::${abilityName || 'unknown'}`;
}

function isPlayerId(id: unknown): id is string {
  return typeof id === 'string' && id.startsWith('Player-');
}

function isNpcId(id: unknown): id is string {
  return typeof id === 'string' && id.startsWith('Npc-');
}

function isLikelyCombatAbility(ability: Partial<AbilityStat> | null | undefined): boolean {
  if (!ability) return false;
  const name = String(ability.name || '').trim();
  if (!name) return false;

  if ((ability.damage || 0) > 0 || (ability.healing || 0) > 0 || (ability.hits || 0) > 0) {
    return true;
  }

  const lower = name.toLowerCase();

  if (lower.startsWith('mount ')) return false;
  if (lower === 'levitate') return false;
  if (lower === 'making camp') return false;
  if (lower === 'remove magic') return false;

  return true;
}

function createState(): ParserState {
  return {
    dungeon: createDungeonState(),
    players: new Map<string, PlayerState>(),
    encounters: [],
    currentEncounter: null,
    npcDeaths: [],
    rawCounters: new Map<string, number>(),
    dungeonPartyIds: new Set<string>(),
    collectingDungeonParty: false,
    currentPull: createCurrentPull(),
    bossFight: createBossFightState(),
    recentSkillActivations: [],
    recentSkillsPlayerId: null,
    recentSkillsPlayerName: null,
  };
}

function ensurePlayer(state: ParserState, id: string, name: string | null | undefined): InternalPlayerState {
  const key = getActorKey(id, name || null);

  if (!state.players.has(key)) {
    state.players.set(key, {
      id,
      name: name || null,
      classId: null,
      className: 'Unknown',
      classColor: '#6b7280',
      damageDone: 0,
      healingDone: 0,
      damageTaken: 0,
      deaths: 0,
      abilities: new Map<string, AbilityStat>(),
      spirit: null,
      relics: [],
      stones: {
        raw: [],
        blue: 0,
        green: 0,
        white: 0,
      },
    });
  }

  return state.players.get(key) as InternalPlayerState;
}

function parseStoneValues(raw: unknown): number[] {
  if (typeof raw !== 'string' || !raw.startsWith('[') || !raw.endsWith(']')) {
    return [];
  }

  return raw
    .slice(1, -1)
    .split(',')
    .map((value) => toNumber(String(value).trim()) || 0);
}

function setPlayerStones(player: PlayerState, raw: unknown): void {
  const values = parseStoneValues(raw);
  player.stones = {
    raw: values,
    blue: values[4] || 0,
    green: values[2] || 0,
    white: values[1] || 0,
  };
}

function setPlayerClass(player: PlayerState, classId: number | null): void {
  const classInfo = getClassInfo(classId);
  player.classId = classInfo.id;
  player.className = classInfo.name;
  player.classColor = classInfo.color;
}

function ensureAbility(player: InternalPlayerState, abilityId: number | null, abilityName: string | null | undefined): AbilityStat | null {
  if (!abilityName && abilityId == null) return null;

  const key = getAbilityKey(abilityId, abilityName || null);

  if (!player.abilities.has(key)) {
    player.abilities.set(key, {
      id: abilityId,
      name: abilityName || null,
      damage: 0,
      healing: 0,
      activations: 0,
      hits: 0,
      lastActivationTs: null,
    });
  }

  return player.abilities.get(key) || null;
}

function ensureEncounterAbility(
  encounter: EncounterState,
  playerId: string,
  playerName: string | null | undefined,
  abilityId: number | null,
  abilityName: string | null | undefined,
): AbilityStat | null {
  const playerKey = getActorKey(playerId, playerName || null);

  if (!encounter.abilitiesByPlayer.has(playerKey)) {
    encounter.abilitiesByPlayer.set(playerKey, new Map());
  }

  const abilities = encounter.abilitiesByPlayer.get(playerKey);
  const abilityKey = getAbilityKey(abilityId, abilityName || null);

  if (!abilities?.has(abilityKey)) {
    abilities?.set(abilityKey, {
      id: abilityId,
      name: abilityName || null,
      damage: 0,
      healing: 0,
      activations: 0,
      hits: 0,
      lastActivationTs: null,
    });
  }

  return abilities?.get(abilityKey) || null;
}

function addAbilityStat(
  player: InternalPlayerState,
  abilityId: number | null,
  abilityName: string | null | undefined,
  type: AbilityStatKind,
  amount = 0,
  ts: string | null = null,
): void {
  const stat = ensureAbility(player, abilityId, abilityName);
  if (!stat) return;

  if (type === 'activation') {
    stat.activations += 1;
    if (ts) stat.lastActivationTs = ts;
    return;
  }

  if (type === 'damage') {
    stat.damage += amount;
    stat.hits += 1;
    return;
  }

  if (type === 'healing') {
    stat.healing += amount;
    stat.hits += 1;
  }
}

function addRecentSkillActivation(
  state: ParserState,
  player: PlayerState,
  abilityId: number | null,
  abilityName: string | null | undefined,
  ts: string | null | undefined,
): void {
  if (!state || !player || !ts) return;
  if (abilityId == null && !abilityName) return;
  if (getPlayerEquippedRelicByAnyId(player, abilityId)) return;

  const trackedPlayerId = state.recentSkillsPlayerId || null;
  if (!trackedPlayerId || player.id !== trackedPlayerId) return;

  const entry: RecentSkillActivation = {
    ts,
    playerId: player.id,
    playerName: player.name,
    classId: player.classId,
    className: player.className,
    abilityId: abilityId == null ? null : Number(abilityId),
    abilityName: abilityName || null,
  };

  state.recentSkillActivations.push(entry);
  if (state.recentSkillActivations.length > MAX_RECENT_SKILL_ACTIVATIONS) {
    state.recentSkillActivations.splice(0, state.recentSkillActivations.length - MAX_RECENT_SKILL_ACTIVATIONS);
  }
}

function addEncounterAbilityStat(
  encounter: EncounterState | null,
  playerId: string,
  playerName: string | null | undefined,
  abilityId: number | null,
  abilityName: string | null | undefined,
  type: AbilityStatKind,
  amount = 0,
  ts: string | null = null,
): void {
  if (!encounter) return;

  const stat = ensureEncounterAbility(encounter, playerId, playerName, abilityId, abilityName);
  if (!stat) return;

  if (type === 'activation') {
    stat.activations += 1;
    if (ts) stat.lastActivationTs = ts;
    return;
  }

  if (type === 'damage') {
    stat.damage += amount;
    stat.hits += 1;
    return;
  }

  if (type === 'healing') {
    stat.healing += amount;
    stat.hits += 1;
  }
}

function addToMapNumber(map: Map<string, number>, key: string, amount: number): void {
  map.set(key, (map.get(key) || 0) + amount);
}

function createEncounter(name: string | null, id: number | null, startedAt: string): EncounterState {
  return {
    id,
    name,
    startedAt,
    endedAt: null,
    success: null,
    damageByPlayer: new Map<string, number>(),
    healingByPlayer: new Map<string, number>(),
    npcDeaths: [],
    abilitiesByPlayer: new Map<string, Map<string, AbilityStat>>(),
  };
}

function parseEncounterName(raw: unknown): string | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(String(raw));
    if (Array.isArray(parsed)) return parsed.map(String).join(', ');
    return String(parsed);
  } catch {
    return String(unquote(raw) || '');
  }
}

function sortAbilities(list: Iterable<AbilityStat>): AbilityStat[] {
  return [...list].sort((a, b) => {
    const aScore = a.damage + a.healing + a.activations;
    const bScore = b.damage + b.healing + b.activations;
    return bScore - aScore;
  });
}

function serializeAbilityStat(ability: Partial<AbilityStat> | null | undefined): SerializedAbilityStat {
  const lastActivationTs = ability?.lastActivationTs || null;
  return {
    id: ability?.id ?? null,
    name: ability?.name || null,
    damage: Number(ability?.damage || 0),
    healing: Number(ability?.healing || 0),
    activations: Number(ability?.activations || 0),
    hits: Number(ability?.hits || 0),
    lastActivationTs,
    activationTimestamps: lastActivationTs ? [lastActivationTs] : [],
  };
}

function extractSpiritFromResourceList(parts: string[]): { current: number; max: number } | null {
  for (const part of parts) {
    if (typeof part !== 'string') continue;
    if (!part.startsWith('[') || !part.endsWith(']')) continue;

    const matches = [...part.matchAll(/\(([-\d.]+),([-\d.]+),([-\d.]+)\)/g)];
    for (const m of matches) {
      const resourceType = toNumber(m[1]);
      const current = toNumber(m[2]);
      const max = toNumber(m[3]);

      if (resourceType === 4 && current != null && max != null) {
        return { current, max };
      }
    }
  }

  return null;
}

function addSpiritSnapshot(
  player: PlayerState,
  ts: string,
  current: number,
  max: number,
  abilityId: number | null = null,
  abilityName: string | null = null,
): void {
  const last = player.spirit || null;

  if (last && last.current === current && last.max === max) {
    return;
  }

  player.spirit = { ts, current, max, abilityId, abilityName } as SpiritSnapshot;
}

function buildUsesPerBoss(player: PlayerState, encounters: EncounterState[]): UsesPerBossEntry[] {
  const result: UsesPerBossEntry[] = [];

  for (const encounter of encounters) {
    const playerKey = getActorKey(player.id, player.name);
    const encounterMap = encounter.abilitiesByPlayer.get(playerKey);

    if (!encounterMap) {
      result.push({ encounterId: encounter.id, encounterName: encounter.name, abilities: [] });
      continue;
    }

    const abilities = sortAbilities(encounterMap.values())
      .filter(isLikelyCombatAbility)
      .map(serializeAbilityStat);

    result.push({ encounterId: encounter.id, encounterName: encounter.name, abilities });
  }

  return result;
}

function stopPartyCollectionForEvent(state: ParserState, event: string | null): void {
  if (!state.collectingDungeonParty) return;
  if (event !== 'COMBATANT_INFO' && event !== 'DUNGEON_START') {
    state.collectingDungeonParty = false;
  }
}

function noteBossNpcInLine(state: ParserState, parts: string[]): void {
  if (!state?.currentEncounter || !state?.bossFight?.active) return;
  for (const value of parts) {
    if (!isNpcId(value)) continue;
    const templateId = extractNpcTemplateId(value);
    if (!isBossTemplateId(state, templateId)) continue;
    state.dungeon.bossSpawnedNpcIds.delete(value);
    const npc = state.currentPull?.npcMap?.get(value);
    if (npc) {
      npc.bossSpawned = false;
      npc.bossSpawnedAt = null;
    }
  }
}

export {
  MAX_RECENT_SKILL_ACTIVATIONS,
  addAbilityStat,
  addEncounterAbilityStat,
  addRecentSkillActivation,
  addSpiritSnapshot,
  addToMapNumber,
  buildUsesPerBoss,
  createEncounter,
  createState,
  ensurePlayer,
  extractSpiritFromResourceList,
  getActorKey,
  isLikelyCombatAbility,
  isNpcId,
  isPlayerId,
  noteBossNpcInLine,
  parseEncounterName,
  serializeAbilityStat,
  setPlayerClass,
  setPlayerStones,
  sortAbilities,
  splitLogLine,
  stopPartyCollectionForEvent,
  toNumber,
  unquote,
};
