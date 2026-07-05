use crate::dungeon::{is_chickenize_ability, DungeonTracker};
use crate::game_database::extract_relics_from_parts;
use crate::parser_abilities::{
    ability_to_json, actor_key, add_ability, add_encounter_ability, build_uses_per_boss,
    combat_ability_values, encounter_to_json, parse_encounter_name, sort_abilities_by_score,
};
use crate::parser_file::find_recent_dungeon_parse_offset;
use crate::parser_line_utils::{
    is_npc_id, is_player_id, parse_ts_ms, split_log_line, to_f64, to_i64, unquote,
};
use crate::parser_relics::{
    compute_relic_cooldown_state, is_equipped_relic_ability, mark_relic_use,
    reset_player_relic_cooldowns,
};
use crate::parser_spirit::{
    add_spirit, extract_spirit, parse_stones, update_spirit_from_bloodbound_ability,
    update_spirit_from_rising_spirit_effect,
};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Default, Clone)]
pub(crate) struct AbilityAccum {
    pub(crate) id: Option<i64>,
    pub(crate) name: Option<String>,
    pub(crate) damage: f64,
    pub(crate) healing: f64,
    pub(crate) activations: i64,
    pub(crate) hits: i64,
    pub(crate) last_activation_ts: Option<String>,
}

#[derive(Default, Clone)]
pub(crate) struct EncounterAccum {
    pub(crate) id: Option<i64>,
    pub(crate) name: Option<String>,
    pub(crate) started_at: Option<String>,
    pub(crate) ended_at: Option<String>,
    pub(crate) success: Option<bool>,
    pub(crate) damage_by_player: HashMap<String, f64>,
    pub(crate) healing_by_player: HashMap<String, f64>,
    pub(crate) npc_deaths: Vec<Value>,
    pub(crate) abilities_by_player: HashMap<String, HashMap<String, AbilityAccum>>,
    pub(crate) abilities_player_order: Vec<String>,
}

#[derive(Default, Clone)]
pub(crate) struct PlayerAccum {
    pub(crate) id: String,
    pub(crate) name: Option<String>,
    class_id: Option<i64>,
    damage_done: f64,
    healing_done: f64,
    damage_taken: f64,
    deaths: i64,
    pub(crate) abilities: HashMap<String, AbilityAccum>,
    pub(crate) spirit: Option<Value>,
    pub(crate) spirit_history: Vec<Value>,
    pub(crate) relics: Vec<Value>,
    pub(crate) stones: Value,
    spirit_stat_value: Option<f64>,
    spirit_regen_per_second: f64,
    pub(crate) rising_spirit_stack: i64,
    buff_uptimes: HashMap<String, BuffUptimeAccum>,
}

#[derive(Default, Clone)]
struct BuffUptimeAccum {
    id: Option<i64>,
    name: Option<String>,
    source_id: Option<String>,
    source_name: Option<String>,
    total_ms: i64,
    applications: i64,
    refreshes: i64,
    active_since: Option<String>,
    active_sources: HashSet<String>,
    current_stacks: i64,
    first_applied_at: Option<String>,
    last_applied_at: Option<String>,
    last_removed_at: Option<String>,
}

struct ParsedLog {
    data: Value,
}

#[derive(Clone)]
struct ParserState {
    players: HashMap<String, PlayerAccum>,
    counters: HashMap<String, i64>,
    latest_log_ts: Option<String>,
    dungeon: DungeonTracker,
    party_player_ids: Vec<String>,
    collecting_dungeon_party: bool,
    encounters: Vec<EncounterAccum>,
    current_encounter: Option<EncounterAccum>,
    recent_skills: Vec<Value>,
    recent_skills_player_id: Option<String>,
    recent_skills_player_name: Option<String>,
}

impl ParserState {
    fn new() -> Self {
        Self {
            players: HashMap::new(),
            counters: HashMap::new(),
            latest_log_ts: None,
            dungeon: DungeonTracker::new(),
            party_player_ids: Vec::new(),
            collecting_dungeon_party: false,
            encounters: Vec::new(),
            current_encounter: None,
            recent_skills: Vec::new(),
            recent_skills_player_id: None,
            recent_skills_player_name: None,
        }
    }

    fn reset_parser_scope(&mut self) {
        self.players.clear();
        self.counters.clear();
        self.recent_skills.clear();
        self.recent_skills_player_id = None;
        self.recent_skills_player_name = None;
        self.party_player_ids.clear();
        self.collecting_dungeon_party = false;
        self.encounters.clear();
        self.current_encounter = None;
    }

    fn reset_dungeon_scope(&mut self) {
        self.reset_parser_scope();
        self.dungeon.reset_scope();
    }
}

struct ParserCache {
    file_path: PathBuf,
    identity: String,
    offset: u64,
    leftover: String,
    state: ParserState,
    size: u64,
    modified: Option<SystemTime>,
}

static PARSER_CACHE: OnceLock<Mutex<Option<ParserCache>>> = OnceLock::new();

#[cfg(target_os = "windows")]
fn get_file_identity(metadata: &fs::Metadata) -> String {
    metadata
        .created()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos().to_string())
        .unwrap_or_else(|| "0".to_string())
}

#[cfg(unix)]
fn get_file_identity(metadata: &fs::Metadata) -> String {
    use std::os::unix::fs::MetadataExt;
    format!("{}:{}", metadata.dev(), metadata.ino())
}

#[cfg(not(any(target_os = "windows", unix)))]
fn get_file_identity(metadata: &fs::Metadata) -> String {
    metadata
        .created()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos().to_string())
        .unwrap_or_else(|| "0".to_string())
}

fn player_map_key(id: &str) -> String {
    id.to_string()
}

fn class_info(class_id: Option<i64>) -> (Option<i64>, String, String) {
    match class_id {
        Some(22) => (class_id, "Helena".to_string(), "#b46831".to_string()),
        Some(13) => (class_id, "Meiko".to_string(), "#28e05c".to_string()),
        Some(25) => (class_id, "Xavian".to_string(), "#077365".to_string()),
        Some(24) => (class_id, "Aeona".to_string(), "#fc9fec".to_string()),
        Some(14) => (class_id, "Sylvie".to_string(), "#ea4f84".to_string()),
        Some(20) => (class_id, "Vigour".to_string(), "#dddbc5".to_string()),
        Some(11) => (class_id, "Mara".to_string(), "#965a90".to_string()),
        Some(10) => (class_id, "Tariq".to_string(), "#527af5".to_string()),
        Some(7) => (class_id, "Ardeos".to_string(), "#eb6328".to_string()),
        Some(2) => (class_id, "Elarion".to_string(), "#935dff".to_string()),
        Some(17) => (class_id, "Rime".to_string(), "#1ea3ee".to_string()),
        Some(9) => (class_id, "Gunde".to_string(), "#913539".to_string()),
        Some(id) => (Some(id), format!("Unknown ({id})"), "#6b7280".to_string()),
        None => (None, "Unknown".to_string(), "#6b7280".to_string()),
    }
}

fn ensure_player<'a>(
    players: &'a mut HashMap<String, PlayerAccum>,
    id: &str,
    name: Option<String>,
) -> &'a mut PlayerAccum {
    let key = player_map_key(id);
    players.entry(key).or_insert_with(|| PlayerAccum {
        id: id.to_string(),
        name: name.clone(),
        stones: json!({ "raw": [], "blue": 0, "green": 0, "white": 0 }),
        ..PlayerAccum::default()
    });
    let player = players.get_mut(id).expect("player entry exists");
    if name
        .as_deref()
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .is_some()
    {
        player.name = name;
    }
    player
}

fn add_to_map_number(map: &mut HashMap<String, f64>, key: String, amount: f64) {
    *map.entry(key).or_insert(0.0) += amount;
}

fn buff_key(ability_id: Option<i64>, ability_name: Option<&str>) -> String {
    format!(
        "{}::{}",
        ability_id
            .map(|id| id.to_string())
            .unwrap_or_else(|| "unknown".to_string()),
        ability_name.unwrap_or("unknown")
    )
}

fn buff_source_key(source_id: Option<&str>, source_name: Option<&str>) -> String {
    format!(
        "{}::{}",
        source_id.unwrap_or("unknown"),
        source_name.unwrap_or("unknown")
    )
}

fn close_buff_interval(stat: &mut BuffUptimeAccum, ts: &str) {
    let Some(active_since) = stat.active_since.as_deref() else {
        return;
    };
    if let (Some(start_ms), Some(end_ms)) = (parse_ts_ms(active_since), parse_ts_ms(ts)) {
        if end_ms >= start_ms {
            stat.total_ms += end_ms - start_ms;
        }
    }
    stat.active_since = None;
    stat.active_sources.clear();
}

fn mark_player_buff_effect(
    player: &mut PlayerAccum,
    event: &str,
    ts: &str,
    source_id: Option<&str>,
    source_name: Option<&str>,
    ability_id: Option<i64>,
    ability_name: Option<&str>,
    aura_type: Option<&str>,
    stack_raw: Option<&String>,
) {
    if !aura_type.unwrap_or("").trim().eq_ignore_ascii_case("BUFF") {
        return;
    }
    if ability_id.is_none() && ability_name.unwrap_or("").is_empty() {
        return;
    }
    if !matches!(
        event,
        "EFFECT_APPLIED" | "EFFECT_REFRESHED" | "EFFECT_REMOVED"
    ) {
        return;
    }
    if parse_ts_ms(ts).is_none() {
        return;
    }

    let key = buff_key(ability_id, ability_name);
    let source_key = buff_source_key(source_id, source_name);
    let stat = player
        .buff_uptimes
        .entry(key)
        .or_insert_with(|| BuffUptimeAccum {
            id: ability_id,
            name: ability_name.map(str::to_string),
            source_id: source_id.map(str::to_string),
            source_name: source_name.map(str::to_string),
            ..BuffUptimeAccum::default()
        });

    if stat.source_id.is_none() {
        stat.source_id = source_id.map(str::to_string);
    }
    if stat.source_name.is_none() {
        stat.source_name = source_name.map(str::to_string);
    }
    stat.current_stacks = stack_raw
        .and_then(|value| value.parse::<f64>().ok())
        .filter(|value| value.is_finite())
        .map(|value| value.max(0.0).floor() as i64)
        .unwrap_or(0);

    if event == "EFFECT_REMOVED" {
        stat.last_removed_at = Some(ts.to_string());
        let had_source = stat.active_sources.remove(&source_key);
        if stat.active_sources.is_empty() || (!had_source && stat.active_sources.len() <= 1) {
            close_buff_interval(stat, ts);
        }
        return;
    }

    if event == "EFFECT_APPLIED" {
        stat.applications += 1;
    }
    if event == "EFFECT_REFRESHED" {
        stat.refreshes += 1;
    }
    if stat.first_applied_at.is_none() {
        stat.first_applied_at = Some(ts.to_string());
    }
    stat.last_applied_at = Some(ts.to_string());

    if stat.active_sources.is_empty() || stat.active_since.is_none() {
        stat.active_since = Some(ts.to_string());
    }
    stat.active_sources.insert(source_key);
}

fn split_comma_outside_quotes(raw: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;

    for ch in raw.chars() {
        if ch == '"' {
            in_quotes = !in_quotes;
            current.push(ch);
            continue;
        }
        if ch == ',' && !in_quotes {
            result.push(current.trim().to_string());
            current.clear();
            continue;
        }
        current.push(ch);
    }

    result.push(current.trim().to_string());
    result
}

fn mark_combatant_info_buffs(player: &mut PlayerAccum, ts: &str, raw: Option<&String>) {
    let Some(raw) = raw else {
        return;
    };
    if !raw.starts_with('[') || !raw.ends_with(']') {
        return;
    }

    let mut start: Option<usize> = None;
    for (index, ch) in raw.char_indices() {
        if ch == '(' {
            start = Some(index + ch.len_utf8());
        } else if ch == ')' {
            if let Some(start_index) = start.take() {
                let fields = split_comma_outside_quotes(&raw[start_index..index]);
                if fields.len() < 7 {
                    continue;
                }
                let source_id = fields.first().map(String::as_str);
                let source_name = Some(unquote(fields.get(1)));
                let ability_id = to_i64(fields.get(2));
                let ability_name = Some(unquote(fields.get(3)));
                let aura_type = fields.get(6).map(String::as_str);
                mark_player_buff_effect(
                    player,
                    "EFFECT_APPLIED",
                    ts,
                    source_id,
                    source_name.as_deref(),
                    ability_id,
                    ability_name.as_deref(),
                    aura_type,
                    fields.get(5),
                );
            }
        }
    }
}

fn build_player_buff_uptimes(
    player: &PlayerAccum,
    now_ms: i64,
    window_duration_ms: i64,
) -> Vec<Value> {
    let normalized_window_ms = window_duration_ms.max(0) as f64;
    let mut values: Vec<Value> = player
        .buff_uptimes
        .values()
        .filter_map(|stat| {
            let mut uptime_ms = stat.total_ms.max(0);
            if let Some(active_since_ms) = stat.active_since.as_deref().and_then(parse_ts_ms) {
                if now_ms >= active_since_ms {
                    uptime_ms += now_ms - active_since_ms;
                }
            }
            if uptime_ms <= 0 && stat.applications <= 0 && stat.refreshes <= 0 {
                return None;
            }
            let uptime_percent = if normalized_window_ms > 0.0 {
                ((uptime_ms as f64 / normalized_window_ms) * 100.0).min(100.0)
            } else {
                0.0
            };
            Some(json!({
                "id": stat.id,
                "name": stat.name,
                "sourceId": stat.source_id,
                "sourceName": stat.source_name,
                "uptimeMs": uptime_ms,
                "uptimePercent": uptime_percent,
                "applications": stat.applications,
                "refreshes": stat.refreshes,
                "active": stat.active_since.is_some(),
                "currentStacks": stat.current_stacks,
                "firstAppliedAt": stat.first_applied_at,
                "lastAppliedAt": stat.last_applied_at,
                "lastRemovedAt": stat.last_removed_at,
            }))
        })
        .collect();

    values.sort_by(|left, right| {
        right["uptimeMs"]
            .as_i64()
            .unwrap_or(0)
            .cmp(&left["uptimeMs"].as_i64().unwrap_or(0))
            .then_with(|| {
                left["name"]
                    .as_str()
                    .unwrap_or("")
                    .cmp(right["name"].as_str().unwrap_or(""))
            })
    });
    values
}

fn process_line(state: &mut ParserState, line: &str) {
    let parts = split_log_line(line);
    if parts.len() < 2 {
        return;
    }

    let ts = parts[0].clone();
    let event = parts[1].clone();
    if !ts.is_empty() {
        state.latest_log_ts = Some(ts.clone());
        state
            .dungeon
            .resolve_pending_npc_underflow_deaths(&ts, false);
    }
    *state.counters.entry(event.clone()).or_insert(0) += 1;
    state.dungeon.note_boss_npc_in_line(&parts);
    if event != "COMBATANT_INFO" && event != "DUNGEON_START" {
        state.collecting_dungeon_party = false;
    }

    match event.as_str() {
        "DUNGEON_START" => {
            state.reset_dungeon_scope();
            state.collecting_dungeon_party = true;
            state.dungeon.start(&ts, &parts);
        }
        "DUNGEON_END" => {
            state.collecting_dungeon_party = false;
            state
                .dungeon
                .resolve_pending_npc_underflow_deaths(&ts, true);
            state.dungeon.end(&ts, &parts);
            for player in state.players.values_mut() {
                player.spirit_regen_per_second = 0.0;
                reset_player_relic_cooldowns(player);
            }
        }
        "ZONE_CHANGE" => {
            state
                .dungeon
                .resolve_pending_npc_underflow_deaths(&ts, true);
            if state.dungeon.zone_change(&parts) {
                state.reset_parser_scope();
            }
        }
        "COMBATANT_INFO" => {
            if !is_player_id(parts.get(3)) {
                return;
            }
            let id = parts[3].clone();
            let name = unquote(parts.get(4));
            let class_id = to_i64(parts.get(6));
            let player = ensure_player(&mut state.players, &id, Some(name.clone()));
            let (class_id, class_name, class_color) = class_info(class_id);
            player.class_id = class_id;
            player.name = Some(name.clone());
            player.stones = parse_stones(parts.get(10));
            player.relics = extract_relics_from_parts(&parts);
            mark_combatant_info_buffs(player, &ts, parts.get(13));
            player.spirit_stat_value = parts.get(8).and_then(|raw| {
                raw.trim_matches(&['[', ']'][..])
                    .split(',')
                    .next_back()
                    .and_then(|value| value.trim().parse::<f64>().ok())
            });
            player.spirit_regen_per_second = player
                .spirit_stat_value
                .map(|value| 0.3 + (value / 100.0))
                .unwrap_or(0.0);
            let _ = (class_name, class_color);

            if state.collecting_dungeon_party {
                if !state.party_player_ids.contains(&id) {
                    state.party_player_ids.push(id.clone());
                }
                if state.recent_skills_player_id.is_none() {
                    state.recent_skills_player_id = Some(id);
                    state.recent_skills_player_name = Some(name);
                }
            }
        }
        "ENCOUNTER_START" => {
            let encounter_id = to_i64(parts.get(2));
            let encounter_name = unquote(parts.get(3));
            state.dungeon.encounter_start(&ts, &encounter_name);
            let encounter = EncounterAccum {
                id: encounter_id,
                name: parse_encounter_name(parts.get(3)),
                started_at: Some(ts),
                ..EncounterAccum::default()
            };
            state.current_encounter = Some(encounter.clone());
            state.encounters.push(encounter);
            if state.encounters.len() > 2 {
                let excess = state.encounters.len() - 2;
                state.encounters.drain(0..excess);
            }
        }
        "ENCOUNTER_END" => {
            let encounter_id = to_i64(parts.get(2));
            let success = parts.get(4).map(|value| value == "1").unwrap_or(false);
            state
                .dungeon
                .resolve_pending_npc_underflow_deaths(&ts, true);
            state.dungeon.encounter_end(&ts);
            if let Some(current) = state.current_encounter.as_mut() {
                if current.id.is_none() {
                    current.id = encounter_id;
                }
                current.ended_at = Some(ts.clone());
                current.success = Some(success);
                if let Some(last) = state.encounters.last_mut() {
                    *last = current.clone();
                }
            } else if let Some(last) = state.encounters.last_mut() {
                if last.id.is_none() {
                    last.id = encounter_id;
                }
                last.ended_at = Some(ts.clone());
                last.success = Some(success);
            }
            state.current_encounter = None;
        }
        "ABILITY_ACTIVATED"
        | "ABILITY_CAST_START"
        | "ABILITY_CAST_SUCCESS"
        | "ABILITY_CAST_FAIL"
        | "ABILITY_CHANNEL_START"
        | "ABILITY_CHANNEL_SUCCESS"
        | "ABILITY_CHANNEL_FAIL" => {
            let source_id = parts.get(2).cloned().unwrap_or_default();
            if !source_id.starts_with("Player-") {
                return;
            }
            let source_name = unquote(parts.get(3));
            let ability_id = to_i64(parts.get(4));
            let ability_name = unquote(parts.get(5));
            let target_id = parts.get(7).cloned().unwrap_or_default();
            let target_name = unquote(parts.get(8));
            let player = ensure_player(&mut state.players, &source_id, Some(source_name.clone()));
            if event == "ABILITY_ACTIVATED" {
                let is_equipped_relic = is_equipped_relic_ability(player, ability_id);
                add_ability(
                    player,
                    ability_id,
                    Some(ability_name.clone()),
                    "activation",
                    0.0,
                    Some(&ts),
                );
                add_encounter_ability(
                    state.current_encounter.as_mut(),
                    &source_id,
                    &source_name,
                    ability_id,
                    Some(ability_name.clone()),
                    "activation",
                    0.0,
                    Some(&ts),
                );
                mark_relic_use(player, ability_id, &ts);
                update_spirit_from_bloodbound_ability(player, &ts, ability_id, &ability_name);
                if is_chickenize_ability(ability_id, &ability_name) && is_npc_id(&target_id) {
                    state
                        .dungeon
                        .mark_npc_chickenized(&ts, &target_id, Some(&target_name));
                }
                if !is_equipped_relic
                    && state.recent_skills_player_id.as_deref() == Some(source_id.as_str())
                {
                    state.recent_skills.push(json!({
                        "ts": ts,
                        "playerId": source_id,
                        "playerName": source_name,
                        "classId": player.class_id,
                        "className": class_info(player.class_id).1,
                        "abilityId": ability_id,
                        "abilityName": ability_name,
                        "icon": null
                    }));
                    if state.recent_skills.len() > 30 {
                        state.recent_skills.remove(0);
                    }
                }
            }
            if let Some((current, max)) = extract_spirit(parts.get(15)) {
                add_spirit(player, &ts, current, max, ability_id, Some(ability_name));
            }
        }
        "EVENT_INVALID" => {
            let source_id = parts.get(2).cloned().unwrap_or_default();
            let source_name = unquote(parts.get(3));
            let target_id = parts.get(4).cloned().unwrap_or_default();
            let target_name = unquote(parts.get(5));
            let ability_id = to_i64(parts.get(6));
            let ability_name = unquote(parts.get(7));

            if source_id.starts_with("Player-") {
                let player = ensure_player(&mut state.players, &source_id, Some(source_name));
                if let Some((current, max)) = extract_spirit(parts.get(22)) {
                    add_spirit(
                        player,
                        &ts,
                        current,
                        max,
                        ability_id,
                        Some(ability_name.clone()),
                    );
                }
            }
            if target_id.starts_with("Player-") {
                let player = ensure_player(&mut state.players, &target_id, Some(target_name));
                if let Some((current, max)) = extract_spirit(parts.get(29)) {
                    add_spirit(player, &ts, current, max, ability_id, Some(ability_name));
                }
            }
        }
        "ABILITY_DAMAGE" | "SWING_DAMAGE" | "ABILITY_PERIODIC_DAMAGE" => {
            let source_id = parts.get(2).cloned().unwrap_or_default();
            let target_id = parts.get(4).cloned().unwrap_or_default();
            let target_name = unquote(parts.get(5));
            let amount = to_f64(parts.get(9));
            let ability_id = to_i64(parts.get(6));
            let ability_name = unquote(parts.get(7));

            if is_npc_id(&target_id) {
                state
                    .dungeon
                    .touch_current_pull(&ts, &target_id, Some(&target_name));
                state.dungeon.mark_npc_underflow_if_needed(
                    &ts,
                    &target_id,
                    Some(&target_name),
                    parts.get(23),
                    parts.get(24),
                );
                if source_id.starts_with("Player-")
                    && is_chickenize_ability(ability_id, &ability_name)
                {
                    state
                        .dungeon
                        .mark_npc_chickenized(&ts, &target_id, Some(&target_name));
                }
            }
            if is_npc_id(&source_id) {
                let source_name = unquote(parts.get(3));
                state
                    .dungeon
                    .touch_current_pull(&ts, &source_id, Some(&source_name));
            }

            if source_id.starts_with("Player-") {
                let source_name = unquote(parts.get(3));
                let player = ensure_player(&mut state.players, &source_id, Some(source_name));
                player.damage_done += amount;
                add_ability(
                    player,
                    ability_id,
                    Some(ability_name.clone()),
                    "damage",
                    amount,
                    None,
                );
                if let Some(encounter) = state.current_encounter.as_mut() {
                    add_encounter_ability(
                        Some(encounter),
                        &source_id,
                        player.name.as_deref().unwrap_or(""),
                        ability_id,
                        Some(ability_name.clone()),
                        "damage",
                        amount,
                        None,
                    );
                    add_to_map_number(
                        &mut encounter.damage_by_player,
                        actor_key(&source_id, player.name.as_deref()),
                        amount,
                    );
                    if let Some(last) = state.encounters.last_mut() {
                        *last = encounter.clone();
                    }
                }
                if let Some((current, max)) = extract_spirit(parts.get(22)) {
                    add_spirit(
                        player,
                        &ts,
                        current,
                        max,
                        ability_id,
                        Some(ability_name.clone()),
                    );
                }
            }
            if target_id.starts_with("Player-") {
                let player = ensure_player(&mut state.players, &target_id, Some(target_name));
                player.damage_taken += amount;
                if let Some((current, max)) = extract_spirit(parts.get(29)) {
                    add_spirit(player, &ts, current, max, ability_id, Some(ability_name));
                }
            }
        }
        "ABILITY_HEAL" | "ABILITY_PERIODIC_HEAL" => {
            let source_id = parts.get(2).cloned().unwrap_or_default();
            if source_id.starts_with("Player-") {
                let source_name = unquote(parts.get(3));
                let ability_id = to_i64(parts.get(6));
                let ability_name = unquote(parts.get(7));
                let amount = to_f64(parts.get(11));
                let player = ensure_player(&mut state.players, &source_id, Some(source_name));
                player.healing_done += amount;
                add_ability(
                    player,
                    ability_id,
                    Some(ability_name.clone()),
                    "healing",
                    amount,
                    None,
                );
                if let Some(encounter) = state.current_encounter.as_mut() {
                    add_encounter_ability(
                        Some(encounter),
                        &source_id,
                        player.name.as_deref().unwrap_or(""),
                        ability_id,
                        Some(ability_name.clone()),
                        "healing",
                        amount,
                        None,
                    );
                    add_to_map_number(
                        &mut encounter.healing_by_player,
                        actor_key(&source_id, player.name.as_deref()),
                        amount,
                    );
                    if let Some(last) = state.encounters.last_mut() {
                        *last = encounter.clone();
                    }
                }
                if let Some((current, max)) = extract_spirit(parts.get(22)) {
                    add_spirit(player, &ts, current, max, ability_id, Some(ability_name));
                }
            }
        }
        "EFFECT_APPLIED" | "EFFECT_REFRESHED" | "EFFECT_REMOVED" => {
            let source_id = parts.get(2).cloned().unwrap_or_default();
            let source_name = unquote(parts.get(3));
            let target_id = parts.get(4).cloned().unwrap_or_default();
            let target_name = unquote(parts.get(5));
            let ability_id = to_i64(parts.get(6));
            let ability_name = unquote(parts.get(7));

            if is_npc_id(&source_id) && target_id.starts_with("Player-") {
                state
                    .dungeon
                    .touch_current_pull(&ts, &source_id, Some(&source_name));
            }
            if is_npc_id(&target_id) && source_id.starts_with("Player-") {
                state
                    .dungeon
                    .touch_current_pull(&ts, &target_id, Some(&target_name));
                if is_chickenize_ability(ability_id, &ability_name) {
                    state
                        .dungeon
                        .mark_npc_chickenized(&ts, &target_id, Some(&target_name));
                }
            }
            if target_id.starts_with("Player-") {
                let player = ensure_player(&mut state.players, &target_id, Some(target_name));
                mark_player_buff_effect(
                    player,
                    &event,
                    &ts,
                    Some(&source_id),
                    Some(&source_name),
                    ability_id,
                    Some(&ability_name),
                    parts.get(10).map(String::as_str),
                    parts.get(9),
                );
                update_spirit_from_rising_spirit_effect(
                    player,
                    &event,
                    &ts,
                    ability_id,
                    &ability_name,
                    parts.get(9),
                );
                if let Some((current, max)) = extract_spirit(parts.get(17)) {
                    add_spirit(player, &ts, current, max, ability_id, Some(ability_name));
                }
            }
        }
        "UNIT_DEATH" | "UNIT_DESTROYED" => {
            let dead_id = parts.get(2).cloned().unwrap_or_default();
            if event == "UNIT_DEATH" && dead_id.starts_with("Player-") {
                let dead_name = unquote(parts.get(3));
                ensure_player(&mut state.players, &dead_id, Some(dead_name)).deaths += 1;
            } else if is_npc_id(&dead_id) {
                let dead_name = unquote(parts.get(3));
                state
                    .dungeon
                    .mark_current_pull_death(&ts, &dead_id, Some(&dead_name));
                if let Some(encounter) = state.current_encounter.as_mut() {
                    encounter.npc_deaths.push(json!({
                        "ts": ts,
                        "npcId": dead_id,
                        "npcName": dead_name,
                        "killerId": if event == "UNIT_DEATH" { parts.get(4).cloned() } else { None },
                        "killerName": if event == "UNIT_DEATH" { Some(unquote(parts.get(5))) } else { None },
                        "killingAbilityId": if event == "UNIT_DEATH" { to_i64(parts.get(6)) } else { None },
                        "killingAbility": if event == "UNIT_DEATH" { Some(unquote(parts.get(7))) } else { None }
                    }));
                    if encounter.npc_deaths.len() > 200 {
                        let excess = encounter.npc_deaths.len() - 200;
                        encounter.npc_deaths.drain(0..excess);
                    }
                    if let Some(last) = state.encounters.last_mut() {
                        *last = encounter.clone();
                    }
                }
            }
        }
        _ => {}
    }
}

fn finalize_state(state: &ParserState) -> ParsedLog {
    let derived_latest_ms = state
        .players
        .values()
        .flat_map(|player| {
            let spirit_ts = player
                .spirit
                .as_ref()
                .and_then(|spirit| spirit["ts"].as_str())
                .and_then(parse_ts_ms);
            let relic_times = player
                .relics
                .iter()
                .filter_map(|relic| relic["lastUsedAt"].as_str().and_then(parse_ts_ms));
            spirit_ts.into_iter().chain(relic_times)
        })
        .max()
        .unwrap_or(0);
    let latest_log_ms = state
        .latest_log_ts
        .as_deref()
        .and_then(parse_ts_ms)
        .unwrap_or(0)
        .max(derived_latest_ms);
    let dungeon = state.dungeon.dungeon_json();
    let time_correction_ms = dungeon["timeCorrectionMs"].as_i64().unwrap_or(0);
    let corrected_client_now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64 + time_correction_ms)
        .unwrap_or(latest_log_ms);
    let cooldown_now_ms = corrected_client_now_ms.max(latest_log_ms);
    let encounters = state.encounters.clone();
    let dungeon_started_at_ms = dungeon["startedAt"].as_str().and_then(parse_ts_ms);
    let dungeon_ended_at_ms = dungeon["endedAt"].as_str().and_then(parse_ts_ms);
    let buff_now_ms = dungeon_ended_at_ms.unwrap_or(latest_log_ms.max(cooldown_now_ms));
    let buff_window_start_ms = dungeon_started_at_ms.unwrap_or(buff_now_ms);
    let buff_window_duration_ms = (buff_now_ms - buff_window_start_ms).max(0);

    let mut player_values: Vec<Value> = state
        .players
        .values()
        .filter(|player| {
            state.party_player_ids.is_empty() || state.party_player_ids.contains(&player.id)
        })
        .cloned()
        .map(|player| {
            let (_, class_name, class_color) = class_info(player.class_id);
            let mut abilities: Vec<Value> =
                player.abilities.values().map(ability_to_json).collect();
            sort_abilities_by_score(&mut abilities);
            let combat_abilities = combat_ability_values(player.abilities.values());
            json!({
                "id": player.id,
                "name": player.name,
                "classId": player.class_id,
                "className": class_name,
                "classColor": class_color,
                "damageDone": player.damage_done,
                "healingDone": player.healing_done,
                "damageTaken": player.damage_taken,
                "deaths": player.deaths,
                "abilities": abilities,
                "combatAbilities": combat_abilities,
                "spirit": player.spirit,
                "spiritHistory": player.spirit_history,
                "relics": compute_relic_cooldown_state(&player, cooldown_now_ms),
                "stones": player.stones,
                "spiritStatValue": player.spirit_stat_value,
                "spiritRegenPerSecond": player.spirit_regen_per_second,
                "usesPerBoss": build_uses_per_boss(&player, &encounters),
                "buffUptimes": build_player_buff_uptimes(&player, buff_now_ms, buff_window_duration_ms)
            })
        })
        .collect();

    player_values.sort_by(|left, right| {
        right["damageDone"]
            .as_f64()
            .unwrap_or(0.0)
            .partial_cmp(&left["damageDone"].as_f64().unwrap_or(0.0))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let data = json!({
        "latestLogTs": state.latest_log_ts,
        "dungeon": dungeon,
        "timeCorrectionMs": time_correction_ms,
        "timeCorrectionServerTs": dungeon["timeCorrectionServerTs"].clone(),
        "timeCorrectionClientTs": dungeon["timeCorrectionClientTs"].clone(),
        "players": player_values,
        "recentSkills": state.recent_skills,
        "recentSkillsPlayerId": state.recent_skills_player_id,
        "recentSkillsPlayerName": state.recent_skills_player_name,
        "partyPlayerIds": state.party_player_ids,
        "encounters": encounters.iter().map(encounter_to_json).collect::<Vec<_>>(),
        "npcDeaths": state.dungeon.npc_deaths_json(),
        "currentPull": state.dungeon.current_pull_summary(),
        "counters": state.counters
    });

    ParsedLog { data }
}

fn process_file_range(
    file_path: &Path,
    start: u64,
    end: u64,
    leftover: &mut String,
    state: &mut ParserState,
) -> Result<(), String> {
    if end <= start {
        return Ok(());
    }

    let mut file = File::open(file_path).map_err(|error| error.to_string())?;
    file.seek(SeekFrom::Start(start))
        .map_err(|error| error.to_string())?;
    let mut raw_bytes = Vec::new();
    file.take(end - start)
        .read_to_end(&mut raw_bytes)
        .map_err(|error| error.to_string())?;
    let raw = String::from_utf8_lossy(&raw_bytes);

    let mut combined = String::new();
    if !leftover.is_empty() {
        combined.push_str(leftover);
        leftover.clear();
    }
    combined.push_str(&raw);

    if combined.ends_with('\n') || combined.ends_with('\r') {
        for line in combined.lines() {
            process_line(state, line);
        }
        return Ok(());
    }

    if let Some(last_newline) = combined.rfind('\n') {
        let complete = &combined[..last_newline];
        for line in complete.lines() {
            process_line(state, line);
        }
        *leftover = combined[last_newline + 1..]
            .trim_end_matches('\r')
            .to_string();
    } else {
        *leftover = combined;
    }

    Ok(())
}

fn parse_log_file(file_path: &Path) -> Result<ParsedLog, String> {
    let metadata = fs::metadata(file_path).map_err(|error| error.to_string())?;
    let size = metadata.len();
    let modified = metadata.modified().ok();
    let identity = get_file_identity(&metadata);
    let cache_mutex = PARSER_CACHE.get_or_init(|| Mutex::new(None));
    let mut cache_slot = cache_mutex.lock().map_err(|error| error.to_string())?;

    let can_reuse = cache_slot
        .as_ref()
        .map(|cache| {
            cache.file_path == file_path && cache.identity == identity && size >= cache.offset
        })
        .unwrap_or(false);

    if !can_reuse {
        let start_offset = find_recent_dungeon_parse_offset(file_path, size)?;
        let mut state = ParserState::new();
        let mut leftover = String::new();
        process_file_range(file_path, start_offset, size, &mut leftover, &mut state)?;
        *cache_slot = Some(ParserCache {
            file_path: file_path.to_path_buf(),
            identity,
            offset: size,
            leftover,
            state,
            size,
            modified,
        });
    } else if let Some(cache) = cache_slot.as_mut() {
        if let Err(error) = process_file_range(
            file_path,
            cache.offset,
            size,
            &mut cache.leftover,
            &mut cache.state,
        ) {
            *cache_slot = None;
            return Err(error);
        }
        cache.offset = size;
        cache.size = size;
        cache.modified = modified;
    }

    cache_slot
        .as_ref()
        .map(|cache| finalize_state(&cache.state))
        .ok_or_else(|| "Parser cache was not initialized".to_string())
}

pub fn build_log_data_payload(file_path: &Path) -> Value {
    match parse_log_file(file_path) {
        Ok(parsed) => json!({
            "ok": true,
            "filePath": file_path.to_string_lossy().to_string(),
            "directoryPath": file_path.parent().map(|path| path.to_string_lossy().to_string()),
            "data": parsed.data,
            "updatedAt": system_time_string()
        }),
        Err(error) => json!({
            "ok": false,
            "filePath": file_path.to_string_lossy().to_string(),
            "directoryPath": file_path.parent().map(|path| path.to_string_lossy().to_string()),
            "error": error
        }),
    }
}

fn system_time_string() -> String {
    // Good enough for payload freshness; renderer does not parse this for game time.
    format!("{:?}", std::time::SystemTime::now())
}
