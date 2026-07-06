pub fn split_log_line(line: &str) -> Vec<&str> {
    let mut result = Vec::new();
    let mut in_quotes = false;
    let mut square_depth = 0_i32;
    let mut round_depth = 0_i32;
    let mut start = 0;

    for (index, ch) in line.char_indices() {
        if ch == '"' {
            in_quotes = !in_quotes;
            continue;
        }

        if !in_quotes {
            match ch {
                '[' => square_depth += 1,
                ']' => square_depth -= 1,
                '(' => round_depth += 1,
                ')' => round_depth -= 1,
                '|' if square_depth == 0 && round_depth == 0 => {
                    result.push(&line[start..index]);
                    start = index + ch.len_utf8();
                    continue;
                }
                _ => {}
            }
        }
    }

    result.push(&line[start..]);
    result
}

pub fn unquote_str(value: Option<&str>) -> &str {
    let value = value.unwrap_or("").trim();
    if value.len() >= 2 && value.starts_with('"') && value.ends_with('"') {
        &value[1..value.len() - 1]
    } else {
        value
    }
}

pub fn to_i64(value: Option<&str>) -> Option<i64> {
    value?
        .parse::<f64>()
        .ok()
        .filter(|value| value.is_finite())
        .map(|value| value as i64)
}

pub fn to_f64(value: Option<&str>) -> f64 {
    value
        .and_then(|value| value.parse::<f64>().ok())
        .filter(|value| value.is_finite())
        .unwrap_or(0.0)
}

pub fn is_player_id(value: Option<&str>) -> bool {
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
    let bytes = clean.as_bytes();
    if bytes.len() < 19
        || bytes.get(4) != Some(&b'-')
        || bytes.get(7) != Some(&b'-')
        || bytes.get(10) != Some(&b'T')
        || bytes.get(13) != Some(&b':')
        || bytes.get(16) != Some(&b':')
    {
        return None;
    }

    let year = parse_digits_i64(bytes, 0, 4)?;
    let month = parse_digits_i64(bytes, 5, 2)?;
    let day = parse_digits_i64(bytes, 8, 2)?;
    let hour = parse_digits_i64(bytes, 11, 2)?;
    let minute = parse_digits_i64(bytes, 14, 2)?;
    let second = parse_digits_i64(bytes, 17, 2)?;
    let millis = parse_millis(bytes, 19)?;

    Some(
        days_from_civil(year, month, day) * 86_400_000
            + hour * 3_600_000
            + minute * 60_000
            + second * 1000
            + millis
            - offset_minutes * 60_000,
    )
}

fn parse_digits_i64(bytes: &[u8], start: usize, len: usize) -> Option<i64> {
    let mut value = 0_i64;
    for index in start..start + len {
        let digit = bytes.get(index)?.checked_sub(b'0')?;
        if digit > 9 {
            return None;
        }
        value = value * 10 + i64::from(digit);
    }
    Some(value)
}

fn parse_millis(bytes: &[u8], start: usize) -> Option<i64> {
    if bytes.get(start) != Some(&b'.') {
        return Some(0);
    }

    let mut value = 0_i64;
    let mut digits = 0;
    for byte in bytes.iter().skip(start + 1) {
        if !byte.is_ascii_digit() {
            break;
        }
        if digits < 3 {
            value = value * 10 + i64::from(byte - b'0');
        }
        digits += 1;
    }
    if digits == 0 {
        return None;
    }
    for _ in digits..3 {
        value *= 10;
    }
    Some(value)
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
