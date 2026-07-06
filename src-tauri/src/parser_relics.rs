use crate::game_database::get_canonical_relic_id;
use crate::parser::PlayerAccum;
use crate::parser_line_utils::{ms_to_iso_utc, parse_ts_ms};
use serde_json::{json, Value};

pub fn mark_relic_use(player: &mut PlayerAccum, ability_id: Option<i64>, ts: &str) {
    let Some(canonical_id) = get_canonical_relic_id(ability_id) else {
        return;
    };
    let modifier = relic_cooldown_modifier(player);
    let Some(now_ms) = parse_ts_ms(ts) else {
        return;
    };
    for relic in player.relics.iter_mut() {
        if relic["id"].as_i64() != Some(canonical_id) {
            continue;
        }
        relic["lastUsedAt"] = json!(ts);
        update_relic_cooldown_fields(relic, modifier, now_ms);
        break;
    }
}

pub fn is_equipped_relic_ability(player: &PlayerAccum, ability_id: Option<i64>) -> bool {
    let Some(canonical_id) = get_canonical_relic_id(ability_id) else {
        return false;
    };
    player
        .relics
        .iter()
        .any(|relic| relic["id"].as_i64() == Some(canonical_id))
}

pub fn reset_player_relic_cooldowns(player: &mut PlayerAccum) {
    let modifier = relic_cooldown_modifier(player);
    for relic in player.relics.iter_mut() {
        let base_cooldown = relic["baseCooldown"].as_f64().unwrap_or(0.0).max(0.0);
        relic["cooldownModifier"] = json!(modifier);
        relic["effectiveCooldown"] = json!((base_cooldown * modifier).round().max(0.0));
        relic["lastUsedAt"] = Value::Null;
        relic["cooldownEndsAt"] = Value::Null;
        relic["cooldownRemainingMs"] = json!(0);
        relic["isReady"] = json!(true);
    }
}

pub fn compute_relic_cooldown_state(player: &PlayerAccum, now_ms: i64) -> Vec<Value> {
    let modifier = relic_cooldown_modifier(player);
    player
        .relics
        .iter()
        .cloned()
        .map(|mut relic| {
            update_relic_cooldown_fields(&mut relic, modifier, now_ms);
            relic
        })
        .collect()
}

fn relic_cooldown_modifier(player: &PlayerAccum) -> f64 {
    let white = stone_value(player, "white");
    if white >= 1500.0 {
        0.76
    } else if white >= 450.0 {
        0.92
    } else {
        1.0
    }
}

fn stone_value(player: &PlayerAccum, key: &str) -> f64 {
    player
        .stones
        .get(key)
        .and_then(Value::as_f64)
        .filter(|value| value.is_finite())
        .unwrap_or(0.0)
}

fn update_relic_cooldown_fields(relic: &mut Value, modifier: f64, now_ms: i64) {
    let base_cooldown = relic["baseCooldown"].as_f64().unwrap_or(0.0).max(0.0);
    let effective_cooldown = (base_cooldown * modifier).round().max(0.0);
    relic["cooldownModifier"] = json!(modifier);
    relic["effectiveCooldown"] = json!(effective_cooldown);

    let Some(last_used_at) = relic["lastUsedAt"].as_str() else {
        relic["cooldownEndsAt"] = Value::Null;
        relic["cooldownRemainingMs"] = json!(0);
        relic["isReady"] = json!(true);
        return;
    };
    let Some(last_used_ms) = parse_ts_ms(last_used_at) else {
        relic["cooldownRemainingMs"] = json!(0);
        relic["isReady"] = json!(true);
        return;
    };

    let end_ms = last_used_ms + (effective_cooldown as i64) * 1000;
    let remaining_ms = (end_ms - now_ms).max(0);
    relic["cooldownEndsAt"] = json!(ms_to_iso_utc(end_ms));
    relic["cooldownRemainingMs"] = json!(remaining_ms);
    relic["isReady"] = json!(remaining_ms <= 0);
}
