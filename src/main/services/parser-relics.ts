import type { PlayerRelicState, PlayerState, RelicMeta } from '../../types/overlay';

import { parseTs } from './parser-line-utils';
import { getRelicData } from './game-database';
import type { RawRelicEntry } from './game-database';

const RELIC_DATA = getRelicData();
const RELICS: Record<string, RawRelicEntry> = RELIC_DATA.relics || {};
const RELIC_ITEM_MAPPING: Record<string, number> = RELIC_DATA.item_mapping || {};

function getCanonicalRelicId(rawId: number | string | null | undefined): number | null {
  if (rawId == null) return null;
  const key = String(rawId);
  return RELIC_ITEM_MAPPING[key] || (RELICS[key] ? Number(key) : null);
}

function getCanonicalRelicAbilityId(rawId: number | string | null | undefined): number | null {
  if (rawId == null) return null;
  const key = String(rawId);
  return RELICS[key] ? Number(key) : null;
}

function getRelicMetaByAnyId(rawId: number | string | null | undefined): RelicMeta | null {
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

function getPlayerEquippedRelicByAnyId(player: PlayerState, rawId: number | string | null | undefined): PlayerRelicState | null {
  const canonicalId = getCanonicalRelicId(rawId);
  if (canonicalId == null) return null;
  return (player.relics || []).find((item) => item.id === canonicalId) || null;
}

function getPlayerEquippedRelicByAbilityId(player: PlayerState, rawAbilityId: number | string | null | undefined): PlayerRelicState | null {
  const canonicalAbilityId = getCanonicalRelicAbilityId(rawAbilityId);
  if (canonicalAbilityId == null) return null;
  return (player.relics || []).find((item) => item.id === canonicalAbilityId) || null;
}

function extractRelicsFromCombatantInfo(parts: string[]): RelicMeta[] {
  const found = new Map<number, RelicMeta>();
  for (const part of parts) {
    if (typeof part !== 'string' || !part.includes('(')) continue;
    for (const match of part.matchAll(/\((\d+),/g)) {
      const relic = getRelicMetaByAnyId(Number(match[1]));
      if (relic) found.set(relic.id, relic);
    }
  }
  return [...found.values()];
}

function ensurePlayerRelic(player: PlayerState, relicLike: RelicMeta | number | string | null | undefined): PlayerRelicState | null {
  if (!player.relics) player.relics = [];
  const rawRelicId: number | string | null | undefined = typeof relicLike === 'object' && relicLike
    ? (relicLike as RelicMeta).id
    : (relicLike as number | string | null | undefined);
  const meta = getRelicMetaByAnyId(rawRelicId);
  if (!meta) return null;

  let relic = player.relics.find((item) => item.id === meta.id) || null;
  if (!relic) {
    relic = {
      id: meta.id,
      name: meta.name,
      icon: meta.icon,
      baseCooldown: meta.baseCooldown,
      cooldownModifier: 1,
      effectiveCooldown: meta.baseCooldown,
      lastUsedAt: null,
      cooldownEndsAt: null,
      cooldownRemainingMs: 0,
      isReady: true,
    };
    player.relics.push(relic);
  }

  relic.name = meta.name;
  relic.icon = meta.icon;
  relic.baseCooldown = meta.baseCooldown;
  return relic;
}

function getEquippedRelicByAnyId(player: PlayerState, rawId: number | string | null | undefined): PlayerRelicState | null {
  const relic = getPlayerEquippedRelicByAnyId(player, rawId);
  if (!relic) return null;

  const meta = getRelicMetaByAnyId(relic.id);
  if (!meta) return relic;

  relic.name = meta.name;
  relic.icon = meta.icon;
  relic.baseCooldown = meta.baseCooldown;
  return relic;
}

function getEquippedRelicByAbilityId(player: PlayerState, rawAbilityId: number | string | null | undefined): PlayerRelicState | null {
  const relic = getPlayerEquippedRelicByAbilityId(player, rawAbilityId);
  if (!relic) return null;

  const meta = getRelicMetaByAnyId(relic.id);
  if (!meta) return relic;

  relic.name = meta.name;
  relic.icon = meta.icon;
  relic.baseCooldown = meta.baseCooldown;
  return relic;
}

function setPlayerRelics(player: PlayerState, relics: RelicMeta[]): void {
  player.relics = [];
  relics.forEach((relic) => ensurePlayerRelic(player, relic));
}

function getRelicCooldownModifier(player: PlayerState): number {
  const white = Number(player?.stones?.white || 0);
  if (white >= 2640) return 0.76;
  if (white >= 960) return 0.92;
  return 1;
}

function markRelicUse(player: PlayerState, abilityId: number | null, ts: string | null | undefined): PlayerRelicState | null {
  const relic = getEquippedRelicByAbilityId(player, abilityId);
  if (!relic || !ts) return null;
  const modifier = getRelicCooldownModifier(player);
  relic.cooldownModifier = modifier;
  relic.effectiveCooldown = Math.max(0, Math.round((relic.baseCooldown || 0) * modifier));
  relic.lastUsedAt = ts;
  relic.cooldownEndsAt = new Date((parseTs(ts) || 0) + relic.effectiveCooldown * 1000).toISOString();
  return relic;
}

function resetPlayerRelicCooldowns(player: PlayerState): void {
  (player.relics || []).forEach((relic) => {
    relic.cooldownModifier = getRelicCooldownModifier(player);
    relic.effectiveCooldown = Math.max(0, Math.round((Number(relic.baseCooldown) || 0) * relic.cooldownModifier));
    relic.lastUsedAt = null;
    relic.cooldownEndsAt = null;
    relic.cooldownRemainingMs = 0;
    relic.isReady = true;
  });
}

function computeRelicCooldownState(player: PlayerState, nowMs: number): PlayerRelicState[] {
  const modifier = getRelicCooldownModifier(player);
  return (player.relics || []).map((relic) => {
    const effectiveCooldown = Math.max(0, Math.round((Number(relic.baseCooldown) || 0) * modifier));
    let cooldownEndsAt = relic.cooldownEndsAt || null;
    let cooldownRemainingMs = 0;

    if (relic.lastUsedAt && effectiveCooldown > 0) {
      const lastUsedMs = parseTs(relic.lastUsedAt);
      if (lastUsedMs != null) {
        const endMs = lastUsedMs + effectiveCooldown * 1000;
        cooldownEndsAt = new Date(endMs).toISOString();
        cooldownRemainingMs = Math.max(0, endMs - nowMs);
      }
    }

    return {
      ...relic,
      cooldownModifier: modifier,
      effectiveCooldown,
      cooldownEndsAt,
      cooldownRemainingMs,
      isReady: cooldownRemainingMs <= 0,
    };
  });
}

export {
  computeRelicCooldownState,
  ensurePlayerRelic,
  extractRelicsFromCombatantInfo,
  getEquippedRelicByAbilityId,
  getEquippedRelicByAnyId,
  getPlayerEquippedRelicByAbilityId,
  getPlayerEquippedRelicByAnyId,
  getRelicMetaByAnyId,
  markRelicUse,
  resetPlayerRelicCooldowns,
  setPlayerRelics,
};
