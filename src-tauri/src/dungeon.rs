use crate::game_database::load_dungeon_data;
use crate::parser_line_utils::{is_npc_id, parse_ts_ms, to_i64, unquote};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};

const CURRENT_PULL_RESET_MS: i64 = 8000;
const NPC_UNDERFLOW_FALLBACK_MS: i64 = 1500;
const BOSS_SUMMON_MIN_DELAY_MS: i64 = 12000;
const CHICKENIZE_RELIC_ID: i64 = 1478;

#[derive(Clone)]
struct CurrentPullNpc {
    unit_id: String,
    template_id: Option<i64>,
    name: String,
    score: f64,
    percent: f64,
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
    chickenized_npc_ids: HashSet<String>,
    boss_spawned_npc_ids: HashSet<String>,
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
            chickenized_npc_ids: HashSet::new(),
            boss_spawned_npc_ids: HashSet::new(),
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
        self.chickenized_npc_ids.clear();
        self.boss_spawned_npc_ids.clear();
        self.npc_deaths.clear();
        self.boss_fight_active = false;
        self.boss_fight_started_at_ms = None;
    }

    pub fn start(&mut self, ts: &str, parts: &[String]) {
        self.reset_scope();
        let name = unquote(parts.get(2));
        let id = to_i64(parts.get(3));
        self.dungeon_data = load_dungeon_data(id, Some(&name));
        let client_ts = parts.get(7).cloned();
        let time_correction_ms = parse_ts_ms(ts)
            .zip(client_ts.as_deref().and_then(parse_ts_ms))
            .map(|(server_ms, client_ms)| server_ms - client_ms)
            .unwrap_or(0);
        self.dungeon["startedAt"] = json!(ts);
        self.dungeon["timeCorrectionMs"] = json!(time_correction_ms);
        self.dungeon["timeCorrectionServerTs"] = json!(ts);
        self.dungeon["timeCorrectionClientTs"] = json!(client_ts);
        self.dungeon["name"] = json!(name);
        self.dungeon["id"] = json!(id);
        self.dungeon["difficulty"] = json!(to_i64(parts.get(4)));
        self.dungeon["affixes"] = json!(parts.get(5).cloned());
        self.dungeon["data"] = self.dungeon_data.clone().unwrap_or(Value::Null);
    }

    pub fn end(&mut self, ts: &str, parts: &[String]) {
        let name = unquote(parts.get(2));
        let id = to_i64(parts.get(3));
        if self.dungeon_data.is_none() {
            self.dungeon_data = load_dungeon_data(id, Some(&name));
        }
        self.dungeon["endedAt"] = json!(ts);
        self.dungeon["name"] = json!(name);
        self.dungeon["id"] = json!(id);
        self.dungeon["difficulty"] = json!(to_i64(parts.get(4)));
        self.dungeon["success"] = json!(parts.get(6).map(|value| value == "1").unwrap_or(false));
        self.dungeon["durationMs"] = json!(to_i64(parts.get(7)));
        self.dungeon["completionSeconds"] = json!(to_i64(parts.get(8)));
        self.dungeon["deaths"] = json!(to_i64(parts.get(9)));
        self.dungeon["data"] = self.dungeon_data.clone().unwrap_or(Value::Null);
    }

    pub fn zone_change(&mut self, parts: &[String]) -> bool {
        let name = unquote(parts.get(2));
        let id = to_i64(parts.get(3));
        let dungeon_data = load_dungeon_data(id, Some(&name));
        let recognized_dungeon = dungeon_data.is_some();
        if recognized_dungeon {
            self.reset_scope();
        }
        self.dungeon_data = dungeon_data;
        self.dungeon["name"] = json!(name);
        self.dungeon["id"] = json!(id);
        self.dungeon["difficulty"] = json!(to_i64(parts.get(4)));
        self.dungeon["data"] = self.dungeon_data.clone().unwrap_or(Value::Null);
        self.dungeon["completedPercent"] = json!(0);
        recognized_dungeon
    }

    pub fn touch_current_pull(&mut self, ts: &str, npc_id: &str, npc_name: Option<&str>) {
        if !is_npc_id(npc_id) {
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

    pub fn mark_current_pull_death(&mut self, ts: &str, npc_id: &str, npc_name: Option<&str>) {
        if !is_npc_id(npc_id) {
            return;
        }
        self.touch_current_pull(ts, npc_id, npc_name);
        if let Some(npc) = self.current_pull.npc_map.get_mut(npc_id) {
            npc.dead_at = Some(ts.to_string());
            npc.dead_at_ms = parse_ts_ms(ts);
        }
        self.register_npc_death(ts, npc_id, npc_name);
    }

    pub fn mark_npc_underflow_if_needed(
        &mut self,
        ts: &str,
        npc_id: &str,
        npc_name: Option<&str>,
        current_hp_raw: Option<&String>,
        max_hp_raw: Option<&String>,
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
            self.register_npc_death(&death_ts, &npc_id, Some(&npc_name));
        }
    }

    pub fn encounter_start(&mut self, ts: &str, encounter_name: &str) {
        self.boss_fight_active = self.is_boss_encounter_name(encounter_name);
        self.boss_fight_started_at_ms = parse_ts_ms(ts);
    }

    pub fn encounter_end(&mut self, ts: &str) {
        self.resolve_pending_npc_underflow_deaths(ts, true);
        self.boss_fight_active = false;
        self.boss_fight_started_at_ms = None;
    }

    pub fn note_boss_npc_in_line(&mut self, parts: &[String]) {
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
            self.boss_spawned_npc_ids.remove(value);
            if let Some(npc) = self.current_pull.npc_map.get_mut(value) {
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

    pub fn current_pull_summary(&self) -> Value {
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
                    mob.percent
                };
                json!({
                    "unitId": mob.unit_id,
                    "templateId": mob.template_id,
                    "name": mob.name,
                    "score": mob.score,
                    "percent": mob.percent,
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
            .map(|npc_id| self.npc_percent_meta(npc_id, None).percent)
            .sum()
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

    fn is_boss_encounter_name(&self, encounter_name: &str) -> bool {
        let normalized_names: HashSet<String> = self
            .boss_template_ids()
            .into_iter()
            .filter_map(|boss_id| {
                self.dungeon_data
                    .as_ref()
                    .and_then(|data| data.get("mobs"))
                    .and_then(|mobs| mobs.get(boss_id.to_string()))
                    .and_then(|mob| mob.get("name"))
                    .and_then(Value::as_str)
                    .map(|name| name.trim().to_ascii_lowercase())
            })
            .filter(|name| !name.is_empty())
            .collect();
        if normalized_names.is_empty() {
            return false;
        }
        encounter_name
            .split(',')
            .map(|name| name.trim().to_ascii_lowercase())
            .any(|name| normalized_names.contains(&name))
    }
}

struct NpcPercentMeta {
    template_id: Option<i64>,
    name: String,
    score: f64,
    percent: f64,
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
