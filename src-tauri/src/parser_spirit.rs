use crate::parser::PlayerAccum;
use serde_json::{json, Value};

const RISING_SPIRIT_ID: i64 = 3115;
const BLOODBOUND_SPIRIT_ID: i64 = 2296;
const BLOODBOUND_SPIRIT_BUFF_ID: i64 = 3242;

pub fn parse_stones(raw: Option<&str>) -> Value {
    let values: Vec<f64> = raw
        .filter(|raw| raw.starts_with('[') && raw.ends_with(']'))
        .map(|raw| {
            raw[1..raw.len() - 1]
                .split(',')
                .map(|value| value.trim().parse::<f64>().unwrap_or(0.0))
                .collect()
        })
        .unwrap_or_default();

    json!({
        "raw": values,
        "blue": values.get(4).copied().unwrap_or(0.0),
        "green": values.get(2).copied().unwrap_or(0.0),
        "white": values.get(1).copied().unwrap_or(0.0)
    })
}

pub fn extract_spirit(raw: Option<&str>) -> Option<(f64, f64)> {
    let raw = raw?;
    if !raw.starts_with('[') || !raw.ends_with(']') {
        return None;
    }

    for chunk in raw.split('(').skip(1) {
        let Some(end) = chunk.find(')') else {
            continue;
        };
        let values: Vec<f64> = chunk[..end]
            .split(',')
            .filter_map(|value| value.trim().parse::<f64>().ok())
            .collect();
        if values.len() >= 3 && (values[0] - 4.0).abs() < f64::EPSILON {
            return Some((values[1], values[2]));
        }
    }

    None
}

pub fn add_spirit(
    player: &mut PlayerAccum,
    ts: &str,
    current: f64,
    max: f64,
    ability_id: Option<i64>,
    ability_name: Option<&str>,
) {
    let normalized_max = player_spirit_max(player).max(0.0);
    let fallback_max = max.max(0.0);
    let cap = if normalized_max > 0.0 {
        normalized_max
    } else {
        fallback_max
    };
    let normalized_current = current.max(0.0).min(cap);
    let snapshot = json!({
        "ts": ts,
        "current": normalized_current,
        "max": normalized_max,
        "abilityId": ability_id,
        "abilityName": ability_name
    });

    if let Some(last) = player.spirit.as_ref() {
        let same_current =
            (last["current"].as_f64().unwrap_or(-1.0) - normalized_current).abs() < f64::EPSILON;
        let same_max = (last["max"].as_f64().unwrap_or(-1.0) - normalized_max).abs() < f64::EPSILON;
        if same_current && same_max {
            let mut merged = last.clone();
            merged["ts"] = json!(ts);
            if ability_id.is_some() {
                merged["abilityId"] = json!(ability_id);
            }
            if ability_name.is_some() {
                merged["abilityName"] = json!(ability_name);
            }
            player.spirit = Some(merged.clone());
            if let Some(last_history) = player.spirit_history.last_mut() {
                *last_history = merged;
            } else {
                player.spirit_history.push(merged);
            }
            return;
        }
    }

    player.spirit = Some(snapshot.clone());
    player.spirit_history.push(snapshot);
    if player.spirit_history.len() > 120 {
        let excess = player.spirit_history.len() - 120;
        player.spirit_history.drain(0..excess);
    }
}

pub fn update_spirit_from_bloodbound_ability(
    player: &mut PlayerAccum,
    ts: &str,
    ability_id: Option<i64>,
    ability_name: &str,
) {
    if !is_bloodbound_spirit_spend(ability_id, ability_name) {
        return;
    }
    player.rising_spirit_stack = 0;
    add_spirit(
        player,
        ts,
        0.0,
        0.0,
        ability_id,
        Some(ability_name),
    );
}

pub fn update_spirit_from_rising_spirit_effect(
    player: &mut PlayerAccum,
    event: &str,
    ts: &str,
    ability_id: Option<i64>,
    ability_name: &str,
    stack_raw: Option<&str>,
) {
    if is_bloodbound_spirit_spend(ability_id, ability_name) {
        player.rising_spirit_stack = 0;
        add_spirit(
            player,
            ts,
            0.0,
            0.0,
            ability_id,
            Some(ability_name),
        );
        return;
    }

    if !is_rising_spirit_refund(ability_id, ability_name) {
        return;
    }

    if event == "EFFECT_REMOVED" {
        player.rising_spirit_stack = 0;
        return;
    }

    let stack = stack_raw
        .and_then(|value| value.parse::<f64>().ok())
        .filter(|value| value.is_finite())
        .map(|value| value.floor().max(0.0) as i64)
        .unwrap_or(0);
    let previous_stack = player.rising_spirit_stack.max(0);
    let gained_spirit = if event == "EFFECT_APPLIED" {
        (if stack > 0 { stack } else { 1 }).max(1)
    } else {
        (stack - previous_stack).max(0)
    };

    player.rising_spirit_stack = stack;
    if gained_spirit <= 0 {
        return;
    }

    let current_spirit = player
        .spirit
        .as_ref()
        .and_then(|spirit| spirit["current"].as_f64())
        .unwrap_or(0.0)
        + gained_spirit as f64;
    add_spirit(
        player,
        ts,
        current_spirit,
        0.0,
        ability_id,
        Some(ability_name),
    );
}

fn player_spirit_max(player: &PlayerAccum) -> f64 {
    spirit_max_from_blue_stone(stone_value(player, "blue"))
}

fn spirit_max_from_blue_stone(blue: f64) -> f64 {
    if blue >= 600.0 {
        130.0
    } else if blue >= 100.0 {
        110.0
    } else {
        100.0
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

fn is_rising_spirit_refund(ability_id: Option<i64>, ability_name: &str) -> bool {
    ability_id == Some(RISING_SPIRIT_ID)
        || ability_name.trim().eq_ignore_ascii_case("rising spirit")
}

fn is_bloodbound_spirit_spend(ability_id: Option<i64>, ability_name: &str) -> bool {
    ability_id == Some(BLOODBOUND_SPIRIT_ID)
        || ability_id == Some(BLOODBOUND_SPIRIT_BUFF_ID)
        || ability_name
            .trim()
            .eq_ignore_ascii_case("bloodbound spirit")
}
