use crate::game_database::{empowered_scaling_data, load_dungeon_data, npc_spirit_values};
use crate::parser_line_utils::{is_npc_id, parse_ts_ms, to_i64, unquote_str};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};

const CURRENT_PULL_RESET_MS: i64 = 8000;
const NPC_UNDERFLOW_FALLBACK_MS: i64 = 1500;
const BOSS_SUMMON_MIN_DELAY_MS: i64 = 12000;
const DEATH_SUMMON_WINDOW_MS: i64 = 3000;
const SPELLBOUND_GOLEM_TEMPLATE_ID: i64 = 160;
const ICE_SHARDLING_TEMPLATE_ID: i64 = 161;
const CHICKENIZE_RELIC_ID: i64 = 1478;
const EMPOWERED_HP_RATIO_MIN: f64 = 1.5;
const EMPOWERED_HP_RATIO_MAX: f64 = 2.6;

#[derive(Clone)]
struct CurrentPullNpc {
    unit_id: String,
    template_id: Option<i64>,
    name: String,
    score: f64,
    percent: f64,
    max_hp: Option<f64>,
    current_hp: Option<f64>,
    lowest_hp_fraction: f64,
    empowered: bool,
    empowered_confirmed: bool,
    first_seen_at: String,
    last_seen_at: String,
    dead_at: Option<String>,
    dead_at_ms: Option<i64>,
    suspected_dead_at: Option<String>,
    suspected_dead_at_ms: Option<i64>,
    chickenized_at: Option<String>,
    chickenized: bool,
    boss_spawned_at: Option<String>,
    boss_spawned: bool,
}

#[derive(Default, Clone)]
struct CurrentPullState {
    started_at: Option<String>,
    last_combat_at: Option<String>,
    last_combat_at_ms: Option<i64>,
    npc_map: HashMap<String, CurrentPullNpc>,
}

#[derive(Clone)]
pub struct DungeonTracker {
    dungeon: Value,
    dungeon_data: Option<Value>,
    current_pull: CurrentPullState,
    counted_npc_deaths: HashSet<String>,
    dead_npc_ids: HashSet<String>,
    chickenized_npc_ids: HashSet<String>,
    boss_spawned_npc_ids: HashSet<String>,
    empowered_npc_ids: HashSet<String>,
    empowered_affix_active: bool,
    last_reported_progress: Option<f64>,
    last_spellbound_golem_death_ms: Option<i64>,
    npc_deaths: Vec<Value>,
    boss_fight_active: bool,
    boss_fight_started_at_ms: Option<i64>,
}

impl DungeonTracker {
    pub fn new() -> Self {
        Self {
            dungeon: create_dungeon_state(),
            dungeon_data: None,
            current_pull: CurrentPullState::default(),
            counted_npc_deaths: HashSet::new(),
            dead_npc_ids: HashSet::new(),
            chickenized_npc_ids: HashSet::new(),
            boss_spawned_npc_ids: HashSet::new(),
            empowered_npc_ids: HashSet::new(),
            empowered_affix_active: false,
            last_reported_progress: None,
            last_spellbound_golem_death_ms: None,
            npc_deaths: Vec::new(),
            boss_fight_active: false,
            boss_fight_started_at_ms: None,
        }
    }

    pub fn reset_scope(&mut self) {
        self.dungeon = create_dungeon_state();
        self.dungeon_data = None;
        self.current_pull = CurrentPullState::default();
        self.counted_npc_deaths.clear();
        self.dead_npc_ids.clear();
        self.chickenized_npc_ids.clear();
        self.boss_spawned_npc_ids.clear();
        self.empowered_npc_ids.clear();
        self.empowered_affix_active = false;
        self.last_reported_progress = None;
        self.last_spellbound_golem_death_ms = None;
        self.npc_deaths.clear();
        self.boss_fight_active = false;
        self.boss_fight_started_at_ms = None;
    }

    pub fn start(&mut self, ts: &str, parts: &[&str]) {
        self.reset_scope();
        let name = unquote_str(parts.get(2).copied());
        let id = to_i64(parts.get(3).copied());
        self.dungeon_data = load_dungeon_data(id, Some(name));
        let client_ts = parts.get(7).copied();
        let time_correction_ms = parse_ts_ms(ts)
            .zip(client_ts.and_then(parse_ts_ms))
            .map(|(server_ms, client_ms)| server_ms - client_ms)
            .unwrap_or(0);
        self.dungeon["startedAt"] = json!(ts);
        self.dungeon["timeCorrectionMs"] = json!(time_correction_ms);
        self.dungeon["timeCorrectionServerTs"] = json!(ts);
        self.dungeon["timeCorrectionClientTs"] = json!(client_ts);
        self.dungeon["name"] = json!(name);
        self.dungeon["id"] = json!(id);
        self.dungeon["difficulty"] = json!(to_i64(parts.get(4).copied()));
        self.dungeon["affixes"] = json!(parts.get(5).copied());
        self.empowered_affix_active = parts
            .get(5)
            .map(|raw| affix_list_contains(raw, empowered_affix_id()))
            .unwrap_or(false);
        self.dungeon["data"] = self.dungeon_data.clone().unwrap_or(Value::Null);
    }

    pub fn end(&mut self, ts: &str, parts: &[&str]) {
        let name = unquote_str(parts.get(2).copied());
        let id = to_i64(parts.get(3).copied());
        if self.dungeon_data.is_none() {
            self.dungeon_data = load_dungeon_data(id, Some(name));
        }
        self.dungeon["endedAt"] = json!(ts);
        self.dungeon["name"] = json!(name);
        self.dungeon["id"] = json!(id);
        self.dungeon["difficulty"] = json!(to_i64(parts.get(4).copied()));
        self.dungeon["success"] = json!(parts.get(6).map(|value| *value == "1").unwrap_or(false));
        self.dungeon["durationMs"] = json!(to_i64(parts.get(7).copied()));
        self.dungeon["completionSeconds"] = json!(to_i64(parts.get(8).copied()));
        self.dungeon["deaths"] = json!(to_i64(parts.get(9).copied()));
        self.dungeon["data"] = self.dungeon_data.clone().unwrap_or(Value::Null);
    }

    pub fn zone_change(&mut self, parts: &[&str]) -> bool {
        let name = unquote_str(parts.get(2).copied());
        let id = to_i64(parts.get(3).copied());
        let dungeon_data = load_dungeon_data(id, Some(name));
        let recognized_dungeon = dungeon_data.is_some();
        if recognized_dungeon {
            self.reset_scope();
        }
        self.dungeon_data = dungeon_data;
        self.dungeon["name"] = json!(name);
        self.dungeon["id"] = json!(id);
        self.dungeon["difficulty"] = json!(to_i64(parts.get(4).copied()));
        self.dungeon["data"] = self.dungeon_data.clone().unwrap_or(Value::Null);
        self.dungeon["completedPercent"] = json!(0);
        recognized_dungeon
    }

    pub fn touch_current_pull(&mut self, ts: &str, npc_id: &str, npc_name: Option<&str>) {
        if !is_npc_id(npc_id) {
            return;
        }
        if self.dead_npc_ids.contains(npc_id) {
            return;
        }
        let Some(ts_ms) = parse_ts_ms(ts) else {
            return;
        };

        let last_death_ms = self
            .current_pull
            .npc_map
            .values()
            .filter_map(|mob| mob.dead_at_ms)
            .max()
            .unwrap_or(0);
        let all_known_mobs_dead = !self.current_pull.npc_map.is_empty()
            && self
                .current_pull
                .npc_map
                .values()
                .all(|mob| mob.dead_at.is_some());

        if self
            .current_pull
            .last_combat_at_ms
            .map(|last| ts_ms - last > CURRENT_PULL_RESET_MS)
            .unwrap_or(false)
            || (all_known_mobs_dead && last_death_ms > 0 && ts_ms - last_death_ms > 500)
        {
            self.reset_current_pull(ts, Some(ts_ms));
        }

        if self.current_pull.started_at.is_none() {
            self.current_pull.started_at = Some(ts.to_string());
        }
        self.current_pull.last_combat_at = Some(ts.to_string());
        self.current_pull.last_combat_at_ms = Some(ts_ms);

        if let Some(npc) = self.current_pull.npc_map.get_mut(npc_id) {
            npc.last_seen_at = ts.to_string();
            if npc.chickenized_at.is_some() || self.chickenized_npc_ids.contains(npc_id) {
                npc.chickenized = true;
            }
            if npc.boss_spawned_at.is_some() || self.boss_spawned_npc_ids.contains(npc_id) {
                npc.boss_spawned = true;
            }
            if self.empowered_npc_ids.contains(npc_id) {
                npc.empowered = true;
            }
            return;
        }

        let meta = self.npc_percent_meta(npc_id, npc_name);
        let boss_spawned = self.should_treat_npc_as_boss_spawned(meta.template_id, ts_ms);
        let npc = self
            .current_pull
            .npc_map
            .entry(npc_id.to_string())
            .or_insert_with(|| CurrentPullNpc {
                unit_id: npc_id.to_string(),
                template_id: meta.template_id,
                name: meta.name.clone(),
                score: meta.score,
                percent: meta.percent,
                max_hp: None,
                current_hp: None,
                lowest_hp_fraction: 1.0,
                empowered: self.empowered_npc_ids.contains(npc_id),
                empowered_confirmed: false,
                first_seen_at: ts.to_string(),
                last_seen_at: ts.to_string(),
                dead_at: None,
                dead_at_ms: None,
                suspected_dead_at: None,
                suspected_dead_at_ms: None,
                chickenized_at: None,
                chickenized: false,
                boss_spawned_at: if boss_spawned {
                    Some(ts.to_string())
                } else {
                    None
                },
                boss_spawned,
            });

        if boss_spawned {
            self.boss_spawned_npc_ids.insert(npc_id.to_string());
        }

        npc.last_seen_at = ts.to_string();
        npc.template_id = meta.template_id;
        npc.name = meta.name;
        npc.score = meta.score;
        npc.percent = meta.percent;
        if npc.chickenized_at.is_some() || self.chickenized_npc_ids.contains(npc_id) {
            npc.chickenized = true;
        }
        if npc.boss_spawned_at.is_some() || self.boss_spawned_npc_ids.contains(npc_id) {
            npc.boss_spawned = true;
        }
        if self.empowered_npc_ids.contains(npc_id) {
            npc.empowered = true;
        }
    }

    pub fn observe_current_pull_npc(
        &mut self,
        ts: &str,
        npc_id: &str,
        npc_name: Option<&str>,
        current_hp_raw: Option<&str>,
        max_hp_raw: Option<&str>,
    ) {
        self.touch_current_pull(ts, npc_id, npc_name);
        let max_hp = max_hp_raw
            .and_then(|value| value.parse::<f64>().ok())
            .filter(|value| value.is_finite() && *value > 0.0);
        let current_hp = current_hp_raw
            .and_then(|value| value.parse::<f64>().ok())
            .filter(|value| value.is_finite() && *value >= 0.0);
        let Some(max_hp) = max_hp else {
            return;
        };
        let template_id = extract_npc_template_id(npc_id);
        let empowered = template_id
            .map(|template_id| self.is_empowered_max_hp(template_id, max_hp))
            .unwrap_or(false);
        if empowered {
            self.empowered_npc_ids.insert(npc_id.to_string());
        }
        if let Some(npc) = self.current_pull.npc_map.get_mut(npc_id) {
            npc.max_hp = Some(max_hp);
            if let Some(current_hp) = current_hp {
                npc.current_hp = Some(current_hp);
                npc.lowest_hp_fraction = npc
                    .lowest_hp_fraction
                    .min((current_hp / max_hp).clamp(0.0, 1.0));
            }
            if empowered {
                npc.empowered = true;
            }
        }
    }

    pub fn mark_empowered_victory_rush(
        &mut self,
        ts: &str,
        npc_id: &str,
        npc_name: Option<&str>,
    ) {
        if !self.empowered_affix_active || !is_npc_id(npc_id) {
            return;
        }
        self.empowered_npc_ids.insert(npc_id.to_string());
        self.touch_current_pull(ts, npc_id, npc_name);
        if let Some(npc) = self.current_pull.npc_map.get_mut(npc_id) {
            npc.empowered = true;
            npc.empowered_confirmed = true;
        }
    }

    pub fn mark_npc_chickenized(&mut self, ts: &str, npc_id: &str, npc_name: Option<&str>) {
        if !is_npc_id(npc_id) {
            return;
        }
        self.touch_current_pull(ts, npc_id, npc_name);
        if let Some(npc) = self.current_pull.npc_map.get_mut(npc_id) {
            npc.chickenized_at.get_or_insert_with(|| ts.to_string());
            npc.chickenized = true;
        }
        self.chickenized_npc_ids.insert(npc_id.to_string());
    }

    pub fn mark_current_pull_death_with_progress(
        &mut self,
        ts: &str,
        npc_id: &str,
        npc_name: Option<&str>,
        reported_progress_raw: Option<&str>,
    ) {
        if !is_npc_id(npc_id) {
            return;
        }
        self.touch_current_pull(ts, npc_id, npc_name);
        if let Some(npc) = self.current_pull.npc_map.get_mut(npc_id) {
            npc.dead_at = Some(ts.to_string());
            npc.dead_at_ms = parse_ts_ms(ts);
        }
        self.dead_npc_ids.insert(npc_id.to_string());
        if extract_npc_template_id(npc_id) == Some(SPELLBOUND_GOLEM_TEMPLATE_ID) {
            self.last_spellbound_golem_death_ms = parse_ts_ms(ts);
        }
        let counts_for_progress = reported_progress_raw
            .and_then(|value| value.parse::<f64>().ok())
            .filter(|value| value.is_finite() && (0.0..=1.0).contains(value))
            .map(|progress| {
                let previous = self.last_reported_progress.unwrap_or(0.0);
                self.last_reported_progress = Some(progress);
                progress > previous
            })
            .unwrap_or(true);
        if counts_for_progress {
            self.register_npc_death(ts, npc_id, npc_name);
        }
    }

    pub fn mark_npc_underflow_if_needed(
        &mut self,
        ts: &str,
        npc_id: &str,
        npc_name: Option<&str>,
        current_hp_raw: Option<&str>,
        max_hp_raw: Option<&str>,
    ) {
        if !is_npc_id(npc_id) {
            return;
        }
        let current_hp = current_hp_raw
            .and_then(|value| value.parse::<f64>().ok())
            .unwrap_or(0.0);
        let max_hp = max_hp_raw
            .and_then(|value| value.parse::<f64>().ok())
            .unwrap_or(0.0);
        if !current_hp.is_finite() || !max_hp.is_finite() || max_hp <= 0.0 || current_hp <= max_hp {
            return;
        }

        self.touch_current_pull(ts, npc_id, npc_name);
        if let Some(npc) = self.current_pull.npc_map.get_mut(npc_id) {
            if npc.dead_at.is_none() && npc.suspected_dead_at.is_none() {
                npc.suspected_dead_at = Some(ts.to_string());
                npc.suspected_dead_at_ms = parse_ts_ms(ts);
            }
        }
    }

    pub fn resolve_pending_npc_underflow_deaths(&mut self, ts: &str, force: bool) {
        if !force
            && !self
                .current_pull
                .npc_map
                .values()
                .any(|npc| npc.dead_at.is_none() && npc.suspected_dead_at.is_some())
        {
            return;
        }
        let Some(ts_ms) = parse_ts_ms(ts) else {
            return;
        };

        let deaths: Vec<(String, String, String)> = self
            .current_pull
            .npc_map
            .values()
            .filter(|npc| npc.dead_at.is_none())
            .filter_map(|npc| {
                let suspected_at = npc.suspected_dead_at.clone()?;
                let suspected_ms = npc.suspected_dead_at_ms?;
                if !force && ts_ms - suspected_ms < NPC_UNDERFLOW_FALLBACK_MS {
                    return None;
                }
                Some((npc.unit_id.clone(), npc.name.clone(), suspected_at))
            })
            .collect();

        for (npc_id, npc_name, death_ts) in deaths {
            if let Some(npc) = self.current_pull.npc_map.get_mut(&npc_id) {
                if npc.dead_at.is_none() {
                    npc.dead_at = Some(death_ts.clone());
                    npc.dead_at_ms = parse_ts_ms(&death_ts);
                }
                npc.suspected_dead_at = None;
                npc.suspected_dead_at_ms = None;
            }
            self.dead_npc_ids.insert(npc_id.clone());
            self.register_npc_death(&death_ts, &npc_id, Some(&npc_name));
        }
    }

    pub fn encounter_start(&mut self, ts: &str, _encounter_name: &str) {
        // ENCOUNTER_START is emitted for dungeon bosses. Matching its localized display
        // name against the English dungeon data made boss summons count on RU clients.
        self.boss_fight_active = self.dungeon_data.is_some() && !self.boss_template_ids().is_empty();
        self.boss_fight_started_at_ms = parse_ts_ms(ts);
    }

    pub fn encounter_end(&mut self, ts: &str) {
        self.resolve_pending_npc_underflow_deaths(ts, true);
        self.boss_fight_active = false;
        self.boss_fight_started_at_ms = None;
    }

    pub fn note_boss_npc_in_line(&mut self, parts: &[&str]) {
        if !self.boss_fight_active {
            return;
        }
        for value in parts {
            if !is_npc_id(value) {
                continue;
            }
            let Some(template_id) = extract_npc_template_id(value) else {
                continue;
            };
            if !self.is_boss_template_id(template_id) {
                continue;
            }
            self.boss_spawned_npc_ids.remove(*value);
            if let Some(npc) = self.current_pull.npc_map.get_mut(*value) {
                npc.boss_spawned = false;
                npc.boss_spawned_at = None;
            }
        }
    }

    pub fn dungeon_json(&self) -> Value {
        let mut dungeon = self.dungeon.clone();
        dungeon["completedPercent"] = json!(self.completed_percent());
        dungeon["killCount"] = self
            .dungeon_data
            .as_ref()
            .and_then(|data| data.get("killcount"))
            .cloned()
            .unwrap_or(Value::Null);
        dungeon["data"] = self.dungeon_data.clone().unwrap_or(Value::Null);
        dungeon
    }

    pub fn npc_deaths_json(&self) -> Value {
        json!(self.npc_deaths)
    }

    pub fn current_pull_summary_for_party(&self, party_size: usize) -> Value {
        if self.current_pull.npc_map.is_empty() {
            return json!({
                "startedAt": null,
                "lastCombatAt": null,
                "totalPercent": 0,
                "alivePercent": 0,
                "uncountedAlivePercent": 0,
                "killedPercent": 0,
                "mobCount": 0,
                "aliveCount": 0,
                "mobs": [],
                "chickenizedCount": 0,
                "chickenizedOriginalPercent": 0,
                "aliveChickenizedCount": 0,
                "aliveChickenizedOriginalPercent": 0
                ,"remainingSpirit": 0
            });
        }

        let mut mobs: Vec<Value> = self
            .current_pull
            .npc_map
            .values()
            .map(|mob| {
                let alive = mob.dead_at.is_none();
                let effective_percent = if mob.chickenized || mob.boss_spawned {
                    0.0
                } else {
                    mob.percent * if mob.empowered { empowered_kill_score_multiplier() } else { 1.0 }
                };
                let effective_score = if mob.chickenized || mob.boss_spawned {
                    0.0
                } else {
                    mob.score * if mob.empowered { empowered_kill_score_multiplier() } else { 1.0 }
                };
                let spirit_value = mob
                    .template_id
                    .map(|template_id| npc_spirit_values(template_id).0)
                    .unwrap_or(0.0);
                let remaining_spirit = if alive && !mob.chickenized && !mob.boss_spawned {
                    spirit_value * mob.lowest_hp_fraction / party_size.max(1) as f64
                } else {
                    0.0
                };
                json!({
                    "unitId": mob.unit_id,
                    "templateId": mob.template_id,
                    "name": mob.name,
                    "score": mob.score,
                    "effectiveScore": effective_score,
                    "percent": mob.percent,
                    "maxHp": mob.max_hp,
                    "currentHp": mob.current_hp,
                    "lowestHpFraction": mob.lowest_hp_fraction,
                    "remainingSpirit": remaining_spirit,
                    "empowered": mob.empowered,
                    "empoweredConfirmed": mob.empowered_confirmed,
                    "firstSeenAt": mob.first_seen_at,
                    "lastSeenAt": mob.last_seen_at,
                    "deadAt": mob.dead_at,
                    "suspectedDeadAt": mob.suspected_dead_at,
                    "chickenizedAt": mob.chickenized_at,
                    "chickenized": mob.chickenized,
                    "bossSpawnedAt": mob.boss_spawned_at,
                    "bossSpawned": mob.boss_spawned,
                    "alive": alive,
                    "effectivePercent": effective_percent
                })
            })
            .collect();

        mobs.sort_by(|left, right| {
            let left_alive = left["alive"].as_bool().unwrap_or(false);
            let right_alive = right["alive"].as_bool().unwrap_or(false);
            right_alive.cmp(&left_alive).then_with(|| {
                right["percent"]
                    .as_f64()
                    .unwrap_or(0.0)
                    .partial_cmp(&left["percent"].as_f64().unwrap_or(0.0))
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
        });

        let total_percent = sum_field(&mobs, "effectivePercent", |_| true);
        let alive_percent = sum_field(&mobs, "effectivePercent", |mob| {
            mob["alive"].as_bool().unwrap_or(false)
        });
        let uncounted_alive_percent = sum_field(&mobs, "effectivePercent", |mob| {
            mob["alive"].as_bool().unwrap_or(false)
                && mob["unitId"]
                    .as_str()
                    .map(|unit_id| !self.counted_npc_deaths.contains(unit_id))
                    .unwrap_or(false)
        });
        let chickenized_count = mobs
            .iter()
            .filter(|mob| mob["chickenized"].as_bool().unwrap_or(false))
            .count();
        let alive_chickenized_count = mobs
            .iter()
            .filter(|mob| {
                mob["chickenized"].as_bool().unwrap_or(false)
                    && mob["alive"].as_bool().unwrap_or(false)
            })
            .count();
        let chickenized_original_percent = sum_field(&mobs, "percent", |mob| {
            mob["chickenized"].as_bool().unwrap_or(false)
        });
        let alive_chickenized_original_percent = sum_field(&mobs, "percent", |mob| {
            mob["chickenized"].as_bool().unwrap_or(false) && mob["alive"].as_bool().unwrap_or(false)
        });
        let remaining_spirit = sum_field(&mobs, "remainingSpirit", |_| true);

        json!({
            "startedAt": self.current_pull.started_at,
            "lastCombatAt": self.current_pull.last_combat_at,
            "totalPercent": total_percent,
            "alivePercent": alive_percent,
            "uncountedAlivePercent": uncounted_alive_percent,
            "killedPercent": total_percent - alive_percent,
            "mobCount": mobs.len(),
            "aliveCount": mobs.iter().filter(|mob| mob["alive"].as_bool().unwrap_or(false)).count(),
            "mobs": mobs,
            "chickenizedCount": chickenized_count,
            "chickenizedOriginalPercent": chickenized_original_percent,
            "aliveChickenizedCount": alive_chickenized_count,
            "aliveChickenizedOriginalPercent": alive_chickenized_original_percent
            ,"remainingSpirit": remaining_spirit
        })
    }

    fn reset_current_pull(&mut self, ts: &str, ts_ms: Option<i64>) {
        self.current_pull = CurrentPullState::default();
        if let Some(ts_ms) = ts_ms {
            self.current_pull.started_at = Some(ts.to_string());
            self.current_pull.last_combat_at = Some(ts.to_string());
            self.current_pull.last_combat_at_ms = Some(ts_ms);
        }
    }

    fn register_npc_death(&mut self, ts: &str, npc_id: &str, npc_name: Option<&str>) {
        if self.counted_npc_deaths.contains(npc_id) {
            return;
        }
        self.counted_npc_deaths.insert(npc_id.to_string());
        self.npc_deaths.push(json!({
            "ts": ts,
            "npcId": npc_id,
            "npcName": npc_name,
            "killerId": null,
            "killerName": null,
            "killingAbilityId": null,
            "killingAbility": null
        }));
        if self.npc_deaths.len() > 400 {
            let excess = self.npc_deaths.len() - 400;
            self.npc_deaths.drain(0..excess);
        }
    }

    fn completed_percent(&self) -> f64 {
        self.npc_deaths
            .iter()
            .filter_map(|death| death["npcId"].as_str())
            .filter(|npc_id| {
                !self.chickenized_npc_ids.contains(*npc_id)
                    && !self.boss_spawned_npc_ids.contains(*npc_id)
            })
            .map(|npc_id| {
                let multiplier = if self.empowered_affix_active
                    && self.empowered_npc_ids.contains(npc_id)
                {
                    empowered_kill_score_multiplier()
                } else {
                    1.0
                };
                self.npc_percent_meta(npc_id, None).percent * multiplier
            })
            .sum()
    }

    fn is_empowered_max_hp(&self, template_id: i64, max_hp: f64) -> bool {
        if !self.empowered_affix_active {
            return false;
        }
        let difficulty = self.dungeon["difficulty"].as_i64();
        let Some(expected_hp) = expected_normal_max_hp(template_id, difficulty) else {
            return false;
        };
        let ratio = max_hp / expected_hp;
        ratio >= EMPOWERED_HP_RATIO_MIN && ratio <= EMPOWERED_HP_RATIO_MAX
    }

    fn npc_percent_meta(&self, unit_id: &str, fallback_name: Option<&str>) -> NpcPercentMeta {
        let template_id = extract_npc_template_id(unit_id);
        let fallback = fallback_name
            .filter(|name| !name.trim().is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| {
                template_id
                    .map(|id| format!("NPC {id}"))
                    .unwrap_or_else(|| "NPC ?".to_string())
            });

        let Some(template_id) = template_id else {
            return NpcPercentMeta {
                template_id: None,
                name: fallback,
                score: 0.0,
                percent: 0.0,
            };
        };

        let Some(mob) = self
            .dungeon_data
            .as_ref()
            .and_then(|data| data.get("mobs"))
            .and_then(|mobs| mobs.get(template_id.to_string()))
        else {
            return NpcPercentMeta {
                template_id: Some(template_id),
                name: fallback,
                score: 0.0,
                percent: 0.0,
            };
        };

        let score = mob.get("score").and_then(Value::as_f64).unwrap_or(0.0);
        let killcount = self
            .dungeon_data
            .as_ref()
            .and_then(|data| data.get("killcount"))
            .and_then(Value::as_f64)
            .unwrap_or(0.0);
        let percent = if killcount > 0.0 {
            score / killcount * 100.0
        } else {
            mob.get("percent").and_then(Value::as_f64).unwrap_or(0.0)
        };

        NpcPercentMeta {
            template_id: Some(template_id),
            name: mob
                .get("name")
                .and_then(Value::as_str)
                .filter(|name| !name.trim().is_empty())
                .unwrap_or(&fallback)
                .to_string(),
            score,
            percent,
        }
    }

    fn should_treat_npc_as_boss_spawned(&self, template_id: Option<i64>, ts_ms: i64) -> bool {
        let Some(template_id) = template_id else {
            return false;
        };
        if template_id == ICE_SHARDLING_TEMPLATE_ID
            && self
                .last_spellbound_golem_death_ms
                .map(|death_ms| (0..=DEATH_SUMMON_WINDOW_MS).contains(&(ts_ms - death_ms)))
                .unwrap_or(false)
        {
            return true;
        }
        if !self.boss_fight_active || self.is_boss_template_id(template_id) {
            return false;
        }
        self.boss_fight_started_at_ms
            .map(|started_at| ts_ms - started_at >= BOSS_SUMMON_MIN_DELAY_MS)
            .unwrap_or(false)
    }

    fn boss_template_ids(&self) -> Vec<i64> {
        self.dungeon_data
            .as_ref()
            .and_then(|data| data.get("bossesID"))
            .and_then(Value::as_array)
            .map(|ids| ids.iter().filter_map(Value::as_i64).collect())
            .unwrap_or_default()
    }

    fn is_boss_template_id(&self, template_id: i64) -> bool {
        self.boss_template_ids().contains(&template_id)
    }

}

struct NpcPercentMeta {
    template_id: Option<i64>,
    name: String,
    score: f64,
    percent: f64,
}

pub fn is_empowered_victory_rush_effect(ability_id: Option<i64>) -> bool {
    ability_id == Some(empowered_victory_rush_effect_id())
}

fn empowered_affix_id() -> i64 {
    empowered_scaling_data()
        .get("empoweredAffixId")
        .and_then(Value::as_i64)
        .unwrap_or(12)
}

fn empowered_victory_rush_effect_id() -> i64 {
    empowered_scaling_data()
        .get("victoryRushEffectId")
        .and_then(Value::as_i64)
        .unwrap_or(44)
}

fn empowered_kill_score_multiplier() -> f64 {
    empowered_scaling_data()
        .get("empoweredKillScoreMultiplier")
        .and_then(Value::as_f64)
        .unwrap_or(3.0)
}

fn expected_normal_max_hp(template_id: i64, difficulty: Option<i64>) -> Option<f64> {
    let difficulty = difficulty?;
    let data = empowered_scaling_data();
    let base_health = data.get("baseHealth")?.as_f64()?;
    let difficulty_scale = data
        .get("difficultyHealthScale")?
        .get(difficulty.to_string())?
        .as_f64()?;
    let mob_scale = data
        .get("mobBaseHealthMultiplier")?
        .get(template_id.to_string())?
        .as_f64()?;
    let expected = base_health * difficulty_scale * mob_scale;
    (expected.is_finite() && expected > 0.0).then_some(expected)
}

fn affix_list_contains(raw: &str, affix_id: i64) -> bool {
    raw.split(|ch: char| !ch.is_ascii_digit() && ch != '-')
        .filter_map(|value| value.parse::<i64>().ok())
        .any(|value| value == affix_id)
}

pub fn is_chickenize_ability(ability_id: Option<i64>, ability_name: &str) -> bool {
    ability_id == Some(CHICKENIZE_RELIC_ID)
        || ability_id == Some(5252)
        || ability_name.trim().eq_ignore_ascii_case("chickenize")
        || ability_name.trim().eq_ignore_ascii_case("курификатор")
}

fn create_dungeon_state() -> Value {
    json!({
        "startedAt": null,
        "timeCorrectionMs": 0,
        "timeCorrectionServerTs": null,
        "timeCorrectionClientTs": null,
        "endedAt": null,
        "name": null,
        "id": null,
        "difficulty": null,
        "affixes": null,
        "success": null,
        "durationMs": null,
        "completionSeconds": null,
        "deaths": null,
        "extra": {},
        "data": null,
        "completedPercent": 0,
        "killCount": null
    })
}

fn extract_npc_template_id(unit_id: &str) -> Option<i64> {
    if !is_npc_id(unit_id) {
        return None;
    }
    unit_id.rsplit('-').next()?.parse::<i64>().ok()
}

fn sum_field<F>(mobs: &[Value], field: &str, predicate: F) -> f64
where
    F: Fn(&Value) -> bool,
{
    mobs.iter()
        .filter(|mob| predicate(mob))
        .map(|mob| mob[field].as_f64().unwrap_or(0.0))
        .sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    const TS: &str = "2026-07-09T22:45:32.402+03:00";

    fn start_silken(affixes: &str) -> DungeonTracker {
        let mut tracker = DungeonTracker::new();
        tracker.start(
            TS,
            &[
                TS,
                "DUNGEON_START",
                "\"Silken Hollow\"",
                "24",
                "60",
                affixes,
                "0",
                TS,
            ],
        );
        tracker
    }

    #[test]
    fn empowered_max_hp_triples_current_pull_and_completed_percent() {
        let mut tracker = start_silken("[4,6,12,19]");
        let npc_id = "Npc-1013973248-132";
        tracker.observe_current_pull_npc(
            TS,
            npc_id,
            Some("Bully Basher"),
            Some("3157811"),
            Some("3157811"),
        );

        let pull = tracker.current_pull_summary_for_party(1);
        let expected = 12.0 / 168.0 * 100.0;
        assert!((pull["alivePercent"].as_f64().unwrap() - expected).abs() < 0.0001);
        assert_eq!(pull["mobs"][0]["empowered"], json!(true));
        assert_eq!(pull["mobs"][0]["effectiveScore"], json!(12.0));

        tracker.mark_current_pull_death_with_progress(TS, npc_id, Some("Bully Basher"), None);
        let completed = tracker.dungeon_json()["completedPercent"].as_f64().unwrap();
        assert!((completed - expected).abs() < 0.0001);
    }

    #[test]
    fn high_hp_is_not_empowered_without_affix() {
        let mut tracker = start_silken("[4,6,19]");
        tracker.observe_current_pull_npc(
            TS,
            "Npc-1013973248-132",
            Some("Bully Basher"),
            Some("3157811"),
            Some("3157811"),
        );
        let pull = tracker.current_pull_summary_for_party(1);
        assert_eq!(pull["mobs"][0]["empowered"], json!(false));
        assert_eq!(pull["mobs"][0]["effectiveScore"], json!(4.0));
    }

    #[test]
    fn victory_rush_confirms_empowered_only_when_affix_is_active() {
        let npc_id = "Npc-2487746976-266";
        let mut tracker = start_silken("[4,6,12,19]");
        tracker.mark_empowered_victory_rush(TS, npc_id, Some("Venomdrinker"));
        let pull = tracker.current_pull_summary_for_party(1);
        assert_eq!(pull["mobs"][0]["empowered"], json!(true));
        assert_eq!(pull["mobs"][0]["empoweredConfirmed"], json!(true));

        let mut no_affix = start_silken("[4,6,19]");
        no_affix.mark_empowered_victory_rush(TS, npc_id, Some("Venomdrinker"));
        assert!(no_affix.current_pull_summary_for_party(1)["mobs"]
            .as_array()
            .unwrap()
            .is_empty());
    }

    #[test]
    fn localized_boss_encounter_excludes_late_summons() {
        let mut tracker = start_silken("[4,6,12,19]");
        tracker.encounter_start(
            "2026-07-09T22:55:24.000+03:00",
            "[\"Вексайра, Мать кошмаров\"]",
        );
        let summon_id = "Npc-2010121632-90";
        tracker.observe_current_pull_npc(
            "2026-07-09T22:55:45.456+03:00",
            summon_id,
            Some("Rotheart Recluse"),
            Some("587964"),
            Some("587964"),
        );
        let pull = tracker.current_pull_summary_for_party(1);
        assert_eq!(pull["mobs"][0]["bossSpawned"], json!(true));
        assert_eq!(pull["mobs"][0]["effectiveScore"], json!(0.0));

        tracker.mark_current_pull_death_with_progress(
            "2026-07-09T22:56:00.000+03:00",
            summon_id,
            Some("Rotheart Recluse"),
            None,
        );
        assert_eq!(tracker.dungeon_json()["completedPercent"], json!(0.0));
    }

    #[test]
    fn shardlings_spawned_by_spellbound_golem_are_excluded_immediately() {
        let mut tracker = DungeonTracker::new();
        tracker.start(
            TS,
            &[TS, "DUNGEON_START", "\"Cithrel's Fall\"", "7", "19", "[4,6]", "0", TS],
        );
        tracker.mark_current_pull_death_with_progress(
            "2026-07-09T22:45:32.500+03:00",
            "Npc-1-160",
            Some("Spellbound Golem"),
            None,
        );
        tracker.observe_current_pull_npc(
            "2026-07-09T22:45:33.100+03:00",
            "Npc-2-161",
            Some("Ice Shardling"),
            Some("74969"),
            Some("74969"),
        );

        let pull = tracker.current_pull_summary_for_party(1);
        assert_eq!(pull["mobs"][0]["bossSpawned"], json!(true));
        assert_eq!(pull["alivePercent"], json!(0.0));
    }

    #[test]
    fn remaining_pull_spirit_uses_hp_fraction_and_party_size() {
        let mut tracker = DungeonTracker::new();
        tracker.start(
            TS,
            &[TS, "DUNGEON_START", "\"Cithrel's Fall\"", "7", "19", "[4,6]", "0", TS],
        );
        tracker.observe_current_pull_npc(
            TS,
            "Npc-1-161",
            Some("Ice Shardling"),
            Some("37484.5"),
            Some("74969"),
        );

        let pull = tracker.current_pull_summary_for_party(4);
        let remaining = pull["remainingSpirit"].as_f64().unwrap();
        assert!((remaining - 0.125).abs() < 0.0001);
    }

    #[test]
    fn late_events_do_not_readd_dead_npc_as_alive() {
        let mut tracker = DungeonTracker::new();
        tracker.start(
            TS,
            &[TS, "DUNGEON_START", "\"Godfall Quarry\"", "25", "54", "[4,6]", "0", TS],
        );
        let npc_id = "Npc-3348627904-136";
        tracker.observe_current_pull_npc(
            "2026-07-12T10:54:41.700+03:00",
            npc_id,
            Some("Skittershard"),
            Some("1"),
            Some("100"),
        );
        tracker.mark_current_pull_death_with_progress(
            "2026-07-12T10:54:41.772+03:00",
            npc_id,
            Some("Skittershard"),
            Some("0.1"),
        );

        tracker.touch_current_pull(
            "2026-07-12T10:54:43.006+03:00",
            npc_id,
            Some("Skittershard"),
        );

        let pull = tracker.current_pull_summary_for_party(4);
        assert_eq!(pull["aliveCount"], json!(0));
        assert_eq!(pull["alivePercent"], json!(0.0));
        assert_eq!(pull["remainingSpirit"], json!(0.0));
    }
}
