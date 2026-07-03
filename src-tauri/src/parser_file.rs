use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

const RECENT_DUNGEONS_TO_SCAN: usize = 2;
const TAIL_SCAN_INITIAL_SIZE: u64 = 4 * 1024 * 1024;
const TAIL_SCAN_MAX_SIZE: u64 = 64 * 1024 * 1024;

pub fn find_recent_dungeon_parse_offset(file_path: &Path, file_size: u64) -> Result<u64, String> {
    if file_size == 0 {
        return Ok(0);
    }

    let mut file = File::open(file_path).map_err(|error| error.to_string())?;
    let mut scan_size = TAIL_SCAN_INITIAL_SIZE.min(file_size);

    loop {
        let window_start = file_size.saturating_sub(scan_size);
        let window_size = file_size - window_start;
        let mut buffer = vec![0_u8; window_size as usize];
        file.seek(SeekFrom::Start(window_start))
            .map_err(|error| error.to_string())?;
        file.read_exact(&mut buffer)
            .map_err(|error| error.to_string())?;

        let slice_start = if window_start > 0 {
            next_line_start_offset(&buffer, 0)
        } else {
            0
        };
        let absolute_slice_start = window_start + slice_start as u64;
        let sliced_buffer = &buffer[slice_start..];
        let starts = find_dungeon_start_offsets(sliced_buffer, absolute_slice_start);

        if starts.len() >= RECENT_DUNGEONS_TO_SCAN || window_start == 0 {
            return Ok(choose_recent_dungeon_parse_offset(&starts, 0));
        }

        if scan_size >= TAIL_SCAN_MAX_SIZE {
            return Ok(choose_recent_dungeon_parse_offset(
                &starts,
                absolute_slice_start,
            ));
        }

        scan_size = file_size.min((scan_size * 2).max(TAIL_SCAN_INITIAL_SIZE));
    }
}

fn next_line_start_offset(buffer: &[u8], index: usize) -> usize {
    buffer[index..]
        .iter()
        .position(|byte| *byte == b'\n')
        .map(|position| index + position + 1)
        .unwrap_or(0)
}

fn find_dungeon_start_offsets(buffer: &[u8], absolute_start: u64) -> Vec<u64> {
    let mut starts = Vec::new();
    let mut line_start = 0_usize;

    for index in 0..=buffer.len() {
        let is_line_end = index == buffer.len() || buffer[index] == b'\n';
        if !is_line_end {
            continue;
        }

        let mut line_end = index;
        if line_end > line_start && buffer[line_end - 1] == b'\r' {
            line_end -= 1;
        }

        if line_end > line_start {
            let line = &buffer[line_start..line_end];
            if line
                .windows(b"|DUNGEON_START|".len())
                .any(|window| window == b"|DUNGEON_START|")
            {
                starts.push(absolute_start + line_start as u64);
            }
        }

        line_start = index + 1;
    }

    starts
}

fn choose_recent_dungeon_parse_offset(starts: &[u64], fallback_offset: u64) -> u64 {
    if starts.len() >= RECENT_DUNGEONS_TO_SCAN {
        starts[starts.len() - RECENT_DUNGEONS_TO_SCAN]
    } else if let Some(first) = starts.first() {
        *first
    } else {
        fallback_offset
    }
}
