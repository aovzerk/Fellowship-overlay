use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

mod embedded_game_data {
    include!(concat!(env!("OUT_DIR"), "/embedded_game_data.rs"));
}

static RELIC_DATA_CACHE: OnceLock<Value> = OnceLock::new();
static EMPOWERED_SCALING_CACHE: OnceLock<Value> = OnceLock::new();

pub fn empowered_scaling_data() -> &'static Value {
    EMPOWERED_SCALING_CACHE.get_or_init(|| {
        for root in game_data_roots() {
            if let Some(data) = read_json(root.join("catalogs").join("empowered-scaling.json")) {
                return data;
            }
        }
        serde_json::from_str(embedded_game_data::EMPOWERED_SCALING_JSON)
            .unwrap_or_else(|_| serde_json::json!({}))
    })
}

pub fn load_dungeon_data(dungeon_id: Option<i64>, name: Option<&str>) -> Option<Value> {
    dungeon_id
        .and_then(load_dungeon_data_by_id)
        .or_else(|| name.and_then(load_dungeon_data_by_name))
}

pub fn extract_relics_from_parts(parts: &[&str]) -> Vec<Value> {
    let relic_data = load_relic_data();
    let relics = relic_data
        .get("relics")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let item_mapping = relic_data
        .get("item_mapping")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let mut seen = HashSet::new();
    let mut found = Vec::new();

    for part in parts {
        for raw_id in extract_tuple_ids(part) {
            let canonical_id = get_canonical_relic_id_from_data(raw_id, &relics, &item_mapping);
            let Some(canonical_id) = canonical_id else {
                continue;
            };
            let Some(relic) = relics.get(&canonical_id.to_string()) else {
                continue;
            };
            if seen.insert(canonical_id) {
                found.push(serde_json::json!({
                    "id": canonical_id,
                    "name": relic.get("name").and_then(Value::as_str).unwrap_or("Relic"),
                    "icon": relic.get("icon").and_then(Value::as_str),
                    "baseCooldown": relic.get("base_cooldown").and_then(Value::as_f64).unwrap_or(0.0),
                    "cooldownModifier": 1,
                    "effectiveCooldown": relic.get("base_cooldown").and_then(Value::as_f64).unwrap_or(0.0),
                    "lastUsedAt": null,
                    "cooldownEndsAt": null,
                    "cooldownRemainingMs": 0,
                    "isReady": true
                }));
            }
        }
    }

    found
}

pub fn get_canonical_relic_id(raw_id: Option<i64>) -> Option<i64> {
    let raw_id = raw_id?;
    let relic_data = load_relic_data();
    let relics = relic_data.get("relics").and_then(Value::as_object)?;
    let item_mapping = relic_data
        .get("item_mapping")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    get_canonical_relic_id_from_data(raw_id, relics, &item_mapping)
}

fn get_canonical_relic_id_from_data(
    raw_id: i64,
    relics: &serde_json::Map<String, Value>,
    item_mapping: &serde_json::Map<String, Value>,
) -> Option<i64> {
    item_mapping
        .get(&raw_id.to_string())
        .and_then(Value::as_i64)
        .or_else(|| relics.contains_key(&raw_id.to_string()).then_some(raw_id))
}

fn load_relic_data() -> Value {
    RELIC_DATA_CACHE
        .get_or_init(|| {
            for root in game_data_roots() {
                if let Some(data) = read_json(root.join("catalogs").join("relics.json")) {
                    return data;
                }
            }
            serde_json::from_str(embedded_game_data::RELICS_JSON)
                .unwrap_or_else(|_| serde_json::json!({}))
        })
        .clone()
}

fn extract_tuple_ids(raw: &str) -> Vec<i64> {
    let mut ids = Vec::new();
    for chunk in raw.split('(').skip(1) {
        let Some(comma_index) = chunk.find(',') else {
            continue;
        };
        if let Ok(id) = chunk[..comma_index].trim().parse::<i64>() {
            ids.push(id);
        }
    }
    ids
}

fn load_dungeon_data_by_id(dungeon_id: i64) -> Option<Value> {
    for root in game_data_roots() {
        let dungeons = root.join("dungeons");
        let Ok(entries) = fs::read_dir(dungeons) else {
            continue;
        };
        for entry in entries.flatten() {
            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_name
                .split(['_', '-'])
                .next()
                .and_then(|value| value.parse::<i64>().ok())
                == Some(dungeon_id)
            {
                if let Some(data) = read_json(entry.path().join("dng.json")) {
                    return Some(data);
                }
            }
        }
    }
    embedded_game_data::DUNGEONS
        .iter()
        .find(|dungeon| dungeon.id == Some(dungeon_id))
        .and_then(|dungeon| serde_json::from_str(dungeon.json).ok())
}

fn load_dungeon_data_by_name(name: &str) -> Option<Value> {
    let normalized = name.trim();
    if normalized.is_empty() {
        return None;
    }
    for root in game_data_roots() {
        if let Some(data) = read_json(root.join("dungeons").join(normalized).join("dng.json")) {
            return Some(data);
        }
    }
    let normalized_name = normalize_game_data_name(normalized);
    embedded_game_data::DUNGEONS
        .iter()
        .find(|dungeon| normalize_game_data_name(dungeon.folder) == normalized_name)
        .and_then(|dungeon| serde_json::from_str(dungeon.json).ok())
}

fn game_data_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        roots.push(cwd.join("game-data"));
        roots.push(cwd.join("src-tauri").join("app-ui").join("game-data"));
        add_ancestor_game_data_roots(&mut roots, &cwd);
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            roots.push(parent.join("game-data"));
            roots.push(parent.join("app-ui").join("game-data"));
            add_ancestor_game_data_roots(&mut roots, parent);
        }
    }
    roots
}

fn add_ancestor_game_data_roots(roots: &mut Vec<PathBuf>, start: &Path) {
    for ancestor in start.ancestors() {
        roots.push(ancestor.join("game-data"));
        roots.push(ancestor.join("app-ui").join("game-data"));
        roots.push(ancestor.join("src-tauri").join("app-ui").join("game-data"));
    }
}

fn read_json(path: impl AsRef<Path>) -> Option<Value> {
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
}

fn normalize_game_data_name(raw: &str) -> String {
    raw.trim()
        .trim_matches('"')
        .trim_start_matches(|ch: char| ch.is_ascii_digit() || ch == '_' || ch == '-')
        .replace(['_', '-'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase()
}
