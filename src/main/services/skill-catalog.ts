import type { GetSkillCatalogFn } from '../../types/main-process';
import type { SkillCatalog, SkillCatalogAbility, SkillCatalogClass } from '../../types/overlay';

import { getHeroAbilityAsset, getHeroFolders, getSkillData } from './game-database';

const getSkillCatalog: GetSkillCatalogFn = (): SkillCatalog => {
  const skillData = getSkillData();
  const heroFolders = getHeroFolders();

  const classes: SkillCatalogClass[] = Object.entries(skillData)
    .map(([classId, abilities]): SkillCatalogClass => {
      const normalizedClassId = String(Number(classId));
      const heroFolder = heroFolders.get(normalizedClassId);
      const className = heroFolder?.className || `Class ${classId}`;
      const abilityList: SkillCatalogAbility[] = Object.entries(abilities || {})
        .map(([abilityId, cooldown]): SkillCatalogAbility => {
          const normalizedAbilityId = String(Number(abilityId));
          const asset = getHeroAbilityAsset(normalizedClassId, normalizedAbilityId);
          const image = asset?.icon || null;
          const abilityName = asset?.name || `Skill ${abilityId}`;

          return {
            id: Number(abilityId),
            cooldown: Number(cooldown) || 0,
            name: abilityName,
            icon: image,
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
