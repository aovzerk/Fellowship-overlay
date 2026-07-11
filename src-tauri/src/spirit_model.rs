//! Spirit Points emulation model (docs/spirit-model.md).
//!
//! The model runs for every party player and is hard-synced to the real SP
//! samples that visible classes emit in the combat log. Gunde never logs SP,
//! so his displayed value is the model itself:
//!   1. base tick: +1 SP per 3.0s, always on;
//!   2. Spirit Refund procs (Rising Spirit 3115): +refund (class value);
//!   3. mob/boss SP: SpiritPointValue x new HP low fraction / party size,
//!      boss summons excluded (roster-type mobs first seen inside an encounter);
//!   4. Visions of Grandeur weapon trait: +2.5 x weaponCooldown / 30 per use;
//!   5. dungeon start: Herald blessing tier (Gunde blessing id 43);
//!   6. player death (UNIT_DESTROYED): sp *= keep fraction from the log;
//!   7. Gunde ultimate 2296: sp = max(sp, cost) - cost (anchor).

use crate::game_database::npc_spirit_values;
use std::collections::{HashMap, HashSet};

pub const SPIRIT_TICK_RATE: f64 = 1.0 / 3.0;

pub const GUNDE_CLASS_ID: i64 = 9;
pub const GUNDE_ULT_ABILITY_ID: i64 = 2296;
const VOG_TRAIT_ID: i64 = 47;
/// COMBATANT_INFO field 15 lists equipped blessings as (id, tier).
/// Blessing ids come in per-class blocks of 15 with The Herald at offset 14:
/// Elarion 14, Ardeos 29, Gunde 44, Tariq 59, Meiko 104, Sylvie 119,
/// Rime 134, Xavian 149. Verified against measured dungeon starts of five
/// players (incl. an Ardeos respec 29: tier 2 -> 4 shifting start 70 -> 100).
const GUNDE_HERALD_BLESSING_ID: i64 = 44;
const HERALD_START_SP: [f64; 5] = [0.0, 12.0, 20.0, 30.0, 50.0];

/// Weapon ability id -> default cooldown seconds (gear data: Weapons FSLID -> Cooldown).
const WEAPON_COOLDOWNS: &[(i64, f64)] = &[
    (152, 30.0),
    (155, 90.0),
    (156, 20.0),
    (157, 120.0),
    (159, 90.0),
    (160, 60.0),
    (161, 60.0),
    (162, 60.0),
    (164, 120.0),
    (1558, 180.0),
    (1559, 180.0),
    (1561, 40.0),
];

/// Deterministic per-ability SP gains: (class id, ability id) -> SP.
/// Xavian Omnistrike is baseline kit; Tariq Culling Strike is the Pneuma talent
/// (safe for sample-synced classes: real samples correct any talent mismatch).
const ABILITY_SPIRIT_GAINS: &[(i64, i64, f64)] = &[(25, 1863, 4.0), (10, 1228, 1.0)];

fn class_refund_gain(class_id: Option<i64>) -> f64 {
    match class_id {
        Some(22) => 1.2, // Helena
        Some(13) => 2.0, // Meiko
        Some(17) => 2.0, // Rime
        _ => 1.0,
    }
}

fn weapon_cooldown(ability_id: i64) -> Option<f64> {
    WEAPON_COOLDOWNS
        .iter()
        .find(|(id, _)| *id == ability_id)
        .map(|(_, cd)| *cd)
}

fn spirit_cap_from_blue(blue: f64) -> f64 {
    if blue >= 600.0 {
        130.0
    } else if blue >= 100.0 {
        110.0
    } else {
        100.0
    }
}

fn ultimate_cost_from_blue(blue: f64) -> f64 {
    if blue >= 1500.0 {
        85.0
    } else if blue >= 450.0 {
        95.0
    } else {
        100.0
    }
}

/// Parses "[(id,tier),(id,tier)]" lists from COMBATANT_INFO (blessings/traits).
fn parse_pair_list(raw: Option<&str>) -> Vec<(i64, i64)> {
    let Some(raw) = raw else {
        return Vec::new();
    };
    let mut result = Vec::new();
    for chunk in raw.split('(').skip(1) {
        let Some(end) = chunk.find(')') else {
            continue;
        };
        let mut numbers = chunk[..end]
            .split(',')
            .filter_map(|value| value.trim().parse::<i64>().ok());
        if let (Some(id), Some(tier)) = (numbers.next(), numbers.next()) {
            result.push((id, tier));
        }
    }
    result
}

#[derive(Default, Clone)]
pub struct SpiritSim {
    pub sp: f64,
    last_ms: Option<i64>,
    /// Ever hard-synced to a real log sample (visible classes).
    pub synced: bool,
    pub configured: bool,
    pub is_gunde: bool,
    cap: f64,
    cost: f64,
    refund: f64,
    has_vog: bool,
    class_id: Option<i64>,
    /// Model value at the moment of the last emitted Gunde snapshot.
    pub last_emitted: f64,
    last_ult_ms: Option<i64>,
}

impl SpiritSim {
    pub fn cap(&self) -> f64 {
        if self.cap > 0.0 {
            self.cap
        } else {
            100.0
        }
    }

    pub fn ult_cost(&self) -> f64 {
        if self.cost > 0.0 {
            self.cost
        } else {
            100.0
        }
    }

    pub fn configure(
        &mut self,
        class_id: Option<i64>,
        blue_stone: f64,
        blessings_raw: Option<&str>,
        traits_raw: Option<&str>,
    ) {
        self.class_id = class_id;
        self.cap = spirit_cap_from_blue(blue_stone);
        self.cost = ultimate_cost_from_blue(blue_stone);
        self.refund = class_refund_gain(class_id);
        self.has_vog = parse_pair_list(traits_raw)
            .iter()
            .any(|(id, _)| *id == VOG_TRAIT_ID);
        self.is_gunde = class_id == Some(GUNDE_CLASS_ID);

        // Dungeon start SP from The Herald blessing; the ultimate anchor
        // corrects the model at the first ult if this reads wrong.
        if self.is_gunde && !self.configured {
            let herald_tier = parse_pair_list(blessings_raw)
                .iter()
                .find(|(id, _)| *id == GUNDE_HERALD_BLESSING_ID)
                .map(|(_, tier)| (*tier).clamp(0, 4) as usize)
                .unwrap_or(0);
            self.sp = HERALD_START_SP[herald_tier];
            self.last_emitted = self.sp;
        }
        self.configured = true;
    }

    /// Advances the base +1/3s tick up to `ts_ms`. Never reduces the value:
    /// the cap can be unknown (default 100) until COMBATANT_INFO arrives.
    pub fn advance(&mut self, ts_ms: i64) {
        if let Some(last) = self.last_ms {
            if ts_ms > last {
                let dt = (ts_ms - last) as f64 / 1000.0;
                let cap = self.cap().max(self.sp);
                self.sp = (self.sp + dt * SPIRIT_TICK_RATE).min(cap);
            }
            self.last_ms = Some(last.max(ts_ms));
        } else {
            self.last_ms = Some(ts_ms);
        }
    }

    pub fn gain(&mut self, amount: f64) {
        let cap = self.cap().max(self.sp);
        self.sp = (self.sp + amount).clamp(0.0, cap);
    }

    /// Hard sync to a real SP sample from the log (trusted as-is).
    pub fn sync(&mut self, ts_ms: i64, value: f64) {
        self.advance(ts_ms);
        self.sp = value.max(0.0);
        self.synced = true;
    }

    /// Spirit Refund procs (count derived from Rising Spirit stack changes).
    pub fn on_refund_procs(&mut self, ts_ms: i64, procs: f64) {
        if procs <= 0.0 {
            return;
        }
        self.advance(ts_ms);
        self.gain(procs * self.refund);
    }

    /// Returns true when the model value changed by a visible amount.
    pub fn on_ability_activated(&mut self, ts_ms: i64, ability_id: i64) -> bool {
        self.advance(ts_ms);
        let mut changed = false;
        if self.has_vog {
            if let Some(cd) = weapon_cooldown(ability_id) {
                self.gain(2.5 * cd / 30.0);
                changed = true;
            }
        }
        if let Some(class_id) = self.class_id {
            if let Some((_, _, gain)) = ABILITY_SPIRIT_GAINS
                .iter()
                .find(|(class, ability, _)| *class == class_id && *ability == ability_id)
            {
                self.gain(*gain);
                changed = true;
            }
        }
        if self.is_gunde && ability_id == GUNDE_ULT_ABILITY_ID {
            // A single cast can be logged twice within a fraction of a second;
            // debounce so the cost is not subtracted two times.
            let duplicate = self
                .last_ult_ms
                .is_some_and(|last| (ts_ms - last).abs() < 2000);
            if !duplicate {
                // The ult fired, so SP was at least the cost: anchor from below.
                self.sp = (self.sp.max(self.ult_cost()) - self.ult_cost()).max(0.0);
                self.last_ult_ms = Some(ts_ms);
                changed = true;
            }
        }
        changed
    }

    /// Player died: the game removes 25% of current SP; the log reports the
    /// exact keep fraction in the UNIT_DESTROYED line.
    pub fn on_death(&mut self, ts_ms: i64, keep_raw: Option<f64>) {
        self.advance(ts_ms);
        let keep = keep_raw
            .filter(|value| value.is_finite() && *value > 0.0 && *value <= 1.0)
            .unwrap_or(0.75);
        self.sp = (self.sp * keep).max(0.0);
    }
}

/// Shared (non-per-player) model state: NPC HP lows and the boss-summon rule.
#[derive(Default, Clone)]
pub struct SpiritModelShared {
    npc_low: HashMap<String, f64>,
    seen_npcs: HashSet<String>,
    summon_npcs: HashSet<String>,
    pub in_encounter: bool,
}

impl SpiritModelShared {
    pub fn reset(&mut self) {
        self.npc_low.clear();
        self.seen_npcs.clear();
        self.summon_npcs.clear();
        self.in_encounter = false;
    }

    fn npc_template_id(npc_id: &str) -> Option<i64> {
        npc_id.rsplit('-').next()?.parse::<i64>().ok()
    }

    /// Registers an NPC HP observation (or death when `hp_fraction` is None)
    /// and returns the SP amount granted to EACH party member, if any.
    pub fn observe_npc(&mut self, npc_id: &str, hp_fraction: Option<f64>, party_size: usize) -> f64 {
        let Some(template_id) = Self::npc_template_id(npc_id) else {
            return 0.0;
        };
        let (spv, kill_score) = npc_spirit_values(template_id);

        if self.seen_npcs.insert(npc_id.to_string()) {
            // Roster-type mobs (kill score > 0) first seen inside an encounter
            // are boss summons and grant no SP.
            if self.in_encounter && kill_score > 0.0 {
                self.summon_npcs.insert(npc_id.to_string());
            }
        }
        if spv <= 0.0 || self.summon_npcs.contains(npc_id) {
            return 0.0;
        }

        let previous = self.npc_low.get(npc_id).copied().unwrap_or(1.0);
        let fraction = hp_fraction.unwrap_or(0.0).clamp(0.0, 1.0);
        if fraction >= previous {
            return 0.0;
        }
        self.npc_low.insert(npc_id.to_string(), fraction);
        spv * (previous - fraction) / party_size.max(1) as f64
    }
}
