use serde_json::{json, Value};
use std::collections::BTreeMap;

pub(crate) const SYLVIE_CLASS_ID: i64 = 14;
pub(crate) const MAD_GARDENERS_SHAWL_ITEM_ID: i64 = 5216;

pub(crate) const PRICKLY_VINE_ABILITY_ID: i64 = 1057;
pub(crate) const LIFE_PETAL_ABILITY_ID: i64 = 1072;
pub(crate) const HEART_BLOOM_ABILITY_ID: i64 = 1075;
pub(crate) const SHROOMSPLOSION_ABILITY_ID: i64 = 1073;
pub(crate) const FLUTTERCALL_JUBILEE_ABILITY_ID: i64 = 1055;
pub(crate) const IRONLEAF_WARD_ABILITY_ID: i64 = 116;
pub(crate) const ENFEEBLING_ROOTSAP_ABILITY_ID: i64 = 1047;
pub(crate) const SHROOMSPLOSION_DAMAGE_EFFECT_ID: i64 = 1474;

const VINE_LIFETIME_MS: i64 = 27_000;
const LIFE_PETAL_LIFETIME_MS: i64 = 14_000;
const HEART_BLOOM_LIFETIME_MS: i64 = 16_000;
const BOOMSHROOM_GROWTH_MS: i64 = 3_000;
const BOOMSHROOM_LIFETIME_MS: i64 = 60_000;

#[derive(Clone, Default)]
pub(crate) struct SylvieShroomTracker {
    enabled: bool,
    has_mad_gardeners_shawl: bool,
    active_vines: Vec<TimedShroom>,
    active_life_petals: Vec<i64>,
    active_heart_blooms: Vec<i64>,
    budding_shrooms: Vec<TimedShroom>,
    mature_shrooms: Vec<TimedShroom>,
    launches: Vec<ShroomLaunch>,
}

#[derive(Clone)]
struct TimedShroom {
    at_ms: i64,
    source: &'static str,
}

#[derive(Clone)]
struct ShroomLaunch {
    ts: String,
    ts_ms: i64,
    encounter_id: Option<i64>,
    encounter_name: Option<String>,
    target_id: String,
    target_name: String,
    predicted_shrooms: usize,
    predicted_by_source: BTreeMap<&'static str, usize>,
    target_hits: usize,
    aoe_hits: usize,
}

impl SylvieShroomTracker {
    pub(crate) fn configure(&mut self, class_id: Option<i64>, equipment: Option<&str>) {
        self.enabled = class_id == Some(SYLVIE_CLASS_ID);
        self.has_mad_gardeners_shawl = self.enabled
            && equipment
                .map(parse_equipment_item_ids)
                .is_some_and(|ids| ids.contains(&MAD_GARDENERS_SHAWL_ITEM_ID));
    }

    pub(crate) fn reset(&mut self) {
        self.clear_active_state();
        self.launches.clear();
    }

    pub(crate) fn on_death(&mut self) {
        self.clear_active_state();
    }

    fn clear_active_state(&mut self) {
        self.active_vines.clear();
        self.active_life_petals.clear();
        self.active_heart_blooms.clear();
        self.budding_shrooms.clear();
        self.mature_shrooms.clear();
    }

    pub(crate) fn on_ability_activated(
        &mut self,
        ts: &str,
        ts_ms: i64,
        ability_id: i64,
        target_id: &str,
        target_name: &str,
        encounter_id: Option<i64>,
        encounter_name: Option<&str>,
    ) {
        if !self.enabled {
            return;
        }
        self.advance(ts_ms);
        match ability_id {
            PRICKLY_VINE_ABILITY_ID => self.add_vines(ts_ms, 1, "Prickly Vine"),
            LIFE_PETAL_ABILITY_ID => {
                self.active_life_petals.push(ts_ms + LIFE_PETAL_LIFETIME_MS);
            }
            HEART_BLOOM_ABILITY_ID => {
                self.active_heart_blooms
                    .push(ts_ms + HEART_BLOOM_LIFETIME_MS);
            }
            FLUTTERCALL_JUBILEE_ABILITY_ID => self.add_vines(ts_ms, 6, "Jubilee"),
            IRONLEAF_WARD_ABILITY_ID if self.has_mad_gardeners_shawl => {
                self.add_vines(ts_ms, 4, "Ironleaf Ward")
            }
            ENFEEBLING_ROOTSAP_ABILITY_ID => self.wither_oldest_vine(ts_ms),
            SHROOMSPLOSION_ABILITY_ID => {
                let predicted_shrooms = self.mature_shrooms.len();
                let mut predicted_by_source = BTreeMap::new();
                for shroom in &self.mature_shrooms {
                    *predicted_by_source.entry(shroom.source).or_insert(0) += 1;
                }
                self.mature_shrooms.clear();
                self.launches.push(ShroomLaunch {
                    ts: ts.to_string(),
                    ts_ms,
                    encounter_id,
                    encounter_name: encounter_name.map(str::to_string),
                    target_id: target_id.to_string(),
                    target_name: target_name.to_string(),
                    predicted_shrooms,
                    predicted_by_source,
                    target_hits: 0,
                    aoe_hits: 0,
                });
            }
            _ => {}
        }
    }

    pub(crate) fn on_spirit_refund(&mut self, ts_ms: i64, procs: usize) {
        if !self.enabled {
            return;
        }
        self.advance(ts_ms);
        self.add_vines(ts_ms, procs, "Spirit Refund");
    }

    pub(crate) fn on_shroomsplosion_damage(&mut self, ts_ms: i64, target_id: &str) {
        if !self.enabled {
            return;
        }
        self.advance(ts_ms);
        let Some(launch) = self
            .launches
            .iter_mut()
            .rev()
            .find(|launch| ts_ms >= launch.ts_ms)
        else {
            return;
        };
        launch.aoe_hits += 1;
        if launch.target_id == target_id {
            launch.target_hits += 1;
        }
    }

    pub(crate) fn to_json_at(&self, now_ms: i64) -> Value {
        if !self.enabled {
            return Value::Null;
        }
        let mut tracker = self.clone();
        tracker.advance(now_ms);
        let mut fresh = 0;
        let mut medium = 0;
        let mut expiring = 0;
        for shroom in &tracker.mature_shrooms {
            let remaining = shroom.at_ms - now_ms;
            if remaining >= 30_000 {
                fresh += 1;
            } else if remaining >= 10_000 {
                medium += 1;
            } else {
                expiring += 1;
            }
        }
        let timeline = tracker.shroom_timeline();
        let upcoming = timeline
            .iter()
            .filter(|entry| entry["matureAtMs"].as_i64().is_some_and(|at| at > now_ms))
            .count();
        json!({
            "fresh": fresh,
            "medium": medium,
            "expiring": expiring,
            "mature": tracker.mature_shrooms.len(),
            "budding": tracker.budding_shrooms.len(),
            "activeVines": tracker.active_vines.len(),
            "activeLifePetals": tracker.active_life_petals.len(),
            "activeHeartBlooms": tracker.active_heart_blooms.len(),
            "upcoming": upcoming,
            "hasMadGardenersShawl": tracker.has_mad_gardeners_shawl,
            "timeline": timeline,
            "launches": tracker.launches.iter().map(ShroomLaunch::to_json).collect::<Vec<_>>()
        })
    }

    fn add_vines(&mut self, created_at_ms: i64, count: usize, source: &'static str) {
        self.active_vines.extend(
            std::iter::repeat(TimedShroom {
                at_ms: created_at_ms + VINE_LIFETIME_MS,
                source,
            })
            .take(count),
        );
    }

    fn add_budding(&mut self, mature_at_ms: i64, count: usize, source: &'static str) {
        self.budding_shrooms.extend(
            std::iter::repeat(TimedShroom {
                at_ms: mature_at_ms,
                source,
            })
            .take(count),
        );
    }

    fn wither_oldest_vine(&mut self, ts_ms: i64) {
        let Some((index, _)) = self
            .active_vines
            .iter()
            .enumerate()
            .min_by_key(|(_, vine)| vine.at_ms)
        else {
            return;
        };
        self.active_vines.swap_remove(index);
        self.add_budding(ts_ms + BOOMSHROOM_GROWTH_MS, 1, "Rootsap");
    }

    fn advance(&mut self, now_ms: i64) {
        let mut future_vines = Vec::with_capacity(self.active_vines.len());
        for vine in self.active_vines.drain(..) {
            if vine.at_ms <= now_ms {
                self.budding_shrooms.push(TimedShroom {
                    at_ms: vine.at_ms + BOOMSHROOM_GROWTH_MS,
                    source: vine.source,
                });
            } else {
                future_vines.push(vine);
            }
        }
        self.active_vines = future_vines;

        let mut future_life_petals = Vec::with_capacity(self.active_life_petals.len());
        let mut expired_life_petals = Vec::new();
        for expires_at in self.active_life_petals.drain(..) {
            if expires_at <= now_ms {
                expired_life_petals.push(expires_at);
            } else {
                future_life_petals.push(expires_at);
            }
        }
        self.active_life_petals = future_life_petals;
        for expires_at in expired_life_petals {
            self.add_budding(expires_at + BOOMSHROOM_GROWTH_MS, 2, "Life Petal");
        }

        let mut future_heart_blooms = Vec::with_capacity(self.active_heart_blooms.len());
        let mut expired_heart_blooms = Vec::new();
        for expires_at in self.active_heart_blooms.drain(..) {
            if expires_at <= now_ms {
                expired_heart_blooms.push(expires_at);
            } else {
                future_heart_blooms.push(expires_at);
            }
        }
        self.active_heart_blooms = future_heart_blooms;
        for expires_at in expired_heart_blooms {
            self.add_budding(expires_at + BOOMSHROOM_GROWTH_MS, 3, "Heart Bloom");
        }

        let mut future_buds = Vec::with_capacity(self.budding_shrooms.len());
        for bud in self.budding_shrooms.drain(..) {
            if bud.at_ms <= now_ms {
                let expires_at = bud.at_ms + BOOMSHROOM_LIFETIME_MS;
                if expires_at > now_ms {
                    self.mature_shrooms.push(TimedShroom {
                        at_ms: expires_at,
                        source: bud.source,
                    });
                }
            } else {
                future_buds.push(bud);
            }
        }
        self.budding_shrooms = future_buds;
        self.mature_shrooms.retain(|shroom| shroom.at_ms > now_ms);
    }

    fn shroom_timeline(&self) -> Vec<Value> {
        let mut timeline = Vec::new();
        let mut push_window = |mature_at_ms: i64, source: &'static str| {
            timeline.push(json!({
                "matureAtMs": mature_at_ms,
                "expiresAtMs": mature_at_ms + BOOMSHROOM_LIFETIME_MS,
                "source": source
            }));
        };
        for shroom in &self.mature_shrooms {
            push_window(shroom.at_ms - BOOMSHROOM_LIFETIME_MS, shroom.source);
        }
        for bud in &self.budding_shrooms {
            push_window(bud.at_ms, bud.source);
        }
        for vine in &self.active_vines {
            push_window(vine.at_ms + BOOMSHROOM_GROWTH_MS, vine.source);
        }
        for expires_at in &self.active_life_petals {
            for _ in 0..2 {
                push_window(*expires_at + BOOMSHROOM_GROWTH_MS, "Life Petal");
            }
        }
        for expires_at in &self.active_heart_blooms {
            for _ in 0..3 {
                push_window(*expires_at + BOOMSHROOM_GROWTH_MS, "Heart Bloom");
            }
        }
        timeline.sort_by_key(|entry| entry["matureAtMs"].as_i64().unwrap_or_default());
        timeline
    }
}

impl ShroomLaunch {
    fn to_json(&self) -> Value {
        json!({
            "ts": self.ts,
            "encounterId": self.encounter_id,
            "encounterName": self.encounter_name,
            "targetId": self.target_id,
            "targetName": self.target_name,
            "predictedShrooms": self.predicted_shrooms,
            "predictedBySource": self.predicted_by_source,
            "targetHits": self.target_hits,
            "aoeHits": self.aoe_hits
        })
    }
}

pub(crate) fn parse_equipment_item_ids(raw: &str) -> Vec<i64> {
    let bytes = raw.as_bytes();
    let mut ids = Vec::new();
    let mut paren_depth = 0;
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'(' => {
                if paren_depth == 0 {
                    let mut cursor = index + 1;
                    let start = cursor;
                    while cursor < bytes.len() && bytes[cursor].is_ascii_digit() {
                        cursor += 1;
                    }
                    if cursor > start && bytes.get(cursor) == Some(&b',') {
                        if let Ok(id) = raw[start..cursor].parse::<i64>() {
                            ids.push(id);
                        }
                    }
                }
                paren_depth += 1;
            }
            b')' => paren_depth = (paren_depth - 1).max(0),
            _ => {}
        }
        index += 1;
    }
    ids
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn equipment_parser_only_returns_top_level_item_ids() {
        let raw = "[(5213,315,[(1,24),(3,16)]),(5216,360,[(1,10)]),(5220,315,[])]";
        assert_eq!(parse_equipment_item_ids(raw), vec![5213, 5216, 5220]);
    }

    #[test]
    fn shawl_ward_creates_four_mature_shrooms_after_thirty_seconds() {
        let mut tracker = SylvieShroomTracker::default();
        tracker.configure(Some(SYLVIE_CLASS_ID), Some("[(5216,360,[])]"));
        tracker.on_ability_activated(
            "2026-01-01T00:00:00Z",
            0,
            IRONLEAF_WARD_ABILITY_ID,
            "Player-2",
            "Tank",
            None,
            None,
        );
        assert_eq!(tracker.to_json_at(0)["upcoming"], json!(4));
        assert_eq!(tracker.to_json_at(29_999)["mature"], json!(0));
        assert_eq!(tracker.to_json_at(30_000)["mature"], json!(4));
        assert_eq!(tracker.to_json_at(30_000)["upcoming"], json!(0));
    }

    #[test]
    fn two_flower_charges_expire_independently() {
        let mut tracker = SylvieShroomTracker::default();
        tracker.configure(Some(SYLVIE_CLASS_ID), Some("[]"));
        for ability_id in [LIFE_PETAL_ABILITY_ID, HEART_BLOOM_ABILITY_ID] {
            tracker.on_ability_activated(
                "2026-01-01T00:00:00Z",
                0,
                ability_id,
                "Player-1",
                "Sylvie",
                None,
                None,
            );
            tracker.on_ability_activated(
                "2026-01-01T00:00:01Z",
                1_000,
                ability_id,
                "Player-1",
                "Sylvie",
                None,
                None,
            );
        }
        assert_eq!(tracker.to_json_at(19_999)["mature"], json!(7));
        assert_eq!(tracker.to_json_at(20_000)["mature"], json!(10));
    }

    #[test]
    fn shroomsplosion_clears_mature_but_keeps_budding_and_timer_expires_shrooms() {
        let mut tracker = SylvieShroomTracker::default();
        tracker.configure(Some(SYLVIE_CLASS_ID), Some("[]"));
        tracker.add_budding(0, 2, "mature");
        tracker.add_budding(10_000, 3, "budding");
        assert_eq!(tracker.to_json_at(0)["mature"], json!(2));
        tracker.on_ability_activated(
            "2026-01-01T00:00:01Z",
            1_000,
            SHROOMSPLOSION_ABILITY_ID,
            "Npc-1",
            "Boss",
            None,
            None,
        );
        assert_eq!(tracker.to_json_at(1_000)["mature"], json!(0));
        assert_eq!(tracker.to_json_at(1_000)["budding"], json!(3));
        assert_eq!(tracker.to_json_at(10_000)["mature"], json!(3));
        assert_eq!(tracker.to_json_at(70_000)["mature"], json!(0));
    }

    #[test]
    fn reset_clears_all_dungeon_scoped_state() {
        let mut tracker = SylvieShroomTracker::default();
        tracker.configure(Some(SYLVIE_CLASS_ID), Some("[(5216,360,[])]"));
        tracker.add_vines(0, 4, "test");
        tracker.add_budding(1_000, 2, "test");
        tracker.active_life_petals.push(20_000);
        tracker.active_heart_blooms.push(20_000);
        tracker.reset();
        let state = tracker.to_json_at(60_000);
        assert_eq!(state["activeVines"], json!(0));
        assert_eq!(state["activeLifePetals"], json!(0));
        assert_eq!(state["activeHeartBlooms"], json!(0));
        assert_eq!(state["budding"], json!(0));
        assert_eq!(state["mature"], json!(0));
        assert_eq!(state["launches"].as_array().unwrap().len(), 0);
    }

    #[test]
    fn death_clears_current_shrooms_and_sources() {
        let mut tracker = SylvieShroomTracker::default();
        tracker.configure(Some(SYLVIE_CLASS_ID), Some("[(5216,360,[])]"));
        tracker.add_vines(0, 4, "test");
        tracker.add_budding(1_000, 2, "test");
        tracker.active_life_petals.push(20_000);
        tracker.active_heart_blooms.push(20_000);

        tracker.on_death();

        let state = tracker.to_json_at(60_000);
        assert_eq!(state["activeVines"], json!(0));
        assert_eq!(state["activeLifePetals"], json!(0));
        assert_eq!(state["activeHeartBlooms"], json!(0));
        assert_eq!(state["budding"], json!(0));
        assert_eq!(state["mature"], json!(0));
        assert_eq!(state["upcoming"], json!(0));
    }
}
