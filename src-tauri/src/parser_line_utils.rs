pub fn split_log_line(line: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut square_depth = 0_i32;
    let mut round_depth = 0_i32;

    for ch in line.chars() {
        if ch == '"' {
            in_quotes = !in_quotes;
            current.push(ch);
            continue;
        }

        if !in_quotes {
            match ch {
                '[' => square_depth += 1,
                ']' => square_depth -= 1,
                '(' => round_depth += 1,
                ')' => round_depth -= 1,
                '|' if square_depth == 0 && round_depth == 0 => {
                    result.push(current);
                    current = String::new();
                    continue;
                }
                _ => {}
            }
        }

        current.push(ch);
    }

    result.push(current);
    result
}

pub fn unquote(value: Option<&String>) -> String {
    let value = value.map(String::as_str).unwrap_or("").trim();
    if value.len() >= 2 && value.starts_with('"') && value.ends_with('"') {
        value[1..value.len() - 1].to_string()
    } else {
        value.to_string()
    }
}

pub fn to_i64(value: Option<&String>) -> Option<i64> {
    value?
        .parse::<f64>()
        .ok()
        .filter(|value| value.is_finite())
        .map(|value| value as i64)
}

pub fn to_f64(value: Option<&String>) -> f64 {
    value
        .and_then(|value| value.parse::<f64>().ok())
        .filter(|value| value.is_finite())
        .unwrap_or(0.0)
}

pub fn is_player_id(value: Option<&String>) -> bool {
    value
        .map(|value| value.starts_with("Player-"))
        .unwrap_or(false)
}

pub fn is_npc_id(value: &str) -> bool {
    value.starts_with("Npc-")
}

pub fn parse_ts_ms(ts: &str) -> Option<i64> {
    let trimmed = ts.trim();
    let (clean, offset_minutes) = split_timezone_offset(trimmed);
    let date_time: Vec<&str> = clean.split('T').collect();
    if date_time.len() != 2 {
        return None;
    }
    let date: Vec<i64> = date_time[0]
        .split('-')
        .filter_map(|value| value.parse::<i64>().ok())
        .collect();
    let time_parts: Vec<&str> = date_time[1].split(':').collect();
    if date.len() != 3 || time_parts.len() < 3 {
        return None;
    }
    let hour = time_parts[0].parse::<i64>().ok()?;
    let minute = time_parts[1].parse::<i64>().ok()?;
    let second_parts: Vec<&str> = time_parts[2].split('.').collect();
    let second = second_parts[0].parse::<i64>().ok()?;
    let millis = second_parts
        .get(1)
        .map(|value| {
            value
                .chars()
                .take_while(|ch| ch.is_ascii_digit())
                .take(3)
                .collect::<String>()
        })
        .and_then(|value| format!("{value:0<3}").parse::<i64>().ok())
        .unwrap_or(0);

    Some(
        days_from_civil(date[0], date[1], date[2]) * 86_400_000
            + hour * 3_600_000
            + minute * 60_000
            + second * 1000
            + millis
            - offset_minutes * 60_000,
    )
}

pub fn ms_to_iso_utc(ms: i64) -> String {
    let days = ms.div_euclid(86_400_000);
    let mut rem = ms.rem_euclid(86_400_000);
    let hour = rem / 3_600_000;
    rem %= 3_600_000;
    let minute = rem / 60_000;
    rem %= 60_000;
    let second = rem / 1000;
    let millis = rem % 1000;
    let (year, month, day) = civil_from_days(days);
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{millis:03}Z")
}

fn split_timezone_offset(ts: &str) -> (&str, i64) {
    if let Some(clean) = ts.strip_suffix('Z') {
        return (clean, 0);
    }

    let Some(time_start) = ts.find('T').map(|index| index + 1) else {
        return (ts, 0);
    };
    let Some(relative_pos) = ts[time_start..]
        .char_indices()
        .find(|(_, ch)| *ch == '+' || *ch == '-')
        .map(|(index, _)| index)
    else {
        return (ts, 0);
    };
    let pos = time_start + relative_pos;
    let sign = if ts[pos..].starts_with('-') { -1 } else { 1 };
    let offset = &ts[pos + 1..];
    let mut offset_parts = offset.split(':');
    let hours = offset_parts
        .next()
        .and_then(|value| value.parse::<i64>().ok())
        .unwrap_or(0);
    let minutes = offset_parts
        .next()
        .and_then(|value| value.parse::<i64>().ok())
        .unwrap_or(0);
    (&ts[..pos], sign * (hours * 60 + minutes))
}

fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let year = year - if month <= 2 { 1 } else { 0 };
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let yoe = year - era * 400;
    let month_prime = month + if month > 2 { -3 } else { 9 };
    let doy = (153 * month_prime + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe - 719468
}

fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let days = days + 719468;
    let era = if days >= 0 { days } else { days - 146096 } / 146097;
    let doe = days - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let mut year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    year += if month <= 2 { 1 } else { 0 };
    (year, month, day)
}
