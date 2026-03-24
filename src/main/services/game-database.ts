import type { SkillDataMap } from '../../types/main-process';
import type { DungeonData } from '../../types/overlay';

import * as fs from 'fs';
import * as path from 'path';
import { fromProjectRoot } from '../utils/project-paths';

export interface HeroFolderInfo {
  dirName: string;
  className: string;
  absPath: string;
}

export interface RawRelicEntry {
  name?: string;
  base_cooldown?: number;
  icon?: string | null;
}

export interface RawRelicData {
  relics?: Record<string, RawRelicEntry>;
  item_mapping?: Record<string, number>;
}

export interface HeroAbilityAsset {
  name: string;
  icon: string | null;
}

const GAME_DATA_ROOT_DIR = 'game-data';
const GAME_DATA_CATALOGS_DIR = path.join(GAME_DATA_ROOT_DIR, 'catalogs');
const GAME_DATA_DUNGEONS_DIR = path.join(GAME_DATA_ROOT_DIR, 'dungeons');
const GAME_DATA_HEROES_DIR = path.join(GAME_DATA_ROOT_DIR, 'heroes');
const GAME_DATA_RELICS_DIR = path.join(GAME_DATA_ROOT_DIR, 'relics');
const RELICS_FILE_NAME = 'relics.json';
const SKILLS_FILE_NAME = 'skills.json';
const DUNGEON_FILE_NAME = 'dng.json';
const DEFAULT_SKILL_ICON_REL_PATH = path.posix.join(GAME_DATA_ROOT_DIR, 'heroes', 'Default', 'default_skill.jpg');
const DEFAULT_RELIC_ICON_REL_PATH = path.posix.join(GAME_DATA_ROOT_DIR, 'relics', 'empty.jpg');

function normalizeName(raw: unknown): string {
  return String(raw || '')
    .replace(/^\d+[_-]?/, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function getGameDataPath(...parts: string[]): string {
  return fromProjectRoot(...parts);
}

function getCatalogPath(fileName: string): string {
  return getGameDataPath(GAME_DATA_CATALOGS_DIR, fileName);
}

function getDungeonsRootPath(): string {
  return getGameDataPath(GAME_DATA_DUNGEONS_DIR);
}

function getHeroesRootPath(): string {
  return getGameDataPath(GAME_DATA_HEROES_DIR);
}

function getRelicsRootPath(): string {
  return getGameDataPath(GAME_DATA_RELICS_DIR);
}

function getDefaultRelicIconPath(): string {
  return getGameDataPath(GAME_DATA_RELICS_DIR, 'empty.jpg');
}

function getDungeonFilePath(dungeonName: string): string {
  return getGameDataPath(GAME_DATA_DUNGEONS_DIR, dungeonName, DUNGEON_FILE_NAME);
}

let relicDataCache: RawRelicData | null = null;
let skillDataCache: SkillDataMap | null = null;
let heroFoldersCache: Map<string, HeroFolderInfo> | null = null;
const heroAbilityAssetCache = new Map<string, HeroAbilityAsset | null>();
const dungeonDataCache = new Map<string, DungeonData | null>();

function getRelicData(): RawRelicData {
  if (!relicDataCache) {
    relicDataCache = readJsonFile<RawRelicData>(getCatalogPath(RELICS_FILE_NAME), {} as RawRelicData);
  }
  return relicDataCache;
}

function getSkillData(): SkillDataMap {
  if (!skillDataCache) {
    skillDataCache = readJsonFile<SkillDataMap>(getCatalogPath(SKILLS_FILE_NAME), {});
  }
  return skillDataCache;
}

function getHeroFolders(): Map<string, HeroFolderInfo> {
  if (heroFoldersCache) return heroFoldersCache;

  const heroesDir = getHeroesRootPath();
  const folders = new Map<string, HeroFolderInfo>();

  try {
    for (const entry of fs.readdirSync(heroesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const match = entry.name.match(/^(\d+)[_-]?(.*)$/);
      if (!match) continue;
      folders.set(String(Number(match[1])), {
        dirName: entry.name,
        className: normalizeName(match[2]) || `Class ${match[1]}`,
        absPath: path.join(heroesDir, entry.name),
      });
    }
  } catch {}

  heroFoldersCache = folders;
  return folders;
}

function getHeroAbilityAsset(classId: unknown, abilityId: unknown): HeroAbilityAsset | null {
  const normalizedClassId = String(Number(classId));
  const normalizedAbilityId = String(Number(abilityId));
  const cacheKey = `${normalizedClassId}:${normalizedAbilityId}`;
  if (heroAbilityAssetCache.has(cacheKey)) return heroAbilityAssetCache.get(cacheKey) || null;

  const heroFolder = getHeroFolders().get(normalizedClassId);
  if (!heroFolder?.absPath) {
    heroAbilityAssetCache.set(cacheKey, null);
    return null;
  }

  try {
    const files = fs.readdirSync(heroFolder.absPath);
    const match = files.find((file) => file.startsWith(`${normalizedAbilityId}_`));
    if (!match) {
      heroAbilityAssetCache.set(cacheKey, null);
      return null;
    }

    const asset: HeroAbilityAsset = {
      name: normalizeName(match) || `Skill ${normalizedAbilityId}`,
      icon: path.posix.join(GAME_DATA_ROOT_DIR, 'heroes', heroFolder.dirName, match).replace(/\\/g, '/'),
    };

    heroAbilityAssetCache.set(cacheKey, asset);
    return asset;
  } catch {
    heroAbilityAssetCache.set(cacheKey, null);
    return null;
  }
}

function loadDungeonDataByName(name: unknown): DungeonData | null {
  const normalized = String(name || '').trim();
  if (!normalized) return null;
  if (dungeonDataCache.has(normalized)) return dungeonDataCache.get(normalized) || null;

  const data = readJsonFile<DungeonData | null>(getDungeonFilePath(normalized), null);

  dungeonDataCache.set(normalized, data);
  return data;
}

export {
  DEFAULT_RELIC_ICON_REL_PATH,
  DEFAULT_SKILL_ICON_REL_PATH,
  GAME_DATA_CATALOGS_DIR,
  GAME_DATA_DUNGEONS_DIR,
  GAME_DATA_HEROES_DIR,
  GAME_DATA_RELICS_DIR,
  GAME_DATA_ROOT_DIR,
  getDungeonsRootPath,
  getGameDataPath,
  getHeroAbilityAsset,
  getHeroFolders,
  getDefaultRelicIconPath,
  getHeroesRootPath,
  getRelicsRootPath,
  getRelicData,
  getSkillData,
  loadDungeonDataByName,
  normalizeName,
};
