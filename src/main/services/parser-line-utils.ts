import type { AbilityStat } from '../../types/overlay';

function parseTs(ts: string | null | undefined): number | null {
  const ms = Date.parse(String(ts || ''));
  return Number.isFinite(ms) ? ms : null;
}

function splitLogLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      current += char;
      if (inQuotes && next === '"') {
        current += next;
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === '|' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);

  if (result.length && result[result.length - 1] === '') {
    result.pop();
  }

  return result;
}

function unquote(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (!value.startsWith('"') || !value.endsWith('"')) return value;
  return value.slice(1, -1).replace(/""/g, '"');
}

function toNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getActorKey(id: string | null | undefined, name: string | null | undefined): string {
  return id || name || 'unknown';
}

function getAbilityKey(abilityId: number | null | undefined, abilityName: string | null | undefined): string {
  return abilityId != null ? String(abilityId) : `name:${String(abilityName || 'unknown')}`;
}

function isPlayerId(id: unknown): id is string {
  return typeof id === 'string' && id.startsWith('Player-');
}

function isNpcId(id: unknown): id is string {
  return typeof id === 'string' && id.startsWith('Npc-');
}

function isLikelyCombatAbility(ability: Partial<AbilityStat> | null | undefined): boolean {
  const id = toNumber(ability?.id);
  const name = String(ability?.name || '').trim();
  const lower = name.toLowerCase();

  if (id != null && (id === 0 || id < 0)) return false;
  if (!name) return false;
  if (lower === 'attack') return false;
  if (lower.includes('potion')) return false;
  if (lower.startsWith('mount ')) return false;
  if (lower === 'levitate') return false;
  if (lower === 'making camp') return false;
  if (lower === 'remove magic') return false;

  return true;
}

export {
  getAbilityKey,
  getActorKey,
  isLikelyCombatAbility,
  isNpcId,
  isPlayerId,
  parseTs,
  splitLogLine,
  toNumber,
  unquote,
};
