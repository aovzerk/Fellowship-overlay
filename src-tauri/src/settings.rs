use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

pub fn default_settings() -> Value {
    json!({
        "language": "ru",
        "logDirectoryPath": null,
        "currentFilePath": null,
        "autoHideWithGameWindow": false,
        "playerPositions": {},
        "panelPositions": {
            "pullInfo": { "x": 16, "y": 12 },
            "recentSkills": { "x": 16, "y": 200 }
        },
        "visibilitySettings": {
            "showParty": true,
            "showPull": false,
            "showRecentSkills": false
        },
        "recentSkillsLimit": 7,
        "selectedSkillsByClass": {},
        "cardScale": 0.7,
        "frameGap": 12,
        "layoutDirection": "vertical",
        "panelOpacity": 0.88,
        "iconsPerRow": 3,
        "hotkeys": {
            "toggleInteraction": "F8",
            "pickLog": "F9",
            "toggleVisibility": "F10",
            "openSettings": "F11"
        },
        "recentSkillsLayoutDirection": "horizontal",
        "recentSkillsGrowthDirection": "right",
        "recentSkillsTrackCount": 3
    })
}

pub fn settings_path() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
        .join("settings.json")
}

pub fn merge_json(base: &mut Value, patch: Value) {
    match (base, patch) {
        (Value::Object(base_map), Value::Object(patch_map)) => {
            for (key, value) in patch_map {
                if value.is_null() {
                    base_map.insert(key, Value::Null);
                } else {
                    merge_json(base_map.entry(key).or_insert(Value::Null), value);
                }
            }
        }
        (base_slot, patch_value) => {
            *base_slot = patch_value;
        }
    }
}

pub fn load_settings(path: &Path) -> Value {
    let mut settings = default_settings();
    if let Ok(raw) = fs::read_to_string(path) {
        if let Ok(value) = serde_json::from_str::<Value>(&raw) {
            merge_json(&mut settings, value);
        }
    }
    settings
}

pub fn save_settings(path: &Path, settings: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let raw = serde_json::to_string_pretty(settings).map_err(|error| error.to_string())?;
    fs::write(path, raw).map_err(|error| error.to_string())
}

pub fn value_path(value: &Value, key: &str) -> Option<PathBuf> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .map(PathBuf::from)
}

pub fn path_to_string(path: Option<PathBuf>) -> Option<String> {
    path.map(|path| path.to_string_lossy().to_string())
}
