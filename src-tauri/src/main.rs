// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::{TimeZone, Utc};
use chrono_tz::America::New_York;
use quick_xml::events::Event;
use quick_xml::Reader;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, CONNECTION, USER_AGENT};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State, menu::{Menu, MenuItem}, tray::TrayIconBuilder, WindowEvent};
use tokio::sync::Mutex;

#[derive(Serialize, Deserialize, Clone, Debug)]
struct ReasonDetail {
    code: String,
    title: String,
    description: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct HaltItem {
    id: String,
    symbol: String,
    name: String,
    market: String,
    status: String, // "halted" | "resumed" | "quote_resumed"
    halted_at: Option<String>,
    halted_at_epoch_ms: Option<i64>,
    resumed_at: Option<String>,
    resumed_at_epoch_ms: Option<i64>,
    resumption_quote_at: Option<String>,
    resumption_quote_at_epoch_ms: Option<i64>,
    reasons: Vec<ReasonDetail>,
    pause_threshold_price: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct PerfStats {
    totalPolls: u32,
    hit304Count: u32,
    hit200Count: u32,
    lastLatencyMs: u64,
    avgLatencyMs: u64,
    totalBytesDownloaded: usize,
    totalBytesSaved: usize,
    lastStatusCode: u16,
    keepAliveActive: bool,
    conditionalGetActive: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct DataPayload {
    r#type: String, // "data"
    data: Vec<HaltItem>,
    timestamp: u64,
    count: usize,
    isDataChanged: bool,
    source: String,
    perfStats: PerfStats,
}

struct AppState {
    perf_stats: Mutex<PerfStats>,
    last_etag: Mutex<String>,
    last_modified: Mutex<String>,
    cached_data: Mutex<Vec<HaltItem>>,
    estimated_payload_bytes: Mutex<usize>,
    filters: Mutex<Vec<String>>,
}

fn parse_ny_to_epoch(date_str: &str, time_str: &str) -> Option<i64> {
    if date_str.is_empty() || time_str.is_empty() {
        return None;
    }
    
    // date_str: "M/D/YYYY" or "MM/DD/YYYY"
    let d_parts: Vec<&str> = date_str.split('/').collect();
    if d_parts.len() < 3 {
        return None;
    }
    
    let m = d_parts[0].parse::<u32>().ok()?;
    let d = d_parts[1].parse::<u32>().ok()?;
    let y = d_parts[2].parse::<i32>().ok()?;
    
    // time_str: "H:M:S" or "HH:MM:SS" or "HH:MM:SS.mmm"
    let t_parts: Vec<&str> = time_str.split(':').collect();
    if t_parts.len() < 2 {
        return None;
    }
    
    let hh = t_parts[0].parse::<u32>().ok()?;
    let mm = t_parts[1].parse::<u32>().ok()?;
    
    let mut ss = 0;
    if t_parts.len() >= 3 {
        let s_parts: Vec<&str> = t_parts[2].split('.').collect();
        ss = s_parts[0].parse::<u32>().ok().unwrap_or(0);
    }
    
    // Construct NaiveDateTime
    let naive_date = chrono::NaiveDate::from_ymd_opt(y, m, d)?;
    let naive_time = chrono::NaiveTime::from_hms_opt(hh, mm, ss)?;
    let naive_dt = chrono::NaiveDateTime::new(naive_date, naive_time);
    
    // Convert to America/New_York timezone
    let ny_dt = New_York.from_local_datetime(&naive_dt).single()?;
    
    Some(ny_dt.timestamp_millis())
}

fn get_reason_info(code: &str) -> ReasonDetail {
    let code_upper = code.trim().to_uppercase();
    match code_upper.as_str() {
        "LUDP" => ReasonDetail {
            code: "LUDP".to_string(),
            title: "Volatility Trading Pause (LULD)".to_string(),
            description: "변동성 완화 장치(LULD). 개별 주식 가격이 5분 동안 일정 비율 이상 급등락할 때 발동되는 5분간의 거래 정지입니다. (서킷브레이커)".to_string(),
        },
        "M" => ReasonDetail {
            code: "M".to_string(),
            title: "Volatility Trading Pause".to_string(),
            description: "장내 변동성 정지 (Volatility Trading Pause). 주가가 단기간에 10% 이상 급변할 때 발동되며, 주로 5~10분간 정지됩니다.".to_string(),
        },
        "LU" => ReasonDetail {
            code: "LU".to_string(),
            title: "Limit Up".to_string(),
            description: "상한가 변동성 정지 (Limit Up). 주가가 상한가 한도에 도달하여 거래가 일시 정지된 상태입니다.".to_string(),
        },
        "DP" => ReasonDetail {
            code: "DP".to_string(),
            title: "Limit Down".to_string(),
            description: "하한가 변동성 정지 (Limit Down). 주가가 하한가 한도에 도달하여 거래가 일시 정지된 상태입니다.".to_string(),
        },
        "T1" => ReasonDetail {
            code: "T1".to_string(),
            title: "News Pending".to_string(),
            description: "뉴스 대기 (News Pending). 회사에 중대한 영향을 미칠 뉴스가 발표될 예정일 때 사전 거래 정지가 발동된 상태입니다.".to_string(),
        },
        "T2" => ReasonDetail {
            code: "T2".to_string(),
            title: "News Released".to_string(),
            description: "뉴스 발표 (News Released). 정지 사유였던 뉴스가 배포되어 거래 재개 절차가 진행 중임을 의미합니다.".to_string(),
        },
        "T5" => ReasonDetail {
            code: "T5".to_string(),
            title: "Single Stock Trading Pause In Effect".to_string(),
            description: "급격한 가격 변동성으로 인한 개별 주식 거래 일시 정지 상태입니다.".to_string(),
        },
        "T6" => ReasonDetail {
            code: "T6".to_string(),
            title: "Extraordinary Market Activity".to_string(),
            description: "비정상적 시장 활동 또는 과도한 변동으로 인한 거래 정지 조치 상태입니다.".to_string(),
        },
        "T12" => ReasonDetail {
            code: "T12".to_string(),
            title: "Additional Information Requested".to_string(),
            description: "추가 정보 요청 (Additional Information Requested). 거래소에서 회사 측에 추가적인 정보를 요구하여 정지된 상태입니다.".to_string(),
        },
        "H10" => ReasonDetail {
            code: "H10".to_string(),
            title: "SEC Trading Suspension".to_string(),
            description: "SEC 거래 정지 (SEC Trading Suspension). 미국 증권거래위원회(SEC)가 해당 주식의 거래를 강제로 정지시켰습니다.".to_string(),
        },
        "H11" => ReasonDetail {
            code: "H11".to_string(),
            title: "Regulatory Halt".to_string(),
            description: "규정 미준수 또는 법적 이유로 거래소가 정지 조치했습니다.".to_string(),
        },
        "MW1" => ReasonDetail {
            code: "MW1".to_string(),
            title: "Market-Wide Circuit Breaker Level 1".to_string(),
            description: "시장 전체 서킷브레이커 1단계 발동 (S&P 500 지수 7% 하락 시 15분간 전종목 거래 정지)".to_string(),
        },
        "MW2" => ReasonDetail {
            code: "MW2".to_string(),
            title: "Market-Wide Circuit Breaker Level 2".to_string(),
            description: "시장 전체 서킷브레이커 2단계 발동 (S&P 500 지수 13% 하락 시 15분간 전종목 거래 정지)".to_string(),
        },
        "MW3" => ReasonDetail {
            code: "MW3".to_string(),
            title: "Market-Wide Circuit Breaker Level 3".to_string(),
            description: "시장 전체 서킷브레이커 3단계 발동 (S&P 500 지수 20% 하락 시 당일 잔여시간 거래 종결)".to_string(),
        },
        _ => ReasonDetail {
            code: code_upper.clone(),
            title: if code_upper.is_empty() { "기타 사유".to_string() } else { code_upper.clone() },
            description: if code_upper.is_empty() { "상세 사유가 지정되지 않았습니다.".to_string() } else { format!("사유 코드: {}", code_upper) },
        },
    }
}

async fn fetch_nasdaq_rss(app_handle: AppHandle) {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .pool_idle_timeout(Duration::from_secs(60))
        .pool_max_idle_per_host(5)
        .build()
        .expect("Failed to build reqwest client");

    let url = "https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts";
    let state = app_handle.state::<AppState>();

    loop {
        let start_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;

        let etag = state.last_etag.lock().await.clone();
        let last_mod = state.last_modified.lock().await.clone();

        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) KitFairy/2.0"));
        headers.insert(ACCEPT, HeaderValue::from_static("application/rss+xml, application/xml, text/xml, */*"));
        headers.insert(CONNECTION, HeaderValue::from_static("keep-alive"));
        
        if !etag.is_empty() {
            if let Ok(val) = HeaderValue::from_str(&etag) {
                headers.insert(reqwest::header::IF_NONE_MATCH, val);
            }
        }
        if !last_mod.is_empty() {
            if let Ok(val) = HeaderValue::from_str(&last_mod) {
                headers.insert(reqwest::header::IF_MODIFIED_SINCE, val);
            }
        }

        let mut perf = state.perf_stats.lock().await;
        perf.totalPolls += 1;
        drop(perf);

        match client.get(url).headers(headers).send().await {
            Ok(res) => {
                let latency = (SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64) - start_time;
                let status = res.status();
                
                let mut perf = state.perf_stats.lock().await;
                perf.lastLatencyMs = latency;
                perf.lastStatusCode = status.as_u16();
                if perf.totalPolls > 0 {
                    perf.avgLatencyMs = ((perf.avgLatencyMs * (perf.totalPolls as u64 - 1)) + latency) / (perf.totalPolls as u64);
                }
                drop(perf);

                if status == reqwest::StatusCode::NOT_MODIFIED {
                    let mut perf = state.perf_stats.lock().await;
                    perf.hit304Count += 1;
                    let est = *state.estimated_payload_bytes.lock().await;
                    perf.totalBytesSaved += est;
                    drop(perf);
                    
                    broadcast_data(&app_handle, false).await;
                } else if status == reqwest::StatusCode::OK {
                    let mut perf = state.perf_stats.lock().await;
                    perf.hit200Count += 1;
                    drop(perf);

                    if let Some(etag_header) = res.headers().get(reqwest::header::ETAG) {
                        *state.last_etag.lock().await = etag_header.to_str().unwrap_or("").to_string();
                    }
                    if let Some(last_mod_header) = res.headers().get(reqwest::header::LAST_MODIFIED) {
                        *state.last_modified.lock().await = last_mod_header.to_str().unwrap_or("").to_string();
                    }

                    if let Ok(text) = res.text().await {
                        let bytes = text.len();
                        let mut perf = state.perf_stats.lock().await;
                        perf.totalBytesDownloaded += bytes;
                        drop(perf);
                        *state.estimated_payload_bytes.lock().await = bytes;

                        parse_and_update(&app_handle, &text).await;
                    }
                }
            }
            Err(e) => {
                println!("[NASDAQ RSS] Fetch error: {}", e);
            }
        }

        tokio::time::sleep(Duration::from_millis(1000)).await;
    }
}

async fn parse_and_update(app_handle: &AppHandle, xml_text: &str) {
    let mut reader = Reader::from_str(xml_text);
    reader.trim_text(true);

    let mut buf = Vec::new();
    let mut current_item: HashMap<String, String> = HashMap::new();
    let mut in_item = false;
    let mut current_tag = String::new();
    let mut items = Vec::new();

    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64;
    
    // Quick XML parsing
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).into_owned();
                if name == "item" {
                    in_item = true;
                    current_item.clear();
                } else if in_item {
                    // Strip namespace prefix (e.g., ndc:IssueSymbol -> IssueSymbol)
                    let tag_name = if let Some(idx) = name.find(':') {
                        name[idx + 1..].to_string()
                    } else {
                        name
                    };
                    current_tag = tag_name;
                }
            }
            Ok(Event::End(ref e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).into_owned();
                if name == "item" {
                    in_item = false;
                    
                    let symbol = current_item.get("IssueSymbol").or(current_item.get("title")).cloned().unwrap_or_default();
                    let name_str = current_item.get("IssueName").cloned().unwrap_or_default();
                    
                    let raw_market = current_item.get("Market").cloned().unwrap_or_default().to_uppercase();
                    let market = match raw_market.as_str() {
                        "Q" | "NASDAQ" | "G" | "S" => "NASDAQ".to_string(),
                        "N" | "NYSE" => "NYSE".to_string(),
                        "A" | "P" | "AMEX" | "NYSE AMERICAN" => "AMEX".to_string(),
                        "Z" | "BATS" => "BATS".to_string(),
                        _ => if !raw_market.is_empty() { raw_market } else { "NASDAQ".to_string() }
                    };

                    let code = current_item.get("ReasonCode").cloned().unwrap_or_default();
                    let pause_price = current_item.get("PauseThresholdPrice").cloned().unwrap_or_default();
                    
                    let halt_date = current_item.get("HaltDate").cloned().unwrap_or_default();
                    let halt_time = current_item.get("HaltTime").cloned().unwrap_or_default();
                    let res_date = current_item.get("ResumptionDate").or(current_item.get("HaltDate")).cloned().unwrap_or_default();
                    let res_quote = current_item.get("ResumptionQuoteTime").cloned().unwrap_or_default();
                    let res_trade = current_item.get("ResumptionTradeTime").cloned().unwrap_or_default();

                    let halted_epoch = parse_ny_to_epoch(&halt_date, &halt_time);
                    let quote_epoch = parse_ny_to_epoch(&res_date, &res_quote);
                    let trade_epoch = parse_ny_to_epoch(&res_date, &res_trade);

                    let code_upper = code.trim().to_uppercase();
                    let is_luld = code_upper == "LUDP" || code_upper == "LUDT" || code_upper == "M" || code_upper == "LU" || code_upper == "DP";
                    let grace_ms = if is_luld { 20000 } else { 0 };

                    let mut status = "halted".to_string();
                    if let Some(t_epoch) = trade_epoch {
                        if now >= t_epoch + grace_ms { status = "resumed".to_string(); }
                    } else if let Some(q_epoch) = quote_epoch {
                        if let Some(h_epoch) = halted_epoch {
                            if q_epoch > h_epoch + 1000 && now >= q_epoch {
                                status = "quote_resumed".to_string();
                            }
                        }
                    }

                    let reason_detail = get_reason_info(&code);

                    let item = HaltItem {
                        id: format!("{}_{}", symbol, halted_epoch.unwrap_or(now)),
                        symbol,
                        name: name_str,
                        market,
                        status,
                        halted_at: halted_epoch.map(|e| {
                            Utc.timestamp_millis_opt(e).unwrap().to_rfc3339()
                        }),
                        halted_at_epoch_ms: halted_epoch,
                        resumed_at: trade_epoch.map(|e| {
                            Utc.timestamp_millis_opt(e).unwrap().to_rfc3339()
                        }),
                        resumed_at_epoch_ms: trade_epoch,
                        resumption_quote_at: quote_epoch.map(|e| {
                            Utc.timestamp_millis_opt(e).unwrap().to_rfc3339()
                        }),
                        resumption_quote_at_epoch_ms: quote_epoch,
                        reasons: vec![reason_detail],
                        pause_threshold_price: pause_price,
                    };
                    
                    items.push(item);
                }
                current_tag.clear();
            }
            Ok(Event::Text(e)) => {
                if in_item && !current_tag.is_empty() {
                    let text = e.unescape().unwrap_or_default().into_owned();
                    // Append if tag is repeated or just set it
                    current_item.insert(current_tag.clone(), text.trim().to_string());
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => (),
        }
        buf.clear();
    }
    
    // Sort items by halted time desc
    items.sort_by(|a, b| b.halted_at_epoch_ms.unwrap_or(0).cmp(&a.halted_at_epoch_ms.unwrap_or(0)));

    let state = app_handle.state::<AppState>();
    
    // Apply optional filter (example: "IONQ", "LUDP")
    let filters = state.filters.lock().await.clone();
    let mut filtered_items = items;
    
    if !filters.is_empty() {
        filtered_items = filtered_items.into_iter().filter(|item| {
            filters.iter().any(|f| {
                item.symbol.to_uppercase() == f.to_uppercase() ||
                item.reasons.iter().any(|r| r.code.to_uppercase() == f.to_uppercase())
            })
        }).collect();
    }

    *state.cached_data.lock().await = filtered_items;
    
    broadcast_data(app_handle, true).await;
}

async fn broadcast_data(app_handle: &AppHandle, is_data_changed: bool) {
    let state = app_handle.state::<AppState>();
    let cached_data = state.cached_data.lock().await.clone();
    let perf_stats = state.perf_stats.lock().await.clone();
    
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;
    
    let count = cached_data.len();
    
    let payload = DataPayload {
        r#type: "data".to_string(),
        data: cached_data,
        timestamp: now,
        count,
        isDataChanged: is_data_changed,
        source: "NASDAQ_OFFICIAL_RSS".to_string(),
        perfStats: perf_stats,
    };
    
    let _ = app_handle.emit("halt-data-update", payload);
}

#[tauri::command]
async fn set_filters(filters: Vec<String>, state: State<'_, AppState>) -> Result<(), ()> {
    *state.filters.lock().await = filters;
    Ok(())
}

#[tauri::command]
fn open_url(url: String) {
    #[cfg(target_os = "windows")]
    {
        let safe_url = url.replace("&", "^&");
        let _ = std::process::Command::new("cmd").args(["/C", "start", "", &safe_url]).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&url).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
    }
}

#[tauri::command]
fn open_popout(app: tauri::AppHandle, label: String, url: String, title: String) {
    if let Some(_) = app.get_webview_window(&label) {
        return;
    }
    
    // Tauri v2 WebviewUrl::App expects a PathBuf
    let webview_url = tauri::WebviewUrl::App(std::path::PathBuf::from(url));
    
    let _ = tauri::WebviewWindowBuilder::new(
        &app,
        label,
        webview_url
    )
    .title(title)
    .inner_size(420.0, 620.0)
    .always_on_top(true)
    .resizable(true)
    .center()
    .build();
}

fn main() {
    let app_state = AppState {
        perf_stats: Mutex::new(PerfStats {
            totalPolls: 0,
            hit304Count: 0,
            hit200Count: 0,
            lastLatencyMs: 0,
            avgLatencyMs: 0,
            totalBytesDownloaded: 0,
            totalBytesSaved: 0,
            lastStatusCode: 200,
            keepAliveActive: true,
            conditionalGetActive: true,
        }),
        last_etag: Mutex::new(String::new()),
        last_modified: Mutex::new(String::new()),
        cached_data: Mutex::new(Vec::new()),
        estimated_payload_bytes: Mutex::new(45000),
        filters: Mutex::new(Vec::new()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(app_state)
        .setup(|app| {
            let handle = app.handle().clone();
            
            // Create Tray Menu
            let quit_i = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "열기", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            window.show().unwrap();
                            window.set_focus().unwrap();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            window.show().unwrap();
                            window.set_focus().unwrap();
                        }
                    }
                })
                .build(app)?;

            // Spawn the background polling task
            tauri::async_runtime::spawn(async move {
                fetch_nasdaq_rss(handle).await;
            });
            
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // If this is the main window, minimize to tray instead of quitting
                if window.label() == "main" {
                    window.hide().unwrap();
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![set_filters, open_url, open_popout])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
