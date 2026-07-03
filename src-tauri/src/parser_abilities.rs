use crate::parser::{AbilityAccum, EncounterAccum, PlayerAccum};
use crate::parser_line_utils::unquote;
use serde_json::{json, Value};
use std::collections::HashMap;

pub fn actor_key(id: &str, name: Option<&str>) -> String {
    format!("{}::{}", id, name.unwrap_or("unknown"))
}

pub fn add_ability(
    player: &mut PlayerAccum,
    ability_id: Option<i64>,
    ability_name: Option<String>,
    kind: &str,
    amount: f64,
    ts: Option<&str>,
) {
    if ability_id.is_none() && ability_name.as_deref().unwrap_or("").is_empty() {
        return;
    }

    let key = ability_key(ability_id, ability_name.as_deref());
    let ability = player.abilities.entry(key).or_insert_with(|| AbilityAccum {
        id: ability_id,
        name: ability_name,
        ..AbilityAccum::default()
    });

    match kind {
        "activation" => {
            ability.activations += 1;
            if let Some(ts) = ts {
                ability.last_activation_ts = Some(ts.to_string());
            }
        }
        "damage" => {
            ability.damage += amount;
            ability.hits += 1;
        }
        "healing" => {
            ability.healing += amount;
            ability.hits += 1;
        }
        _ => {}
    }
}

pub fn add_encounter_ability(
    encounter: Option<&mut EncounterAccum>,
    player_id: &str,
    player_name: &str,
    ability_id: Option<i64>,
    ability_name: Option<String>,
    kind: &str,
    amount: f64,
    ts: Option<&str>,
) {
    let Some(encounter) = encounter else {
        return;
    };
    let player_key = actor_key(player_id, Some(player_name));
    if !encounter.abilities_by_player.contains_key(&player_key) {
        encounter.abilities_player_order.push(player_key.clone());
    }
    let abilities = encounter.abilities_by_player.entry(player_key).or_default();
    let key = ability_key(ability_id, ability_name.as_deref());
    let ability = abilities.entry(key).or_insert_with(|| AbilityAccum {
        id: ability_id,
        name: ability_name,
        ..AbilityAccum::default()
    });
    match kind {
        "activation" => {
            ability.activations += 1;
            if let Some(ts) = ts {
                ability.last_activation_ts = Some(ts.to_string());
            }
        }
        "damage" => {
            ability.damage += amount;
            ability.hits += 1;
        }
        "healing" => {
            ability.healing += amount;
            ability.hits += 1;
        }
        _ => {}
    }
}

pub fn parse_encounter_name(raw: Option<&String>) -> Option<String> {
    let value = unquote(raw);
    if value.trim().is_empty() {
        None
    } else if let Ok(parsed) = serde_json::from_str::<Value>(&value) {
        if let Some(items) = parsed.as_array() {
            Some(
                items
                    .iter()
                    .map(|item| {
                        item.as_str()
                            .map(str::to_string)
                            .unwrap_or_else(|| item.to_string())
                    })
                    .collect::<Vec<_>>()
                    .join(", "),
            )
        } else if let Some(name) = parsed.as_str() {
            Some(name.to_string())
        } else {
            Some(parsed.to_string())
        }
    } else {
        Some(value)
    }
}

pub fn ability_to_json(ability: &AbilityAccum) -> Value {
    json!({
        "id": ability.id,
        "name": ability.name,
        "damage": ability.damage,
        "healing": ability.healing,
        "activations": ability.activations,
        "hits": ability.hits,
        "lastActivationTs": ability.last_activation_ts,
        "activationTimestamps": ability.last_activation_ts.as_ref().map(|ts| vec![ts.clone()]).unwrap_or_default()
    })
}

pub fn sort_abilities_by_score(abilities: &mut [Value]) {
    abilities.sort_by(|left, right| {
        ability_score(right)
            .partial_cmp(&ability_score(left))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
}

pub fn combat_ability_values<'a>(abilities: impl Iterator<Item = &'a AbilityAccum>) -> Vec<Value> {
    let mut values: Vec<Value> = abilities.map(ability_to_json).collect();
    values.retain(is_likely_combat_ability);
    sort_abilities_by_score(&mut values);
    values
}

pub fn encounter_to_json(encounter: &EncounterAccum) -> Value {
    let mut abilities_by_player = Vec::new();
    let mut emitted_player_keys = Vec::new();
    for player_key in &encounter.abilities_player_order {
        let Some(abilities) = encounter.abilities_by_player.get(player_key) else {
            continue;
        };
        emitted_player_keys.push(player_key.clone());
        abilities_by_player.push(json!({
            "playerKey": player_key,
            "abilities": combat_ability_values(abilities.values())
        }));
    }
    let mut fallback_player_keys: Vec<&String> = encounter
        .abilities_by_player
        .keys()
        .filter(|player_key| !emitted_player_keys.contains(player_key))
        .collect();
    fallback_player_keys.sort();
    for player_key in fallback_player_keys {
        if let Some(abilities) = encounter.abilities_by_player.get(player_key) {
            abilities_by_player.push(json!({
                "playerKey": player_key,
                "abilities": combat_ability_values(abilities.values())
            }));
        }
    }

    json!({
        "id": encounter.id,
        "name": encounter.name,
        "startedAt": encounter.started_at,
        "endedAt": encounter.ended_at,
        "success": encounter.success,
        "damageByPlayer": map_amounts_to_json(&encounter.damage_by_player),
        "healingByPlayer": map_amounts_to_json(&encounter.healing_by_player),
        "abilitiesByPlayer": abilities_by_player,
        "npcDeaths": encounter.npc_deaths
    })
}

pub fn build_uses_per_boss(player: &PlayerAccum, encounters: &[EncounterAccum]) -> Vec<Value> {
    let player_key = actor_key(&player.id, player.name.as_deref());
    encounters
        .iter()
        .map(|encounter| {
            let abilities = encounter
                .abilities_by_player
                .get(&player_key)
                .map(|abilities| combat_ability_values(abilities.values()))
                .unwrap_or_default();
            json!({
                "encounterId": encounter.id,
                "encounterName": encounter.name,
                "abilities": abilities
            })
        })
        .collect()
}

fn ability_key(id: Option<i64>, name: Option<&str>) -> String {
    format!(
        "{}::{}",
        id.map(|id| id.to_string())
            .unwrap_or_else(|| "unknown".to_string()),
        name.unwrap_or("unknown")
    )
}

fn ability_score(ability: &Value) -> f64 {
    ability["damage"].as_f64().unwrap_or(0.0)
        + ability["healing"].as_f64().unwrap_or(0.0)
        + ability["activations"].as_f64().unwrap_or(0.0)
}

fn is_likely_combat_ability(ability: &Value) -> bool {
    let name = ability["name"].as_str().unwrap_or("").trim();
    if name.is_empty() {
        return false;
    }
    if ability["damage"].as_f64().unwrap_or(0.0) > 0.0
        || ability["healing"].as_f64().unwrap_or(0.0) > 0.0
        || ability["hits"].as_f64().unwrap_or(0.0) > 0.0
    {
        return true;
    }

    let lower = name.to_ascii_lowercase();
    if lower.starts_with("mount ") {
        return false;
    }
    !matches!(lower.as_str(), "levitate" | "making camp" | "remove magic")
}

fn map_amounts_to_json(map: &HashMap<String, f64>) -> Vec<Value> {
    let mut values: Vec<Value> = map
        .iter()
        .map(|(player_key, amount)| {
            json!({
                "playerKey": player_key,
                "amount": amount
            })
        })
        .collect();
    values.sort_by(|left, right| {
        right["amount"]
            .as_f64()
            .unwrap_or(0.0)
            .partial_cmp(&left["amount"].as_f64().unwrap_or(0.0))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    values
}
