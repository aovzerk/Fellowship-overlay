
const fs = require("fs");

const path = require("path");

const DUNGEON_DATA_CACHE = new Map();
const CURRENT_PULL_RESET_MS = 8000;
const CHICKENIZE_RELIC_ID = 1478;
const BOSS_SUMMON_MIN_DELAY_MS = 12000;
const MAX_RECENT_SKILL_ACTIVATIONS = 30;
const READ_STREAM_CHUNK_SIZE = 1024 * 1024;
const MAX_STORED_ENCOUNTERS = 2;
const MAX_STORED_NPC_DEATHS = 400;
const MAX_STORED_ENCOUNTER_NPC_DEATHS = 200;

function loadDungeonDataByName(name) {
  const normalized = String(name || "").trim();
  if (!normalized) return null;
  if (DUNGEON_DATA_CACHE.has(normalized)) return DUNGEON_DATA_CACHE.get(normalized);
  const filePath = fromProjectRoot(path.join("DungeonData", normalized, "dng.json"));
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    DUNGEON_DATA_CACHE.set(normalized, parsed);
    return parsed;
  } catch {
    DUNGEON_DATA_CACHE.set(normalized, null);
    return null;
  }
}

function extractNpcTemplateId(unitId) {
  if (!isNpcId(unitId)) return null;
  const match = String(unitId).match(/^Npc-[^-]+-(\d+)$/i);
  return match ? Number(match[1]) : null;
}

function getNpcPercentMeta(state, unitId, fallbackName = null) {
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

function getBossTemplateIds(state) {
  const raw = state?.dungeon?.data?.bossesID;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.map((value) => Number(value)).filter((value) => Number.isFinite(value)));
}

function isBossTemplateId(state, templateId) {
  if (templateId == null) return false;
  return getBossTemplateIds(state).has(Number(templateId));
}

function getBossEncounterNames(state) {
  const bossIds = getBossTemplateIds(state);
  const mobs = state?.dungeon?.data?.mobs;
  const names = new Set();
  if (!mobs) return names;
  for (const bossId of bossIds) {
    const name = String(mobs[String(bossId)]?.name || '').trim().toLowerCase();
    if (name) names.add(name);
  }
  return names;
}

function isBossEncounterName(state, encounterName) {
  const bossNames = getBossEncounterNames(state);
  if (!bossNames.size) return false;
  return String(encounterName || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .some((value) => bossNames.has(value));
}

function createCurrentPull() {
  return {
    startedAt: null,
    lastCombatAtMs: null,
    npcMap: new Map(),
  };
}

function createBossFightState() {
  return {
    active: false,
    encounterId: null,
    startedAt: null,
  };
}

function isChickenizeAbility(abilityId, abilityName) {
  if (Number(abilityId) === CHICKENIZE_RELIC_ID) return true;
  return String(abilityName || '').trim().toLowerCase() === 'chickenize';
}

function shouldTreatNpcAsBossSpawned(state, templateId, ts = null) {
  if (templateId == null) return false;
  if (!state?.currentEncounter || !state?.bossFight?.active) return false;
  if (isBossTemplateId(state, templateId)) return false;

  const encounterStartedAtMs = parseTs(state?.bossFight?.startedAt);
  const seenAtMs = parseTs(ts);
  if (encounterStartedAtMs == null || seenAtMs == null) return false;

  return seenAtMs - encounterStartedAtMs >= BOSS_SUMMON_MIN_DELAY_MS;
}

function resetCurrentPull(state, tsMs = null) {
  state.currentPull = createCurrentPull();
  if (tsMs != null) {
    state.currentPull.startedAt = new Date(tsMs).toISOString();
    state.currentPull.lastCombatAtMs = tsMs;
  }
}

function touchCurrentPull(state, ts, npcId, npcName) {
  const tsMs = parseTs(ts);
  if (tsMs == null || !npcId) return;
  if (!state.currentPull) resetCurrentPull(state);
  const lastCombatAtMs = state.currentPull.lastCombatAtMs;
  const existingMobs = [...state.currentPull.npcMap.values()];
  const lastDeathMs = existingMobs
    .map((mob) => parseTs(mob.deadAt))
    .filter((value) => value != null)
    .reduce((max, value) => Math.max(max, value), 0);
  const allKnownMobsDead = existingMobs.length > 0 && existingMobs.every((mob) => !!mob.deadAt);
  if (lastCombatAtMs != null && tsMs - lastCombatAtMs > CURRENT_PULL_RESET_MS) {
    resetCurrentPull(state, tsMs);
  } else if (allKnownMobsDead && lastDeathMs && tsMs - lastDeathMs > 500) {
    resetCurrentPull(state, tsMs);
  }
  if (!state.currentPull.startedAt) state.currentPull.startedAt = ts;
  state.currentPull.lastCombatAtMs = tsMs;

  const meta = getNpcPercentMeta(state, npcId, npcName) || {
    templateId: extractNpcTemplateId(npcId),
    name: npcName || `NPC ${extractNpcTemplateId(npcId) || "?"}`,
    score: 0,
    percent: 0,
  };

  let npc = state.currentPull.npcMap.get(npcId);
  if (!npc) {
    const bossSpawned = shouldTreatNpcAsBossSpawned(state, meta.templateId, ts);
    npc = {
      unitId: npcId,
      templateId: meta.templateId,
      name: meta.name || npcName || `NPC ${meta.templateId || "?"}`,
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

function markNpcChickenized(state, ts, npcId, npcName) {
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

function markCurrentPullDeath(state, ts, npcId, npcName) {
  const tsMs = parseTs(ts);
  if (tsMs == null) return;
  touchCurrentPull(state, ts, npcId, npcName);
  const npc = state.currentPull?.npcMap?.get(npcId);
  if (npc) npc.deadAt = ts;
}

function buildCurrentPullSummary(state) {
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
      return String(a.name || "").localeCompare(String(b.name || ""));
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

const { fromProjectRoot } = require('../utils/project-paths');

const RELIC_DATA = JSON.parse(
  fs.readFileSync(fromProjectRoot("relics.json"), "utf8")
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
      effectiveCooldown: meta.baseCooldown,
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
    if (!Number.isFinite(Number(relic.effectiveCooldown)) || relic.isReady) {
      relic.effectiveCooldown = meta.baseCooldown;
    }
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

function getRelicCooldownModifier(player) {
  const whiteStone = Number(player?.stones?.white || 0);
  if (whiteStone >= 2640) return 0.76;
  if (whiteStone >= 960) return 0.92;
  return 1;
}

function markRelicUse(player, abilityId, ts) {
  const relic = getEquippedRelicByAnyId(player, abilityId);
  if (!relic) return;

  const tsMs = parseTs(ts);
  const cooldownSeconds = relic.baseCooldown * getRelicCooldownModifier(player);
  relic.lastUsedAt = ts;
  relic.effectiveCooldown = cooldownSeconds;
  relic.cooldownEndsAt = tsMs != null ? new Date(tsMs + cooldownSeconds * 1000).toISOString() : null;
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
      data: null,
      completedPercent: 0,
      countedNpcDeaths: new Set(),
      chickenizedNpcIds: new Set(),
      bossSpawnedNpcIds: new Set(),
    },
    players: new Map(),
    encounters: [],
    currentEncounter: null,
    npcDeaths: [],
    rawCounters: new Map(),
    dungeonPartyIds: new Set(),
    collectingDungeonParty: false,
    currentPull: createCurrentPull(),
    bossFight: createBossFightState(),
    recentSkillActivations: [],
    recentSkillsPlayerId: null,
    recentSkillsPlayerName: null,
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
      spirit: null,
      relics: [],
      stones: {
        raw: [],
        blue: 0,
        green: 0,
        white: 0
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
    blue: values[4] || 0,
    green: values[2] || 0,
    white: values[1] || 0
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
      lastActivationTs: null,
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
      lastActivationTs: null,
    });
  }

  return abilities.get(abilityKey);
}

function addAbilityStat(player, abilityId, abilityName, type, amount = 0, ts = null) {
  const stat = ensureAbility(player, abilityId, abilityName);
  if (!stat) return;

  if (type === "activation") {
    stat.activations += 1;
    if (ts) stat.lastActivationTs = ts;
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

function addRecentSkillActivation(state, player, abilityId, abilityName, ts) {
  if (!state || !player || !ts) return;
  if (abilityId == null && !abilityName) return;
  if (getRelicMetaByAnyId(abilityId)) return;

  const trackedPlayerId = state.recentSkillsPlayerId || null;
  if (!trackedPlayerId || player.id !== trackedPlayerId) return;

  const entry = {
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

function addEncounterAbilityStat(encounter, playerId, playerName, abilityId, abilityName, type, amount = 0, ts = null) {
  if (!encounter) return;

  const stat = ensureEncounterAbility(encounter, playerId, playerName, abilityId, abilityName);
  if (!stat) return;

  if (type === "activation") {
    stat.activations += 1;
    if (ts) stat.lastActivationTs = ts;
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

function serializeAbilityStat(ability) {
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
  const last = player.spirit || null;

  if (last && last.current === current && last.max === max) {
    return;
  }

  player.spirit = { ts, current, max, abilityId, abilityName };
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
      .map(serializeAbilityStat);

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

function noteBossNpcInLine(state, parts) {
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

  noteBossNpcInLine(state, parts);

  switch (event) {
    case "DUNGEON_START": {
      state.dungeon.startedAt = ts;
      state.dungeon.endedAt = null;
      state.dungeon.name = unquote(parts[2]);
      state.dungeon.id = toNumber(parts[3]);
      state.dungeon.difficulty = toNumber(parts[4]);
      state.dungeon.data = loadDungeonDataByName(state.dungeon.name);
      state.dungeon.data = loadDungeonDataByName(state.dungeon.name);
      state.dungeon.affixes = parts[5];
      state.dungeon.success = false;
      state.dungeon.completedPercent = 0;
      state.dungeon.countedNpcDeaths.clear();
      state.dungeon.chickenizedNpcIds.clear();
      state.dungeon.bossSpawnedNpcIds.clear();
      state.dungeonPartyIds.clear();
      state.collectingDungeonParty = true;
      state.bossFight = createBossFightState();
      state.recentSkillsPlayerId = null;
      state.recentSkillsPlayerName = null;
      state.recentSkillActivations = [];
      resetCurrentPull(state);
      break;
    }
    case "DUNGEON_END": {
      state.dungeon.endedAt = ts;
      state.dungeon.name = unquote(parts[2]);
      state.dungeon.id = toNumber(parts[3]);
      state.dungeon.difficulty = toNumber(parts[4]);
      state.dungeon.data = loadDungeonDataByName(state.dungeon.name);
      state.dungeon.affixes = parts[5];
      state.dungeon.success = parts[6] === "1";
      state.dungeon.durationMs = toNumber(parts[7]);
      state.dungeon.completionSeconds = toNumber(parts[8]);
      state.dungeon.deaths = toNumber(parts[9]);
      state.dungeon.extra = { chestCount: toNumber(parts[10]) };
      state.collectingDungeonParty = false;
      state.bossFight = createBossFightState();
      break;
    }
    case "ZONE_CHANGE": {
      state.dungeon.name = unquote(parts[2]);
      state.dungeon.id = toNumber(parts[3]);
      state.dungeon.difficulty = toNumber(parts[4]);
      state.dungeon.data = loadDungeonDataByName(state.dungeon.name);
      state.dungeon.completedPercent = 0;
      state.dungeon.countedNpcDeaths.clear();
      state.dungeon.chickenizedNpcIds.clear();
      state.dungeon.bossSpawnedNpcIds.clear();
      state.bossFight = createBossFightState();
      state.recentSkillsPlayerId = null;
      state.recentSkillsPlayerName = null;
      state.recentSkillActivations = [];
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
    case "ENCOUNTER_START": {
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
      state.bossFight = createBossFightState();
      break;
    }
    case "ABILITY_ACTIVATED": {
      const sourceId = parts[2];
      const sourceName = unquote(parts[3]);
      const abilityId = toNumber(parts[4]);
      const abilityName = unquote(parts[5]);
      const targetId = parts[7];
      const targetName = unquote(parts[8]);
      if (isPlayerId(sourceId) && abilityName) {
        const player = ensurePlayer(state, sourceId, sourceName);
        addAbilityStat(player, abilityId, abilityName, "activation", 0, ts);
        addEncounterAbilityStat(state.currentEncounter, sourceId, sourceName, abilityId, abilityName, "activation", 0, ts);
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
      if (isNpcId(sourceId) && isPlayerId(targetId)) touchCurrentPull(state, ts, sourceId, sourceName);
      if (isNpcId(targetId) && isPlayerId(sourceId)) touchCurrentPull(state, ts, targetId, targetName);
      if (isPlayerId(sourceId) && isNpcId(targetId) && isChickenizeAbility(abilityId, abilityName)) {
        markNpcChickenized(state, ts, targetId, targetName);
      }
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
      if (isNpcId(sourceId) && isPlayerId(targetId)) touchCurrentPull(state, ts, sourceId, sourceName);
      if (isNpcId(targetId) && isPlayerId(sourceId)) touchCurrentPull(state, ts, targetId, targetName);
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
    case "EFFECT_APPLIED":
    case "EFFECT_REFRESHED": {
      const sourceId = parts[2];
      const sourceName = unquote(parts[3]);
      const targetId = parts[4];
      const targetName = unquote(parts[5]);
      const abilityId = toNumber(parts[6]);
      const abilityName = unquote(parts[7]);
      if (isNpcId(sourceId) && isPlayerId(targetId)) touchCurrentPull(state, ts, sourceId, sourceName);
      if (isNpcId(targetId) && isPlayerId(sourceId)) touchCurrentPull(state, ts, targetId, targetName);
      if (isPlayerId(sourceId) && isNpcId(targetId) && isChickenizeAbility(abilityId, abilityName)) {
        markNpcChickenized(state, ts, targetId, targetName);
      }
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

async function processFileRange(filePath, start, endExclusive, entry) {
  const length = Math.max(0, endExclusive - start);
  if (!length) return;

  await new Promise((resolve, reject) => {
    let leftover = entry.leftover || "";
    const stream = fs.createReadStream(filePath, {
      start,
      end: endExclusive - 1,
      encoding: "utf8",
      highWaterMark: READ_STREAM_CHUNK_SIZE,
    });

    const flushChunk = (chunk) => {
      const text = leftover + chunk;
      const lines = text.split(/\r?\n/);
      leftover = lines.pop() || "";
      for (const line of lines) processLine(entry.state, line);
    };

    stream.on("data", flushChunk);
    stream.on("error", reject);
    stream.on("end", () => {
      entry.leftover = leftover;
      resolve();
    });
  });
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

  await processFileRange(filePath, entry.offset, stat.size, entry);

  entry.offset = stat.size;
  entry.identity = currentIdentity;

  parserCache.set(filePath, entry);
  return finalizeState(entry.state);
}

function shouldHidePlayersUntilPartyResolved(state) {
  const hasDungeonStart = !!state?.dungeon?.startedAt;
  return hasDungeonStart && state.collectingDungeonParty && state.dungeonPartyIds.size === 0;
}

function finalizeState(state) {
  const latestLogTs = [...state.players.values()]
    .flatMap((player) => [
      parseTs(player.spirit?.ts),
      ...(player.relics || []).map((x) => parseTs(x.lastUsedAt)),
    ])
    .filter((x) => x != null)
    .reduce((max, x) => Math.max(max, x), 0);
  const cooldownNowMs = Math.max(Date.now(), latestLogTs || 0);
  const hidePlayersUntilPartyResolved = shouldHidePlayersUntilPartyResolved(state);

  const encounters = state.encounters.map((encounter) => {
    const abilitiesByPlayer = [...encounter.abilitiesByPlayer.entries()].map(([playerKey, abilitiesMap]) => ({
      playerKey,
      abilities: sortAbilities(abilitiesMap.values())
        .filter(isLikelyCombatAbility)
        .map(serializeAbilityStat),
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
    .filter((player) => {
      if (hidePlayersUntilPartyResolved) return false;
      if (state.dungeonPartyIds.size > 0) return state.dungeonPartyIds.has(player.id);
      return true;
    })
    .map((player) => {
      const abilities = sortAbilities(player.abilities.values()).map(serializeAbilityStat);
      const combatAbilities = abilities.filter(isLikelyCombatAbility);
      return {
        ...player,
        spiritHistory: player.spirit ? [{ ...player.spirit }] : [],
        relics: computeRelicCooldownState(player, cooldownNowMs),
        abilities,
        combatAbilities,
        usesPerBoss: buildUsesPerBoss(player, state.encounters),
      };
    })
    .sort((a, b) => b.damageDone - a.damageDone);

  const visiblePlayerIds = new Set(players.map((player) => player.id));
  const playerById = new Map(players.map((player) => [player.id, player]));
  const recentSkillsPlayerId = state.recentSkillsPlayerId && visiblePlayerIds.has(state.recentSkillsPlayerId)
    ? state.recentSkillsPlayerId
    : null;
  const recentSkills = (state.recentSkillActivations || [])
    .filter((entry) => visiblePlayerIds.has(entry.playerId))
    .filter((entry) => !recentSkillsPlayerId || entry.playerId === recentSkillsPlayerId)
    .sort((a, b) => (parseTs(a.ts) || 0) - (parseTs(b.ts) || 0))
    .slice(-MAX_RECENT_SKILL_ACTIVATIONS)
    .map((entry) => {
      const player = playerById.get(entry.playerId);
      return {
        ...entry,
        classId: player?.classId ?? entry.classId ?? null,
        className: player?.className ?? entry.className ?? null,
        playerName: player?.name ?? entry.playerName ?? null,
      };
    });

  return {
    dungeon: {
      ...state.dungeon,
      killCount: Number(state.dungeon?.data?.killcount) || null,
      completedPercent: Number(state.dungeon?.completedPercent || 0),
    },
    players,
    recentSkills,
    recentSkillsPlayerId,
    recentSkillsPlayerName: recentSkillsPlayerId ? (playerById.get(recentSkillsPlayerId)?.name ?? state.recentSkillsPlayerName ?? null) : null,
    partyPlayerIds: [...state.dungeonPartyIds],
    encounters,
    npcDeaths: state.npcDeaths,
    currentPull: buildCurrentPullSummary(state),
    counters: Object.fromEntries(state.rawCounters),
  };
}

module.exports = {
  parseCombatLog,
  splitLogLine,
};
