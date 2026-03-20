const fs = require('fs');
const path = require('path');
const { fromProjectRoot } = require('../utils/project-paths');

function normalizeName(raw) {
  return String(raw || '')
    .replace(/^\d+[_-]?/, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

function getSkillCatalog() {
  const skillsPath = fromProjectRoot('skills.json');
  const heroesDir = fromProjectRoot('Heroes');

  let skillData = {};
  try {
    skillData = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));
  } catch {
    skillData = {};
  }

  const heroFolders = new Map();
  try {
    for (const entry of fs.readdirSync(heroesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const match = entry.name.match(/^(\d+)[_-]?(.*)$/);
      if (!match) continue;
      heroFolders.set(String(Number(match[1])), {
        dirName: entry.name,
        className: normalizeName(match[2]) || `Class ${match[1]}`,
        absPath: path.join(heroesDir, entry.name),
      });
    }
  } catch {
  }

  const classes = Object.entries(skillData).map(([classId, abilities]) => {
    const normalizedClassId = String(Number(classId));
    const heroFolder = heroFolders.get(normalizedClassId);
    const className = heroFolder?.className || `Class ${classId}`;
    const abilityList = Object.entries(abilities || {})
      .map(([abilityId, cooldown]) => {
        const normalizedAbilityId = String(Number(abilityId));
        let image = null;
        let abilityName = `Skill ${abilityId}`;

        if (heroFolder?.absPath) {
          try {
            const files = fs.readdirSync(heroFolder.absPath);
            const match = files.find((file) => file.startsWith(`${normalizedAbilityId}_`));
            if (match) {
              abilityName = normalizeName(match);
              image = path.posix.join('Heroes', heroFolder.dirName, match).replace(/\\/g, '/');
            }
          } catch {
          }
        }

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
  }).sort((a, b) => a.name.localeCompare(b.name));

  return { classes };
}

module.exports = { getSkillCatalog };
