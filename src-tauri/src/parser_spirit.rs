use crate::parser::PlayerAccum;
use crate::parser_line_utils::parse_ts_ms;
use serde_json::{json, Value};

const RISING_SPIRIT_ID: i64 = 3115;

// Base SP regen is a flat +1 SP per 3.0s server tick (docs/spirit-model.md).
// An EMA of the recent extra gain rate (Spirit Refund procs + shared mob SP)
// is kept on top to extrapolate between log events and to compensate the
// ~5-7s combat log delay.
const SPIRIT_TICK_RATE: f64 = 1.0 / 3.0;
const SPIRIT_EMA_TAU_SECONDS: f64 = 30.0;

fn update_spirit_gain_ema(player: &mut PlayerAccum, ts: &str, current: f64) {
    // After DUNGEON_END the displayed value must freeze: stray buff-tick
    // samples in town would otherwise re-arm the extrapolation rate and the
    // renderer would drift everyone to the cap.
    if player.spirit_regen_paused {
        player.spirit_regen_per_second = 0.0;
        player.spirit_ema_rate = 0.0;
        return;
    }
    let Some(last) = player.spirit.as_ref() else {
        return;
    };
    let Some(last_ms) = last["ts"].as_str().and_then(parse_ts_ms) else {
        return;
    };
    let Some(ts_ms) = parse_ts_ms(ts) else {
        return;
    };

    let dt = (ts_ms - last_ms) as f64 / 1000.0;
    let delta = current - last["current"].as_f64().unwrap_or(0.0);
    let ema = player.spirit_ema_rate;

    if dt > 0.0 && dt <= 5.0 && delta >= -1.0 {
        let extra_rate = ((delta - dt * SPIRIT_TICK_RATE) / dt).clamp(0.0, 3.0);
        let alpha = 1.0 - (-dt / SPIRIT_EMA_TAU_SECONDS).exp();
        player.spirit_ema_rate = ema + alpha * (extra_rate - ema);
    } else if dt > 5.0 {
        player.spirit_ema_rate = ema * (-(dt - 5.0) / (SPIRIT_EMA_TAU_SECONDS * 2.0)).exp();
    } else {
        return;
    }

    player.spirit_regen_per_second = SPIRIT_TICK_RATE + player.spirit_ema_rate;
}

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
    add_spirit_snapshot(player, ts, current, max, ability_id, ability_name, false);
}

/// Publishes the emulated SP value as the player's spirit snapshot.
/// Used for Gunde, whose resources never appear in the combat log.
pub fn emit_model_spirit(player: &mut PlayerAccum, ts: &str) {
    let value = (player.spirit_sim.sp * 10.0).round() / 10.0;
    add_spirit_snapshot(player, ts, value, 0.0, None, None, true);
    player.spirit_sim.last_emitted = player.spirit_sim.sp;
}

#[allow(clippy::too_many_arguments)]
fn add_spirit_snapshot(
    player: &mut PlayerAccum,
    ts: &str,
    current: f64,
    max: f64,
    ability_id: Option<i64>,
    ability_name: Option<&str>,
    modeled: bool,
) {
    let normalized_max = player_spirit_max(player).max(0.0);
    let fallback_max = max.max(0.0);
    let cap = if normalized_max > 0.0 {
        normalized_max
    } else {
        fallback_max
    };
    let normalized_current = current.max(0.0).min(cap);
    update_spirit_gain_ema(player, ts, normalized_current);
    let snapshot = json!({
        "ts": ts,
        "current": normalized_current,
        "max": normalized_max,
        "abilityId": ability_id,
        "abilityName": ability_name,
        "modeled": modeled
    });

    if let Some(last) = player.spirit.as_ref() {
        let same_current =
            (last["current"].as_f64().unwrap_or(-1.0) - normalized_current).abs() < f64::EPSILON;
        let same_max = (last["max"].as_f64().unwrap_or(-1.0) - normalized_max).abs() < f64::EPSILON;
        if same_current && same_max {
            let mut merged = last.clone();
            merged["ts"] = json!(ts);
            merged["modeled"] = json!(modeled);
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

/// Counts Spirit Refund procs from Rising Spirit (3115) stack changes and
/// feeds them into the SP model. Visible classes carry the real SP value on
/// the same log line, so no synthetic snapshot is needed here; Gunde's model
/// value is published instead.
pub fn update_spirit_from_rising_spirit_effect(
    player: &mut PlayerAccum,
    event: &str,
    ts: &str,
    ability_id: Option<i64>,
    ability_name: &str,
    stack_raw: Option<&str>,
) {
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
    let procs = if event == "EFFECT_APPLIED" {
        (if stack > 0 { stack } else { 1 }).max(1)
    } else {
        (stack - previous_stack).max(0)
    };

    player.rising_spirit_stack = stack;
    if procs <= 0 {
        return;
    }

    if let Some(ts_ms) = parse_ts_ms(ts) {
        player.spirit_sim.on_refund_procs(ts_ms, procs as f64);
        if player.spirit_sim.is_gunde {
            emit_model_spirit(player, ts);
        }
    }
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
