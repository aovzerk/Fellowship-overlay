import type { GetSkillCatalogFn } from '../../types/main-process';
import type { SkillCatalog, SkillCatalogAbility, SkillCatalogClass } from '../../types/overlay';

import * as fs from 'fs';
import { getHeroAbilityAsset, getHeroFolders, getSkillData } from './game-database';
import { fromProjectRoot } from '../utils/project-paths';

interface AbilityTooltipEntry {
  name?: string;
  tooltip?: string;
}

let tooltipMapCache: Record<string, AbilityTooltipEntry> | null = null;

function getAbilityTooltipMap(): Record<string, AbilityTooltipEntry> {
  if (tooltipMapCache) return tooltipMapCache;
  try {
    tooltipMapCache = JSON.parse(fs.readFileSync(fromProjectRoot('src', 'main', 'services', 'ability-tooltips.json'), 'utf8')) as Record<string, AbilityTooltipEntry>;
  } catch {
    tooltipMapCache = {};
  }
  return tooltipMapCache;
}

const getSkillCatalog: GetSkillCatalogFn = (): SkillCatalog => {
  const skillData = getSkillData();
  const heroFolders = getHeroFolders();
  const tooltipMap = getAbilityTooltipMap();

  const classes: SkillCatalogClass[] = Object.entries(skillData)
    .map(([classId, abilities]): SkillCatalogClass => {
      const normalizedClassId = String(Number(classId));
      const heroFolder = heroFolders.get(normalizedClassId);
      const className = heroFolder?.className || `Class ${classId}`;
      const abilityList: SkillCatalogAbility[] = Object.entries(abilities || {})
        .map(([abilityId, cooldown]): SkillCatalogAbility => {
          const normalizedAbilityId = String(Number(abilityId));
          const asset = getHeroAbilityAsset(normalizedClassId, normalizedAbilityId);
          const tooltipEntry = tooltipMap[normalizedAbilityId] || {};
          const image = asset?.icon || null;
          const abilityName = tooltipEntry.name || asset?.name || `Skill ${abilityId}`;

          return {
            id: Number(abilityId),
            cooldown: Number(cooldown) || 0,
            name: abilityName,
            icon: image,
            tooltip: tooltipEntry.tooltip || '',
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        id: Number(classId),
        name: className,
        abilities: abilityList,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { classes };
};

export { getSkillCatalog };
