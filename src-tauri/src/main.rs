#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod dungeon;
mod game_database;
mod parser;
mod parser_abilities;
mod parser_file;
mod parser_line_utils;
mod parser_relics;
mod parser_spirit;
mod settings;

use serde::Serialize;
use serde_json::{json, Value};
use settings::{
    default_settings, load_settings, merge_json, path_to_string, save_settings, settings_path,
    value_path,
};
use std::fs;
use std::path::{Path, PathBuf};
#[cfg(target_os = "linux")]
use std::process::Command;
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, SystemTime};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewWindow};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};
#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::CloseHandle;
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

const MAIN_WINDOW_LABEL: &str = "main";
const GAME_PROCESS_CANDIDATES: &[&str] = &[
    "fellowship-Win64-Shipping",
    "fellowship-Win64-Shipping.exe",
    "Fellowship",
    "Fellowship.exe",
    "fellowship",
];

#[derive(Default)]
struct OverlayStateStore {
    click_through: Mutex<bool>,
    visible: Mutex<bool>,
    settings_modal_open: Mutex<bool>,
    interactive_region_active: Mutex<bool>,
}

struct BackendState {
    settings_path: PathBuf,
    settings: Mutex<Value>,
    watch_directory: Mutex<Option<PathBuf>>,
    current_file: Mutex<Option<PathBuf>>,
    watcher_generation: Mutex<u64>,
}

#[derive(Clone, Serialize)]
struct OverlayState {
    click_through: bool,
    visible: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileState {
    file_path: Option<String>,
    directory_path: Option<String>,
    watching: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PickLogResult {
    canceled: bool,
    ok: bool,
    file_path: Option<String>,
    directory_path: Option<String>,
}

#[derive(Clone, Serialize)]
struct WatchStatusPayload {
    ok: bool,
    message: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct HudActivityPayload {
    active: bool,
    foreground_exe: Option<String>,
}

fn is_supported_log(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|extension| extension.to_str()).map(str::to_ascii_lowercase),
        Some(extension) if extension == "log" || extension == "txt"
    )
}

fn emit_log_data(app: &AppHandle, file_path: &Path) {
    let payload = parser::build_log_data_payload(file_path);
    with_main_window(app, |window| {
        let _ = window.emit("log-data", payload);
    });
}

fn file_changed_signature(path: &Path) -> Option<(u64, Option<SystemTime>)> {
    let metadata = fs::metadata(path).ok()?;
    Some((metadata.len(), metadata.modified().ok()))
}

fn find_latest_log_file(directory: &Path) -> Option<PathBuf> {
    let entries = fs::read_dir(directory).ok()?;
    let mut candidates = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() || !is_supported_log(&path) {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        let modified = metadata.modified().ok();
        let created = metadata.created().ok();
        candidates.push((path, created, modified));
    }

    candidates.sort_by(|left, right| {
        right
            .1
            .cmp(&left.1)
            .then_with(|| right.2.cmp(&left.2))
            .then_with(|| right.0.cmp(&left.0))
    });

    candidates.into_iter().map(|candidate| candidate.0).next()
}

fn emit_watch_status(app: &AppHandle, ok: bool, message: impl Into<String>) {
    with_main_window(app, |window| {
        let _ = window.emit(
            "watch-status",
            WatchStatusPayload {
                ok,
                message: message.into(),
            },
        );
    });
}

fn emit_hud_activity(app: &AppHandle, active: bool, foreground_exe: Option<String>) {
    with_main_window(app, |window| {
        let _ = window.emit(
            "hud-activity",
            HudActivityPayload {
                active,
                foreground_exe,
            },
        );
    });
}

fn is_auto_hide_enabled(backend: &BackendState) -> bool {
    backend
        .settings
        .lock()
        .ok()
        .and_then(|settings| {
            settings
                .get("autoHideWithGameWindow")
                .and_then(Value::as_bool)
        })
        .unwrap_or(false)
}

fn start_hud_activity_monitor(app: &AppHandle) {
    let app = app.clone();
    thread::spawn(move || {
        let mut last_active: Option<bool> = None;
        let mut last_foreground_exe: Option<String> = None;
        #[cfg(target_os = "linux")]
        let linux_probe = LinuxActivityProbe::new();

        loop {
            thread::sleep(Duration::from_millis(1000));
            let backend = app.state::<BackendState>();
            let auto_hide_enabled = is_auto_hide_enabled(&backend);
            let (active, foreground_exe) = if auto_hide_enabled {
                #[cfg(target_os = "windows")]
                {
                    detect_game_activity()
                }
                #[cfg(target_os = "linux")]
                {
                    detect_game_activity(&linux_probe)
                }
                #[cfg(not(any(target_os = "windows", target_os = "linux")))]
                {
                    detect_game_activity()
                }
            } else {
                (true, None)
            };

            let settings_open = {
                let state = app.state::<OverlayStateStore>();
                is_settings_modal_open(&state)
            };
            if auto_hide_enabled && !settings_open {
                set_visible_from_app(&app, active);
            }

            if last_active != Some(active) || last_foreground_exe != foreground_exe {
                emit_hud_activity(&app, active, foreground_exe.clone());
                last_active = Some(active);
                last_foreground_exe = foreground_exe;
            }
        }
    });
}

#[cfg(target_os = "windows")]
fn detect_game_activity() -> (bool, Option<String>) {
    let process_name = windows_foreground_process_name();
    let active = process_name
        .as_deref()
        .map(matches_game_process_name)
        .unwrap_or(false);
    (active, process_name)
}

#[cfg(target_os = "windows")]
fn windows_foreground_process_name() -> Option<String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return None;
        }

        let mut pid = 0_u32;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return None;
        }

        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return None;
        }

        let mut buffer = vec![0_u16; 32768];
        let mut size = buffer.len() as u32;
        let ok = QueryFullProcessImageNameW(handle, 0, buffer.as_mut_ptr(), &mut size);
        let _ = CloseHandle(handle);
        if ok == 0 || size == 0 {
            return None;
        }

        let path = String::from_utf16_lossy(&buffer[..size as usize]);
        Path::new(&path)
            .file_name()
            .and_then(|value| value.to_str())
            .map(str::to_string)
            .or(Some(path))
    }
}

#[cfg(target_os = "linux")]
struct LinuxActivityProbe {
    xdotool_available: bool,
}

#[cfg(target_os = "linux")]
impl LinuxActivityProbe {
    fn new() -> Self {
        let xdotool_available = Command::new("sh")
            .args(["-c", "command -v xdotool >/dev/null 2>&1"])
            .status()
            .map(|status| status.success())
            .unwrap_or(false);
        Self { xdotool_available }
    }
}

#[cfg(target_os = "linux")]
fn detect_game_activity(probe: &LinuxActivityProbe) -> (bool, Option<String>) {
    if probe.xdotool_available {
        if let Some(process_name) = linux_foreground_process_name() {
            let active = matches_game_process_name(&process_name);
            return (active, Some(process_name));
        }
    }

    // Fallback for Wayland/minimal systems: keep the HUD visible while the game
    // process exists instead of hiding it forever. This scans /proc directly
    // and does not spawn pgrep every second.
    if let Some(process_name) = linux_running_game_process_name() {
        let active = matches_game_process_name(&process_name);
        return (active || !probe.xdotool_available, Some(process_name));
    }

    (false, None)
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn detect_game_activity() -> (bool, Option<String>) {
    (true, None)
}

#[cfg(target_os = "linux")]
fn linux_foreground_process_name() -> Option<String> {
    let window_id = Command::new("xdotool")
        .args(["getwindowfocus"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())?;

    let pid = Command::new("xdotool")
        .args(["getwindowpid", &window_id])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())?;

    Command::new("ps")
        .args(["-p", &pid, "-o", "comm="])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

#[cfg(target_os = "linux")]
fn linux_running_game_process_name() -> Option<String> {
    let entries = fs::read_dir("/proc").ok()?;
    for entry in entries.flatten() {
        let file_name = entry.file_name();
        let pid_text = file_name.to_string_lossy();
        if !pid_text.chars().all(|ch| ch.is_ascii_digit()) {
            continue;
        }

        let comm_path = entry.path().join("comm");
        if let Ok(comm) = fs::read_to_string(comm_path) {
            let name = comm.trim().to_string();
            if matches_game_process_name(&name) {
                return Some(name);
            }
        }

        let cmdline_path = entry.path().join("cmdline");
        if let Ok(cmdline) = fs::read(cmdline_path) {
            let text = String::from_utf8_lossy(&cmdline).replace('\0', " ");
            if text.to_ascii_lowercase().contains("fellowship") {
                return text.split_whitespace().next().map(str::to_string);
            }
        }
    }

    None
}

fn matches_game_process_name(process_name: &str) -> bool {
    let normalized = process_name.trim().to_ascii_lowercase();
    GAME_PROCESS_CANDIDATES
        .iter()
        .any(|candidate| normalized == candidate.to_ascii_lowercase())
        || normalized.contains("fellowship")
}

fn start_log_directory_watcher(app: &AppHandle, directory: PathBuf) {
    let backend = app.state::<BackendState>();
    let generation = {
        let Ok(mut watcher_generation) = backend.watcher_generation.lock() else {
            return;
        };
        *watcher_generation += 1;
        *watcher_generation
    };
    let initial_file = find_latest_log_file(&directory);
    let initial_signature = initial_file
        .as_ref()
        .and_then(|path| file_changed_signature(path));
    let app = app.clone();

    thread::spawn(move || {
        let mut last_file: Option<PathBuf> = initial_file;
        let mut last_signature: Option<(u64, Option<SystemTime>)> = initial_signature;

        emit_watch_status(&app, true, "Watching folder for the newest log file");

        loop {
            thread::sleep(Duration::from_millis(750));

            let backend = app.state::<BackendState>();
            let still_current = backend
                .watcher_generation
                .lock()
                .map(|current| *current == generation)
                .unwrap_or(false);
            if !still_current {
                break;
            }

            let Some(latest_file) = find_latest_log_file(&directory) else {
                continue;
            };
            let signature = file_changed_signature(&latest_file);
            let changed = last_file.as_ref() != Some(&latest_file) || last_signature != signature;
            if !changed {
                continue;
            }

            last_file = Some(latest_file.clone());
            last_signature = signature;

            if let Ok(mut current_file) = backend.current_file.lock() {
                *current_file = Some(latest_file.clone());
            }
            if let Ok(mut settings) = backend.settings.lock() {
                merge_json(
                    &mut settings,
                    json!({
                        "logDirectoryPath": directory.to_string_lossy().to_string(),
                        "currentFilePath": latest_file.to_string_lossy().to_string()
                    }),
                );
                let _ = save_settings(&backend.settings_path, &settings);
            }

            emit_log_data(&app, &latest_file);
        }
    });
}

fn update_current_file_from_directory(
    app: &AppHandle,
    backend: &BackendState,
    directory: PathBuf,
) -> PickLogResult {
    if !directory.exists() || !directory.is_dir() {
        emit_watch_status(app, false, "Selected folder is unavailable");
        return PickLogResult {
            canceled: false,
            ok: false,
            file_path: None,
            directory_path: Some(directory.to_string_lossy().to_string()),
        };
    }

    let latest_file = find_latest_log_file(&directory);
    {
        if let Ok(mut watch_directory) = backend.watch_directory.lock() {
            *watch_directory = Some(directory.clone());
        }
        if let Ok(mut current_file) = backend.current_file.lock() {
            *current_file = latest_file.clone();
        }
    }

    if let Ok(mut settings) = backend.settings.lock() {
        merge_json(
            &mut settings,
            json!({
                "logDirectoryPath": directory.to_string_lossy().to_string(),
                "currentFilePath": latest_file.as_ref().map(|path| path.to_string_lossy().to_string())
            }),
        );
        let _ = save_settings(&backend.settings_path, &settings);
    }

    match latest_file {
        Some(file_path) => {
            emit_watch_status(app, true, "Watching folder for the newest log file");
            emit_log_data(app, &file_path);
            start_log_directory_watcher(app, directory.clone());
            PickLogResult {
                canceled: false,
                ok: true,
                file_path: Some(file_path.to_string_lossy().to_string()),
                directory_path: Some(directory.to_string_lossy().to_string()),
            }
        }
        None => {
            emit_watch_status(
                app,
                false,
                "No .log or .txt files found in the selected folder",
            );
            PickLogResult {
                canceled: false,
                ok: false,
                file_path: None,
                directory_path: Some(directory.to_string_lossy().to_string()),
            }
        }
    }
}

fn restore_backend_watch_state(app: &AppHandle, backend: &BackendState) {
    let directory = backend
        .settings
        .lock()
        .ok()
        .and_then(|settings| value_path(&settings, "logDirectoryPath"));

    if let Some(directory) = directory {
        let _ = update_current_file_from_directory(app, backend, directory);
    }
}

fn current_state(state: &OverlayStateStore) -> OverlayState {
    OverlayState {
        click_through: *state
            .click_through
            .lock()
            .expect("click-through state lock"),
        visible: *state.visible.lock().expect("visible state lock"),
    }
}

fn emit_state(window: &WebviewWindow, state: &OverlayStateStore) {
    let _ = window.emit("overlay-state", current_state(state));
}

fn apply_cursor_input_mode(
    window: &WebviewWindow,
    state: &OverlayStateStore,
) -> Result<(), String> {
    let click_through = *state
        .click_through
        .lock()
        .map_err(|error| error.to_string())?;
    let interactive_region_active = *state
        .interactive_region_active
        .lock()
        .map_err(|error| error.to_string())?;
    window
        .set_ignore_cursor_events(click_through && !interactive_region_active)
        .map_err(|error| error.to_string())
}

fn set_click_through_for_window(
    window: &WebviewWindow,
    state: &OverlayStateStore,
    enabled: bool,
) -> Result<OverlayState, String> {
    *state
        .click_through
        .lock()
        .map_err(|error| error.to_string())? = enabled;
    *state
        .interactive_region_active
        .lock()
        .map_err(|error| error.to_string())? = false;
    apply_cursor_input_mode(window, state)?;
    emit_state(window, state);
    Ok(current_state(state))
}

fn prepare_native_dialog(app: &AppHandle) {
    let state = app.state::<OverlayStateStore>();
    with_main_window(app, |window| {
        let _ = window.set_always_on_top(false);
        let _ = window.set_ignore_cursor_events(true);
        if let Ok(mut click_through) = state.click_through.lock() {
            *click_through = true;
        }
        if let Ok(mut interactive_region_active) = state.interactive_region_active.lock() {
            *interactive_region_active = false;
        }
        emit_state(&window, &state);
    });
}

fn restore_after_native_dialog(app: &AppHandle) {
    let state = app.state::<OverlayStateStore>();
    with_main_window(app, |window| {
        let _ = window.set_always_on_top(true);
        let _ = window.set_ignore_cursor_events(false);
        if let Ok(mut click_through) = state.click_through.lock() {
            *click_through = false;
        }
        if let Ok(mut interactive_region_active) = state.interactive_region_active.lock() {
            *interactive_region_active = false;
        }
        let _ = window.set_focus();
        emit_state(&window, &state);
    });
}

fn with_main_window<F>(app: &AppHandle, callback: F)
where
    F: FnOnce(WebviewWindow),
{
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        callback(window);
    }
}

fn toggle_click_through_from_app(app: &AppHandle) {
    let state = app.state::<OverlayStateStore>();
    with_main_window(app, |window| {
        let next = !current_state(&state).click_through;
        let _ = set_click_through_for_window(&window, &state, next);
        if !next {
            let _ = window.set_focus();
        }
    });
}

fn set_visible_from_app(app: &AppHandle, visible: bool) {
    let state = app.state::<OverlayStateStore>();
    with_main_window(app, |window| {
        if current_state(&state).visible == visible {
            return;
        }
        let result = if visible {
            window.show()
        } else {
            window.hide()
        };
        if result.is_ok() {
            if let Ok(mut visible_state) = state.visible.lock() {
                *visible_state = visible;
            }
            emit_state(&window, &state);
        }
    });
}

fn toggle_visible_from_app(app: &AppHandle) {
    let state = app.state::<OverlayStateStore>();
    let next = !current_state(&state).visible;
    set_visible_from_app(app, next);
}

fn open_settings_window(app: &AppHandle) {
    let state = app.state::<OverlayStateStore>();
    let backend = app.state::<BackendState>();
    set_visible_from_app(app, true);
    with_main_window(app, |window| {
        let _ = set_click_through_for_window(&window, &state, false);
        let _ = window.set_focus();
        let overlay_state = current_state(&state);
        let file_state = current_file_state(&backend);
        let language = backend
            .settings
            .lock()
            .ok()
            .and_then(|settings| {
                settings
                    .get("language")
                    .and_then(Value::as_str)
                    .map(str::to_string)
            })
            .unwrap_or_else(|| "ru".to_string());
        let _ = window.emit(
            "open-settings",
            serde_json::json!({
                "watching": file_state.watching,
                "locked": overlay_state.click_through,
                "language": language,
                "filePath": file_state.file_path,
                "directoryPath": file_state.directory_path
            }),
        );
    });
}

fn request_close_settings(app: &AppHandle) {
    with_main_window(app, |window| {
        let _ = window.emit("request-close-settings", ());
    });
}

fn is_settings_modal_open(state: &OverlayStateStore) -> bool {
    state
        .settings_modal_open
        .lock()
        .map(|open| *open)
        .unwrap_or(false)
}

fn current_file_state(backend: &BackendState) -> FileState {
    let file_path = backend
        .current_file
        .lock()
        .ok()
        .and_then(|path| path.clone())
        .or_else(|| {
            backend
                .settings
                .lock()
                .ok()
                .and_then(|settings| value_path(&settings, "currentFilePath"))
        });

    let directory_path = backend
        .watch_directory
        .lock()
        .ok()
        .and_then(|path| path.clone())
        .or_else(|| {
            backend
                .settings
                .lock()
                .ok()
                .and_then(|settings| value_path(&settings, "logDirectoryPath"))
        });

    FileState {
        file_path: path_to_string(file_path),
        directory_path: path_to_string(directory_path),
        watching: backend
            .watcher_generation
            .lock()
            .map(|generation| *generation > 0)
            .unwrap_or(false),
    }
}

fn fit_window_to_current_monitor(window: &WebviewWindow) -> Result<(), String> {
    let monitor = window
        .current_monitor()
        .map_err(|error| error.to_string())?;

    if let Some(monitor) = monitor {
        let position = monitor.position();
        let size = monitor.size();
        window
            .set_position(PhysicalPosition::new(position.x, position.y))
            .map_err(|error| error.to_string())?;
        window
            .set_size(PhysicalSize::new(size.width, size.height))
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn configure_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show overlay", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide overlay", true, None::<&str>)?;
    let toggle_lock = MenuItem::with_id(
        app,
        "toggle_lock",
        "Toggle click-through (F8)",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &toggle_lock, &quit])?;

    let mut tray_builder = TrayIconBuilder::new()
        .tooltip("Fellowship Overlay")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => set_visible_from_app(app, true),
            "hide" => set_visible_from_app(app, false),
            "toggle_lock" => toggle_click_through_from_app(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_visible_from_app(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    tray_builder.build(app)?;
    Ok(())
}

fn configure_shortcuts(app: &mut tauri::App) -> tauri::Result<()> {
    let f8 = Shortcut::new(None, Code::F8);
    let f10 = Shortcut::new(None, Code::F10);
    let f11 = Shortcut::new(None, Code::F11);

    let f8_handler = f8.clone();
    let f10_handler = f10.clone();
    let f11_handler = f11.clone();

    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app, shortcut, event| {
                if event.state() != ShortcutState::Pressed {
                    return;
                }

                if shortcut == &f8_handler {
                    toggle_click_through_from_app(app);
                } else if shortcut == &f10_handler {
                    toggle_visible_from_app(app);
                } else if shortcut == &f11_handler {
                    let state = app.state::<OverlayStateStore>();
                    if is_settings_modal_open(&state) {
                        request_close_settings(app);
                    } else {
                        open_settings_window(app);
                    }
                }
            })
            .build(),
    )?;

    for shortcut in [f8, f10, f11] {
        if let Err(error) = app.global_shortcut().register(shortcut) {
            eprintln!("failed to register global shortcut: {error}");
        }
    }

    Ok(())
}

#[tauri::command]
fn get_overlay_state(state: State<OverlayStateStore>) -> OverlayState {
    current_state(&state)
}

#[tauri::command]
fn set_click_through(
    window: WebviewWindow,
    state: State<OverlayStateStore>,
    enabled: bool,
) -> Result<OverlayState, String> {
    set_click_through_for_window(&window, &state, enabled)
}

#[tauri::command]
fn toggle_click_through(
    app: AppHandle,
    state: State<OverlayStateStore>,
) -> Result<OverlayState, String> {
    let next = !current_state(&state).click_through;
    with_main_window(&app, |window| {
        let _ = set_click_through_for_window(&window, &state, next);
        if !next {
            let _ = window.set_focus();
        }
    });
    Ok(current_state(&state))
}

#[tauri::command]
fn toggle_overlay_visibility(app: AppHandle, state: State<OverlayStateStore>) -> OverlayState {
    toggle_visible_from_app(&app);
    current_state(&state)
}

#[tauri::command]
fn show_overlay(app: AppHandle, state: State<OverlayStateStore>) -> OverlayState {
    set_visible_from_app(&app, true);
    current_state(&state)
}

#[tauri::command]
fn hide_overlay(app: AppHandle, state: State<OverlayStateStore>) -> OverlayState {
    set_visible_from_app(&app, false);
    current_state(&state)
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn set_settings_modal_open(
    app: AppHandle,
    state: State<OverlayStateStore>,
    open: bool,
) -> Result<Value, String> {
    if let Ok(mut settings_modal_open) = state.settings_modal_open.lock() {
        *settings_modal_open = open;
    }

    if open {
        with_main_window(&app, |window| {
            let _ = set_click_through_for_window(&window, &state, false);
            let _ = window.set_focus();
        });
    }

    Ok(json!({ "ok": true }))
}

#[tauri::command]
fn close_interactive_modal(
    window: WebviewWindow,
    state: State<OverlayStateStore>,
) -> Result<Value, String> {
    if let Ok(mut settings_modal_open) = state.settings_modal_open.lock() {
        *settings_modal_open = false;
    }
    let overlay_state = set_click_through_for_window(&window, &state, true)?;
    Ok(json!({ "locked": overlay_state.click_through }))
}

#[tauri::command]
fn open_interactive_modal(
    window: WebviewWindow,
    state: State<OverlayStateStore>,
) -> Result<Value, String> {
    let overlay_state = set_click_through_for_window(&window, &state, false)?;
    let _ = window.set_focus();
    Ok(json!({ "locked": overlay_state.click_through }))
}

#[tauri::command]
fn set_interactive_region_active(
    window: WebviewWindow,
    state: State<OverlayStateStore>,
    active: bool,
) -> Result<Value, String> {
    let click_through = *state
        .click_through
        .lock()
        .map_err(|error| error.to_string())?;
    *state
        .interactive_region_active
        .lock()
        .map_err(|error| error.to_string())? = click_through && active;
    apply_cursor_input_mode(&window, &state)?;
    Ok(json!({ "ok": true }))
}

#[tauri::command]
fn get_overlay_settings(backend: State<BackendState>) -> Value {
    backend
        .settings
        .lock()
        .map(|settings| settings.clone())
        .unwrap_or_else(|_| default_settings())
}

#[tauri::command]
fn save_overlay_settings(
    backend: State<BackendState>,
    partial_settings: Value,
) -> Result<Value, String> {
    let mut settings = backend.settings.lock().map_err(|error| error.to_string())?;
    merge_json(&mut settings, partial_settings);
    save_settings(&backend.settings_path, &settings)?;
    Ok(settings.clone())
}

#[tauri::command]
fn get_current_file(backend: State<BackendState>) -> FileState {
    current_file_state(&backend)
}

#[tauri::command]
fn get_language(backend: State<BackendState>) -> Value {
    let language = backend
        .settings
        .lock()
        .ok()
        .and_then(|settings| {
            settings
                .get("language")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .unwrap_or_else(|| "ru".to_string());
    json!({ "language": language })
}

#[tauri::command]
fn set_language(
    app: AppHandle,
    backend: State<BackendState>,
    language: String,
) -> Result<Value, String> {
    let normalized = if language == "en" { "en" } else { "ru" };
    let mut settings = backend.settings.lock().map_err(|error| error.to_string())?;
    merge_json(&mut settings, json!({ "language": normalized }));
    save_settings(&backend.settings_path, &settings)?;
    with_main_window(&app, |window| {
        let _ = window.emit("language-changed", json!({ "language": normalized }));
    });
    Ok(json!({ "language": normalized }))
}

#[tauri::command]
fn pick_log_file(app: AppHandle, backend: State<BackendState>) -> PickLogResult {
    prepare_native_dialog(&app);
    let selected_directory = rfd::FileDialog::new().pick_folder();
    restore_after_native_dialog(&app);

    match selected_directory {
        Some(directory) => update_current_file_from_directory(&app, &backend, directory),
        None => {
            let state = current_file_state(&backend);
            PickLogResult {
                canceled: true,
                ok: false,
                file_path: state.file_path,
                directory_path: state.directory_path,
            }
        }
    }
}

#[tauri::command]
fn reload_current_file(app: AppHandle, backend: State<BackendState>) -> PickLogResult {
    let directory = backend
        .watch_directory
        .lock()
        .ok()
        .and_then(|path| path.clone())
        .or_else(|| {
            backend
                .settings
                .lock()
                .ok()
                .and_then(|settings| value_path(&settings, "logDirectoryPath"))
        });

    match directory {
        Some(directory) => update_current_file_from_directory(&app, &backend, directory),
        None => PickLogResult {
            canceled: false,
            ok: false,
            file_path: None,
            directory_path: None,
        },
    }
}

fn main() {
    let settings_file = settings_path();
    let loaded_settings = load_settings(&settings_file);

    tauri::Builder::default()
        .manage(OverlayStateStore {
            click_through: Mutex::new(true),
            visible: Mutex::new(true),
            settings_modal_open: Mutex::new(false),
            interactive_region_active: Mutex::new(false),
        })
        .manage(BackendState {
            settings_path: settings_file,
            settings: Mutex::new(loaded_settings),
            watch_directory: Mutex::new(None),
            current_file: Mutex::new(None),
            watcher_generation: Mutex::new(0),
        })
        .setup(|app| {
            configure_shortcuts(app)?;
            configure_tray(app)?;
            start_hud_activity_monitor(app.handle());
            let backend = app.state::<BackendState>();
            restore_backend_watch_state(app.handle(), &backend);

            if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                let _ = fit_window_to_current_monitor(&window);
                window.set_always_on_top(true)?;
                window.set_ignore_cursor_events(true)?;
                let state = app.state::<OverlayStateStore>();
                emit_state(&window, &state);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_overlay_state,
            set_click_through,
            toggle_click_through,
            toggle_overlay_visibility,
            show_overlay,
            hide_overlay,
            quit_app,
            set_settings_modal_open,
            open_interactive_modal,
            close_interactive_modal,
            set_interactive_region_active,
            get_overlay_settings,
            save_overlay_settings,
            get_current_file,
            get_language,
            set_language,
            pick_log_file,
            reload_current_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
