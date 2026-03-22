import type { FinalizedEncounter, FinalizedState, ParserState } from '../../types/overlay';

import { buildCurrentPullSummary } from './parser-dungeon';
import { computeRelicCooldownState } from './parser-relics';
import { parseTs } from './parser-line-utils';
import {
  MAX_RECENT_SKILL_ACTIVATIONS,
  buildUsesPerBoss,
  isLikelyCombatAbility,
  serializeAbilityStat,
  sortAbilities,
} from './parser-state';

function shouldHidePlayersUntilPartyResolved(state: ParserState): boolean {
  const hasDungeonStart = !!state?.dungeon?.startedAt;
  return hasDungeonStart && state.collectingDungeonParty && state.dungeonPartyIds.size === 0;
}

function finalizeState(state: ParserState): FinalizedState {
  const latestLogTs = [...state.players.values()]
    .flatMap((player) => [
      parseTs(player.spirit?.ts),
      ...(player.relics || []).map((x) => parseTs(x.lastUsedAt)),
    ])
    .filter((x): x is number => x != null)
    .reduce((max, x) => Math.max(max, x), 0);
  const cooldownNowMs = Math.max(Date.now(), latestLogTs || 0);
  const hidePlayersUntilPartyResolved = shouldHidePlayersUntilPartyResolved(state);

  const encounters: FinalizedEncounter[] = state.encounters.map((encounter) => {
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
    .filter((entry) => visiblePlayerIds.has(entry.playerId || ''))
    .filter((entry) => !recentSkillsPlayerId || entry.playerId === recentSkillsPlayerId)
    .sort((a, b) => (parseTs(a.ts) || 0) - (parseTs(b.ts) || 0))
    .slice(-MAX_RECENT_SKILL_ACTIVATIONS)
    .map((entry) => {
      const player = playerById.get(entry.playerId || '');
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

export {
  finalizeState,
};
