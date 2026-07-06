const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(rootDir, "package.json");
const packageLockPath = path.join(rootDir, "package-lock.json");
const cargoTomlPath = path.join(rootDir, "src-tauri", "Cargo.toml");
const cargoLockPath = path.join(rootDir, "src-tauri", "Cargo.lock");
const tauriConfigPath = path.join(rootDir, "src-tauri", "tauri.conf.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function updatePackageLock(version) {
  const lock = readJson(packageLockPath);
  lock.version = version;
  if (lock.packages && lock.packages[""]) {
    lock.packages[""].version = version;
  }
  writeJson(packageLockPath, lock);
}

function updateCargoToml(version) {
  const raw = fs.readFileSync(cargoTomlPath, "utf8");
  const next = raw.replace(
    /(\[package\][\s\S]*?\nversion\s*=\s*)"[^"]+"/,
    `$1"${version}"`,
  );
  fs.writeFileSync(cargoTomlPath, next, "utf8");
}

function updateCargoLock(version) {
  const raw = fs.readFileSync(cargoLockPath, "utf8");
  const next = raw.replace(
    /(\[\[package\]\]\nname = "fellowship-overlay"\nversion = )"[^"]+"/,
    `$1"${version}"`,
  );
  fs.writeFileSync(cargoLockPath, next, "utf8");
}

function updateTauriConfig(version) {
  const config = readJson(tauriConfigPath);
  config.version = version;
  writeJson(tauriConfigPath, config);
}

const version = readJson(packageJsonPath).version;
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid package.json version: ${version}`);
}

updatePackageLock(version);
updateCargoToml(version);
updateCargoLock(version);
updateTauriConfig(version);

console.log(`Synced project version to ${version}`);
