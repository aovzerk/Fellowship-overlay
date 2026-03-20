
const fs = require("fs");
const path = require("path");

const RELIC_DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, "relics.json"), "utf8")
);
const RELICS = RELIC_DATA.relics || {};
const RELIC_ITEM_MAPPING = RELIC_DATA.item_mapping || {};
const parserCache = new Map();

function getCanonicalRelicId(rawId) {
  if (rawId == null) return null;
  const key = String(rawId);
  return RELIC_ITEM_MAPPING[key] || (RELICS[key] ? Number(key) : null);
}

function getRelicMetaByAnyId(rawId) {
  const canonicalId = getCanonicalRelicId(rawId);
  if (canonicalId == null) return null;
  const relic = RELICS[String(canonicalId)];
  if (!relic) return null;
  return {
    id: canonicalId,
    name: relic.name || `Relic ${canonicalId}`,
    baseCooldown: Number(relic.base_cooldown) || 0,
    icon: relic.icon || null,
  };
}

function extractRelicsFromCombatantInfo(parts) {
  const found = new Map();
  for (const part of parts) {
    if (typeof part !== "string" || !part.includes("(")) continue;
    for (const match of part.matchAll(/\((\d+),/g)) {
      const relic = getRelicMetaByAnyId(Number(match[1]));
      if (relic) found.set(relic.id, relic);
    }
  }
  return [...found.values()];
}

function parseTs(ts) {
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : null;
}

function ensurePlayerRelic(player, relicLike) {
  if (!player.relics) player.relics = [];
  const meta = getRelicMetaByAnyId(relicLike?.id ?? relicLike);
  if (!meta) return null;

  let relic = player.relics.find((r) => r.id === meta.id);
  if (!relic) {
    relic = {
      id: meta.id,
      name: meta.name,
      icon: meta.icon,
      baseCooldown: meta.baseCooldown,
      lastUsedAt: null,
      cooldownEndsAt: null,
      cooldownRemainingMs: 0,
      isReady: true,
    };
    player.relics.push(relic);
  } else {
    relic.name = meta.name;
    relic.icon = meta.icon;
    relic.baseCooldown = meta.baseCooldown;
  }

  return relic;
}

function getEquippedRelicByAnyId(player, rawId) {
  if (!player?.relics?.length || rawId == null) return null;
  const canonicalId = getCanonicalRelicId(rawId);
  if (canonicalId == null) return null;
  return player.relics.find((relic) => relic.id === canonicalId) || null;
}

function setPlayerRelics(player, relics) {
  if (!Array.isArray(relics) || !relics.length) return;
  for (const relic of relics) ensurePlayerRelic(player, relic);
}

function markRelicUse(player, abilityId, ts) {
  const relic = getEquippedRelicByAnyId(player, abilityId);
  if (!relic) return;

  const tsMs = parseTs(ts);
  relic.lastUsedAt = ts;
  relic.cooldownEndsAt = tsMs != null ? new Date(tsMs + relic.baseCooldown * 1000).toISOString() : null;
}

function computeRelicCooldownState(player, nowMs) {
  const relics = (player.relics || []).map((relic) => {
    let remaining = 0;
    if (relic.cooldownEndsAt) {
      const endMs = Date.parse(relic.cooldownEndsAt);
      if (Number.isFinite(endMs)) remaining = Math.max(0, endMs - nowMs);
    }
    return {
      ...relic,
      cooldownRemainingMs: remaining,
      isReady: remaining <= 0,
    };
  });
  relics.sort((a, b) => {
    if (a.isReady !== b.isReady) return a.isReady ? 1 : -1;
    return a.id - b.id;
  });
  return relics;
}

const CLASS_INFO = {
  22: { name: "Helena", color: "#b46831" },
  13: { name: "Meiko", color: "#28e05c" },
  25: { name: "Xavian", color: "#077365" },
  24: { name: "Aeona", color: "#fc9fec" },
  14: { name: "Sylvie", color: "#ea4f84" },
  20: { name: "Vigour", color: "#dddbc5" },
  11: { name: "Mara", color: "#965a90" },
  10: { name: "Tariq", color: "#527af5" },
  7: { name: "Ardeos", color: "#eb6328" },
  2: { name: "Elarion", color: "#935dff" },
  17: { name: "Rime", color: "#1ea3ee" },
};

function getClassInfo(classId) {
  if (classId == null) return { id: null, name: "Unknown", color: "#6b7280" };
  const info = CLASS_INFO[classId];
  if (!info) return { id: classId, name: `Unknown (${classId})`, color: "#6b7280" };
  return { id: classId, ...info };
}

function splitLogLine(line) {
  const result = [];
  let current = "";
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
      if (ch === "[") squareDepth++;
      else if (ch === "]") squareDepth--;
      else if (ch === "(") roundDepth++;
      else if (ch === ")") roundDepth--;

      if (ch === "|" && squareDepth === 0 && roundDepth === 0) {
        result.push(current);
        current = "";
        continue;
      }
    }

    current += ch;
  }

  result.push(current);
  return result;
}

function unquote(value) {
  if (typeof value !== "string") return value;
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  return value;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getActorKey(id, name) {
  return `${id || "unknown"}::${name || "unknown"}`;
}

function getAbilityKey(abilityId, abilityName) {
  return `${abilityId ?? "unknown"}::${abilityName || "unknown"}`;
}

function isPlayerId(id) {
  return typeof id === "string" && id.startsWith("Player-");
}

function isNpcId(id) {
  return typeof id === "string" && id.startsWith("Npc-");
}

function isLikelyCombatAbility(ability) {
  if (!ability) return false;
  const name = String(ability.name || "").trim();
  if (!name) return false;

  if (ability.damage > 0 || ability.healing > 0 || ability.hits > 0) {
    return true;
  }

  const lower = name.toLowerCase();

  if (lower.startsWith("mount ")) return false;
  if (lower === "levitate") return false;
  if (lower === "making camp") return false;
  if (lower === "remove magic") return false;

  return true;
}

function createState() {
  return {
    dungeon: {
      startedAt: null,
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
    },
    players: new Map(),
    encounters: [],
    currentEncounter: null,
    npcDeaths: [],
    rawCounters: new Map(),
    dungeonPartyIds: new Set(),
    collectingDungeonParty: false,
  };
}

function ensurePlayer(state, id, name) {
  const key = getActorKey(id, name);

  if (!state.players.has(key)) {
    state.players.set(key, {
      id,
      name,
      classId: null,
      className: "Unknown",
      classColor: "#6b7280",
      damageDone: 0,
      healingDone: 0,
      damageTaken: 0,
      deaths: 0,
      abilities: new Map(),
      spiritHistory: [],
      relics: [],
      stones: {
        raw: [],
        blue: 0,
        green: 0,
      },
    });
  }

  return state.players.get(key);
}


function parseStoneValues(raw) {
  if (typeof raw !== "string" || !raw.startsWith("[") || !raw.endsWith("]")) {
    return [];
  }

  return raw
    .slice(1, -1)
    .split(",")
    .map((value) => toNumber(String(value).trim()) || 0);
}

function setPlayerStones(player, raw) {
  const values = parseStoneValues(raw);
  player.stones = {
    raw: values,
    blue: values[2] || 0,
    green: values[4] || 0,
  };
}

function setPlayerClass(player, classId) {
  const classInfo = getClassInfo(classId);
  player.classId = classInfo.id;
  player.className = classInfo.name;
  player.classColor = classInfo.color;
}

function ensureAbility(player, abilityId, abilityName) {
  if (!abilityName && abilityId == null) return null;

  const key = getAbilityKey(abilityId, abilityName);

  if (!player.abilities.has(key)) {
    player.abilities.set(key, {
      id: abilityId,
      name: abilityName || null,
      damage: 0,
      healing: 0,
      activations: 0,
      hits: 0,
      activationTimestamps: [],
    });
  }

  return player.abilities.get(key);
}

function ensureEncounterAbility(encounter, playerId, playerName, abilityId, abilityName) {
  const playerKey = getActorKey(playerId, playerName);

  if (!encounter.abilitiesByPlayer.has(playerKey)) {
    encounter.abilitiesByPlayer.set(playerKey, new Map());
  }

  const abilities = encounter.abilitiesByPlayer.get(playerKey);
  const abilityKey = getAbilityKey(abilityId, abilityName);

  if (!abilities.has(abilityKey)) {
    abilities.set(abilityKey, {
      id: abilityId,
      name: abilityName || null,
      damage: 0,
      healing: 0,
      activations: 0,
      hits: 0,
      activationTimestamps: [],
    });
  }

  return abilities.get(abilityKey);
}

function addAbilityStat(player, abilityId, abilityName, type, amount = 0, ts = null) {
  const stat = ensureAbility(player, abilityId, abilityName);
  if (!stat) return;

  if (type === "activation") {
    stat.activations += 1;
    if (ts) stat.activationTimestamps.push(ts);
    return;
  }

  if (type === "damage") {
    stat.damage += amount;
    stat.hits += 1;
    return;
  }

  if (type === "healing") {
    stat.healing += amount;
    stat.hits += 1;
  }
}

function addEncounterAbilityStat(encounter, playerId, playerName, abilityId, abilityName, type, amount = 0, ts = null) {
  if (!encounter) return;

  const stat = ensureEncounterAbility(encounter, playerId, playerName, abilityId, abilityName);
  if (!stat) return;

  if (type === "activation") {
    stat.activations += 1;
    if (ts) stat.activationTimestamps.push(ts);
    return;
  }

  if (type === "damage") {
    stat.damage += amount;
    stat.hits += 1;
    return;
  }

  if (type === "healing") {
    stat.healing += amount;
    stat.hits += 1;
  }
}

function addToMapNumber(map, key, amount) {
  map.set(key, (map.get(key) || 0) + amount);
}

function createEncounter(name, id, startedAt) {
  return {
    id,
    name,
    startedAt,
    endedAt: null,
    success: null,
    damageByPlayer: new Map(),
    healingByPlayer: new Map(),
    npcDeaths: [],
    abilitiesByPlayer: new Map(),
  };
}

function parseEncounterName(raw) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).join(", ");
    return String(parsed);
  } catch {
    return unquote(raw);
  }
}

function sortAbilities(list) {
  return [...list].sort((a, b) => {
    const aScore = a.damage + a.healing + a.activations;
    const bScore = b.damage + b.healing + b.activations;
    return bScore - aScore;
  });
}

function extractSpiritFromResourceList(parts) {
  for (const part of parts) {
    if (typeof part !== "string") continue;
    if (!part.startsWith("[") || !part.endsWith("]")) continue;

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

function addSpiritSnapshot(player, ts, current, max, abilityId = null, abilityName = null) {
  if (!player.spiritHistory) {
    player.spiritHistory = [];
  }

  const last = player.spiritHistory[player.spiritHistory.length - 1];

  if (last && last.current === current && last.max === max) {
    return;
  }

  player.spiritHistory.push({ ts, current, max, abilityId, abilityName });
}

function buildUsesPerBoss(player, encounters) {
  const result = [];

  for (const encounter of encounters) {
    const playerKey = getActorKey(player.id, player.name);
    const encounterMap = encounter.abilitiesByPlayer.get(playerKey);

    if (!encounterMap) {
      result.push({ encounterId: encounter.id, encounterName: encounter.name, abilities: [] });
      continue;
    }

    const abilities = sortAbilities(encounterMap.values())
      .filter(isLikelyCombatAbility)
      .map((a) => ({
        id: a.id,
        name: a.name,
        activations: a.activations,
        hits: a.hits,
        damage: a.damage,
        healing: a.healing,
        activationTimestamps: a.activationTimestamps,
      }));

    result.push({ encounterId: encounter.id, encounterName: encounter.name, abilities });
  }

  return result;
}

function stopPartyCollectionForEvent(state, event) {
  if (!state.collectingDungeonParty) return;
  if (event !== "COMBATANT_INFO" && event !== "DUNGEON_START") {
    state.collectingDungeonParty = false;
  }
}

function processLine(state, line) {
  if (!line || !line.trim()) return;

  const parts = splitLogLine(line);
  if (parts.length < 2) return;

  const ts = parts[0];
  const event = parts[1] || null;

  state.rawCounters.set(event, (state.rawCounters.get(event) || 0) + 1);

  if (event && event !== "COMBATANT_INFO" && event !== "DUNGEON_START") {
    stopPartyCollectionForEvent(state, event);
  }

  switch (event) {
    case "DUNGEON_START": {
      state.dungeon.startedAt = ts;
      state.dungeon.endedAt = null;
      state.dungeon.name = unquote(parts[2]);
      state.dungeon.id = toNumber(parts[3]);
      state.dungeon.difficulty = toNumber(parts[4]);
      state.dungeon.affixes = parts[5];
      state.dungeon.success = false;
      state.dungeonPartyIds.clear();
      state.collectingDungeonParty = true;
      break;
    }
    case "DUNGEON_END": {
      state.dungeon.endedAt = ts;
      state.dungeon.name = unquote(parts[2]);
      state.dungeon.id = toNumber(parts[3]);
      state.dungeon.difficulty = toNumber(parts[4]);
      state.dungeon.affixes = parts[5];
      state.dungeon.success = parts[6] === "1";
      state.dungeon.durationMs = toNumber(parts[7]);
      state.dungeon.completionSeconds = toNumber(parts[8]);
      state.dungeon.deaths = toNumber(parts[9]);
      state.dungeon.extra = { chestCount: toNumber(parts[10]) };
      state.collectingDungeonParty = false;
      break;
    }
    case "COMBATANT_INFO": {
      const unitId = parts[3];
      const name = unquote(parts[4]);
      const classId = toNumber(parts[6]);
      if (isPlayerId(unitId)) {
        const player = ensurePlayer(state, unitId, name);
        setPlayerClass(player, classId);
        setPlayerStones(player, parts[10]);
        setPlayerRelics(player, extractRelicsFromCombatantInfo(parts));
        if (state.collectingDungeonParty) state.dungeonPartyIds.add(unitId);
      }
      break;
    }
    case "ENCOUNTER_START": {
      const encounterId = toNumber(parts[2]);
      const encounterName = parseEncounterName(parts[3]);
      const enc = createEncounter(encounterName, encounterId, ts);
      state.currentEncounter = enc;
      state.encounters.push(enc);
      state.collectingDungeonParty = false;
      break;
    }
    case "ENCOUNTER_END": {
      const encounterId = toNumber(parts[2]);
      const success = parts[4] === "1";
      const enc = state.currentEncounter || state.encounters[state.encounters.length - 1];
      if (enc) {
        enc.id = enc.id ?? encounterId;
        enc.endedAt = ts;
        enc.success = success;
      }
      state.currentEncounter = null;
      break;
    }
    case "ABILITY_ACTIVATED": {
      const sourceId = parts[2];
      const sourceName = unquote(parts[3]);
      const abilityId = toNumber(parts[4]);
      const abilityName = unquote(parts[5]);
      if (isPlayerId(sourceId) && abilityName) {
        const player = ensurePlayer(state, sourceId, sourceName);
        addAbilityStat(player, abilityId, abilityName, "activation", 0, ts);
        addEncounterAbilityStat(state.currentEncounter, sourceId, sourceName, abilityId, abilityName, "activation", 0, ts);
        markRelicUse(player, abilityId, ts);
        const spirit = extractSpiritFromResourceList(parts);
        if (spirit) addSpiritSnapshot(player, ts, spirit.current, spirit.max, abilityId, abilityName);
      }
      break;
    }
    case "ABILITY_DAMAGE":
    case "SWING_DAMAGE":
    case "ABILITY_PERIODIC_DAMAGE": {
      const sourceId = parts[2];
      const sourceName = unquote(parts[3]);
      const targetId = parts[4];
      const targetName = unquote(parts[5]);
      const abilityId = toNumber(parts[6]);
      const abilityName = unquote(parts[7]);
      const amount = toNumber(parts[9]) || 0;
      if (isPlayerId(sourceId)) {
        const player = ensurePlayer(state, sourceId, sourceName);
        player.damageDone += amount;
        addAbilityStat(player, abilityId, abilityName, "damage", amount);
        addEncounterAbilityStat(state.currentEncounter, sourceId, sourceName, abilityId, abilityName, "damage", amount);
        if (state.currentEncounter) addToMapNumber(state.currentEncounter.damageByPlayer, getActorKey(sourceId, sourceName), amount);
      }
      if (isPlayerId(targetId)) {
        const player = ensurePlayer(state, targetId, targetName);
        player.damageTaken += amount;
      }
      break;
    }
    case "ABILITY_HEAL":
    case "ABILITY_PERIODIC_HEAL": {
      const sourceId = parts[2];
      const sourceName = unquote(parts[3]);
      const targetId = parts[4];
      const targetName = unquote(parts[5]);
      const abilityId = toNumber(parts[6]);
      const abilityName = unquote(parts[7]);
      const amount = toNumber(parts[11]) || 0;
      if (isPlayerId(sourceId)) {
        const player = ensurePlayer(state, sourceId, sourceName);
        player.healingDone += amount;
        addAbilityStat(player, abilityId, abilityName, "healing", amount);
        addEncounterAbilityStat(state.currentEncounter, sourceId, sourceName, abilityId, abilityName, "healing", amount);
        if (state.currentEncounter) addToMapNumber(state.currentEncounter.healingByPlayer, getActorKey(sourceId, sourceName), amount);
      }
      if (isPlayerId(targetId)) ensurePlayer(state, targetId, targetName);
      break;
    }
    case "UNIT_DEATH": {
      const deadId = parts[2];
      const deadName = unquote(parts[3]);
      const killerId = parts[4];
      const killerName = unquote(parts[5]);
      const killingAbilityId = toNumber(parts[6]);
      const killingAbility = unquote(parts[7]);
      if (isNpcId(deadId)) {
        const death = { ts, npcId: deadId, npcName: deadName, killerId, killerName, killingAbilityId, killingAbility };
        state.npcDeaths.push(death);
        if (state.currentEncounter) state.currentEncounter.npcDeaths.push(death);
      }
      if (isPlayerId(deadId)) ensurePlayer(state, deadId, deadName).deaths += 1;
      break;
    }
    default:
      break;
  }
}

async function readChunk(filePath, start, endExclusive) {
  const length = Math.max(0, endExclusive - start);
  if (!length) return "";
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, start);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

function getFileIdentity(stat) {
  return `${stat.dev || 0}:${stat.ino || 0}`;
}

async function parseCombatLog(filePath) {
  const stat = await fs.promises.stat(filePath);
  const currentIdentity = getFileIdentity(stat);
  const cached = parserCache.get(filePath);

  const shouldReset = !cached || cached.identity !== currentIdentity || stat.size < cached.offset;
  const entry = shouldReset
    ? { identity: currentIdentity, offset: 0, leftover: "", state: createState() }
    : cached;

  const chunk = await readChunk(filePath, entry.offset, stat.size);
  const text = entry.leftover + chunk;
  const lines = text.split(/\r?\n/);

  entry.leftover = lines.pop() || "";
  for (const line of lines) processLine(entry.state, line);

  entry.offset = stat.size;
  entry.identity = currentIdentity;

  if (!entry.leftover && text && /\r?\n$/.test(text)) {
    entry.leftover = "";
  }

  parserCache.set(filePath, entry);
  return finalizeState(entry.state);
}

function finalizeState(state) {
  const latestLogTs = [...state.players.values()]
    .flatMap((player) => [
      ...(player.spiritHistory || []).map((x) => parseTs(x.ts)),
      ...(player.relics || []).map((x) => parseTs(x.lastUsedAt)),
    ])
    .filter((x) => x != null)
    .reduce((max, x) => Math.max(max, x), 0);
  const cooldownNowMs = Math.max(Date.now(), latestLogTs || 0);

  const encounters = state.encounters.map((encounter) => {
    const abilitiesByPlayer = [...encounter.abilitiesByPlayer.entries()].map(([playerKey, abilitiesMap]) => ({
      playerKey,
      abilities: sortAbilities(abilitiesMap.values())
        .filter(isLikelyCombatAbility)
        .map((a) => ({
          id: a.id,
          name: a.name,
          damage: a.damage,
          healing: a.healing,
          activations: a.activations,
          hits: a.hits,
          activationTimestamps: a.activationTimestamps,
        })),
    }));

    return {
      id: encounter.id,
      name: encounter.name,
      startedAt: encounter.startedAt,
      endedAt: encounter.endedAt,
      success: encounter.success,
      damageByPlayer: [...encounter.damageByPlayer.entries()].map(([playerKey, amount]) => ({ playerKey, amount })).sort((a, b) => b.amount - a.amount),
      healingByPlayer: [...encounter.healingByPlayer.entries()].map(([playerKey, amount]) => ({ playerKey, amount })).sort((a, b) => b.amount - a.amount),
      abilitiesByPlayer,
      npcDeaths: encounter.npcDeaths,
    };
  });

  const players = [...state.players.values()]
    .filter((player) => state.dungeonPartyIds.size === 0 || state.dungeonPartyIds.has(player.id))
    .map((player) => {
      const abilities = sortAbilities(player.abilities.values());
      const combatAbilities = abilities.filter(isLikelyCombatAbility);
      return {
        ...player,
        relics: computeRelicCooldownState(player, cooldownNowMs),
        abilities,
        combatAbilities,
        usesPerBoss: buildUsesPerBoss(player, state.encounters),
      };
    })
    .sort((a, b) => b.damageDone - a.damageDone);

  return {
    dungeon: state.dungeon,
    players,
    partyPlayerIds: [...state.dungeonPartyIds],
    encounters,
    npcDeaths: state.npcDeaths,
    counters: Object.fromEntries(state.rawCounters),
  };
}

module.exports = {
  parseCombatLog,
  splitLogLine,
};
