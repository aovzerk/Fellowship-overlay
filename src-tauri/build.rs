use std::fs;
use std::path::{Path, PathBuf};

fn main() {
    write_embedded_game_data();
    tauri_build::build()
}

fn write_embedded_game_data() {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let root_dir = manifest_dir.parent().unwrap_or(&manifest_dir);
    let game_data_dir = root_dir.join("game-data");
    let out_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap());
    let output_path = out_dir.join("embedded_game_data.rs");

    let relics_json = fs::read_to_string(game_data_dir.join("catalogs").join("relics.json"))
        .unwrap_or_else(|_| "{}".to_string());
    let spirit_values_json =
        fs::read_to_string(game_data_dir.join("catalogs").join("spirit-values.json"))
            .unwrap_or_else(|_| "{}".to_string());
    let empowered_scaling_json = fs::read_to_string(
        game_data_dir
            .join("catalogs")
            .join("empowered-scaling.json"),
    )
    .unwrap_or_else(|_| "{}".to_string());
    let mut dungeons = Vec::new();
    let dungeons_dir = game_data_dir.join("dungeons");
    if let Ok(entries) = fs::read_dir(&dungeons_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let folder = entry.file_name().to_string_lossy().to_string();
            let json_path = path.join("dng.json");
            let Ok(raw) = fs::read_to_string(json_path) else {
                continue;
            };
            let id = folder
                .split(['_', '-'])
                .next()
                .and_then(|value| value.parse::<i64>().ok());
            dungeons.push((id, folder, raw));
        }
    }

    dungeons.sort_by(|left, right| left.1.cmp(&right.1));

    let mut generated = String::new();
    generated.push_str("pub struct EmbeddedDungeon {\n");
    generated.push_str("    pub id: Option<i64>,\n");
    generated.push_str("    pub folder: &'static str,\n");
    generated.push_str("    pub json: &'static str,\n");
    generated.push_str("}\n\n");
    generated.push_str("pub const RELICS_JSON: &str = ");
    generated.push_str(&format!("{relics_json:?}"));
    generated.push_str(";\n\n");
    generated.push_str("pub const EMPOWERED_SCALING_JSON: &str = ");
    generated.push_str(&format!("{empowered_scaling_json:?}"));
    generated.push_str(";\n\n");
    generated.push_str("pub const SPIRIT_VALUES_JSON: &str = ");
    generated.push_str(&format!("{spirit_values_json:?}"));
    generated.push_str(";\n\n");
    generated.push_str("pub const DUNGEONS: &[EmbeddedDungeon] = &[\n");
    for (id, folder, raw) in dungeons {
        let id_expr = id.map_or_else(|| "None".to_string(), |value| format!("Some({value})"));
        generated.push_str("    EmbeddedDungeon { id: ");
        generated.push_str(&id_expr);
        generated.push_str(", folder: ");
        generated.push_str(&format!("{folder:?}"));
        generated.push_str(", json: ");
        generated.push_str(&format!("{raw:?}"));
        generated.push_str(" },\n");
    }
    generated.push_str("];\n");

    fs::write(output_path, generated).expect("write embedded_game_data.rs");
    println!("cargo:rerun-if-changed={}", game_data_dir.display());
    println!(
        "cargo:rerun-if-changed={}",
        game_data_dir.join("catalogs").join("relics.json").display()
    );
    println!(
        "cargo:rerun-if-changed={}",
        game_data_dir
            .join("catalogs")
            .join("empowered-scaling.json")
            .display()
    );
    rerun_if_directory_changes(&game_data_dir.join("dungeons"));
}

fn rerun_if_directory_changes(directory: &Path) {
    if let Ok(entries) = fs::read_dir(directory) {
        for entry in entries.flatten() {
            let path = entry.path();
            println!("cargo:rerun-if-changed={}", path.display());
            if path.is_dir() {
                rerun_if_directory_changes(&path);
            }
        }
    }
}
