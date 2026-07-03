const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const exePath = path.join(rootDir, "src-tauri", "target", "release", "fellowship-overlay.exe");
const outputDir = path.join(rootDir, "release", "Fellowship Overlay Portable");

function assertExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} not found: ${targetPath}`);
  }
}

assertExists(exePath, "Tauri release exe");

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

fs.copyFileSync(exePath, path.join(outputDir, "Fellowship Overlay.exe"));

const files = [];
function collectFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
}

collectFiles(outputDir);
const size = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);

console.log(`Prepared portable package: ${outputDir}`);
console.log(`Files: ${files.length}`);
console.log(`Size: ${(size / 1024 / 1024).toFixed(2)} MB`);
