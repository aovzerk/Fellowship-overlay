const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "src-tauri", "app-ui");

function copyDir(source, destination) {
  fs.cpSync(source, destination, { recursive: true });
}

function copyGameDataAssets() {
  const sourceRoot = path.join(rootDir, "game-data");
  const destinationRoot = path.join(outputDir, "game-data");
  const assetDirs = ["heroes", "relics", "weapons", "mounts"];

  ensureDir(destinationRoot);
  for (const dirName of assetDirs) {
    copyDir(path.join(sourceRoot, dirName), path.join(destinationRoot, dirName));
  }
}

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeName(raw) {
  return String(raw || "")
    .replace(/^\d+[_-]?/, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function findAbilityAsset(classId, abilityId) {
  const heroesDir = path.join(rootDir, "game-data", "heroes");
  const classPrefix = `${Number(classId)}_`;
  const heroFolder = fs
    .readdirSync(heroesDir, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.startsWith(classPrefix));

  if (!heroFolder) return null;

  const heroDir = path.join(heroesDir, heroFolder.name);
  const abilityPrefix = `${Number(abilityId)}_`;
  const file = fs
    .readdirSync(heroDir, { withFileTypes: true })
    .find((entry) => entry.isFile() && entry.name.startsWith(abilityPrefix));

  if (!file) return null;

  return {
    name: normalizeName(file.name) || `Skill ${Number(abilityId)}`,
    icon: path.posix.join("game-data", "heroes", heroFolder.name, file.name),
  };
}

function addAsset(assetMap, abilityId, asset) {
  const normalizedAbilityId = String(Number(abilityId));
  if (!normalizedAbilityId || normalizedAbilityId === "NaN" || !asset?.icon) return;
  if (assetMap[normalizedAbilityId]) return;
  assetMap[normalizedAbilityId] = {
    id: Number(normalizedAbilityId),
    name: asset.name || `Skill ${normalizedAbilityId}`,
    cooldown: 0,
    icon: asset.icon,
  };
}

function addAssetsFromDirectory(assetMap, sourceDir, relativeDir) {
  try {
    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const match = entry.name.match(/^(\d+)[_-]/);
      if (!match) continue;
      addAsset(assetMap, match[1], {
        name: normalizeName(entry.name) || `Skill ${Number(match[1])}`,
        icon: path.posix.join("game-data", relativeDir, entry.name),
      });
    }
  } catch {}
}

function buildAbilityAssetMap() {
  const assetsByAbilityId = {};
  const heroesDir = path.join(rootDir, "game-data", "heroes");

  for (const entry of fs.readdirSync(heroesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    addAssetsFromDirectory(
      assetsByAbilityId,
      path.join(heroesDir, entry.name),
      path.posix.join("heroes", entry.name),
    );
  }

  addAssetsFromDirectory(
    assetsByAbilityId,
    path.join(rootDir, "game-data", "weapons"),
    "weapons",
  );

  return assetsByAbilityId;
}

function buildSkillCatalog() {
  const skills = readJson(path.join(rootDir, "game-data", "catalogs", "skills.json"), {});
  const heroesDir = path.join(rootDir, "game-data", "heroes");
  const heroFolders = new Map();
  const assetsByAbilityId = buildAbilityAssetMap();

  for (const entry of fs.readdirSync(heroesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^(\d+)[_-]?(.*)$/);
    if (!match) continue;
    heroFolders.set(String(Number(match[1])), normalizeName(match[2]) || `Class ${Number(match[1])}`);
  }

  const classes = Object.entries(skills)
    .map(([classId, abilityMap]) => {
      const abilities = Object.entries(abilityMap || {})
        .map(([abilityId, cooldown]) => {
          const asset = findAbilityAsset(classId, abilityId);
          return {
            id: Number(abilityId),
            name: asset ? asset.name : `Skill ${Number(abilityId)}`,
            cooldown: Number(cooldown || 0),
            icon: asset ? asset.icon : "game-data/heroes/Default/default_skill.jpg",
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        id: Number(classId),
        name: heroFolders.get(String(Number(classId))) || `Class ${Number(classId)}`,
        abilities,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { classes, assetsByAbilityId };
}

function buildIndexHtml() {
  const sourcePath = path.join(rootDir, "src", "renderer", "index.html");
  let html = fs.readFileSync(sourcePath, "utf8");

  html = html.replaceAll("../../dist/renderer/", "./dist/renderer/");
  html = html.replace(
    '<script src="./dist/renderer/modules/panels.js"></script>',
    [
      '<script src="./tauri-renderer-shim.js"></script>',
      '<script>window.FellowshipTauriShim.overrideAssetPathFormatter();</script>',
      '<script src="./dist/renderer/modules/panels.js"></script>',
    ].join("\n  "),
  );
  html = html.replace(
    '<script src="./dist/renderer/index.js"></script>',
    [
      '<script>',
      '    window.FellowshipTauriShim.settingsReady.finally(() => {',
      '      const script = document.createElement("script");',
      '      script.src = "./dist/renderer/index.js";',
      '      document.body.appendChild(script);',
      '    });',
      '  </script>',
    ].join("\n"),
  );

  return html;
}

fs.rmSync(outputDir, { recursive: true, force: true });
ensureDir(outputDir);
copyDir(path.join(rootDir, "dist", "renderer"), path.join(outputDir, "dist", "renderer"));
copyGameDataAssets();
fs.copyFileSync(
  path.join(rootDir, "src", "renderer", "styles.css"),
  path.join(outputDir, "styles.css"),
);
fs.copyFileSync(
  path.join(rootDir, "src-tauri", "tauri-renderer-shim.js"),
  path.join(outputDir, "tauri-renderer-shim.js"),
);
fs.writeFileSync(path.join(outputDir, "index.html"), buildIndexHtml(), "utf8");
fs.writeFileSync(
  path.join(outputDir, "skill-catalog.json"),
  JSON.stringify(buildSkillCatalog(), null, 2),
  "utf8",
);

console.log(`Prepared Tauri app UI at ${outputDir}`);
