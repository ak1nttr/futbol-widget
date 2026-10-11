//! Proxy for Sofascore's API, exposed to the webview as the `sofa://` scheme
//! (http://sofa.localhost/... on Windows). Responses are cached briefly.
//!
//! Requests go through Windows' bundled curl.exe: Sofascore's bot protection
//! accepts it but rejects the fingerprints of the Rust/Node/Python HTTP stacks
//! we tried, and curl.exe ships with every Windows 10/11 install.

use std::collections::HashMap;
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::http::{Response, StatusCode};

const API: &str = "https://www.sofascore.com/api/v1/";
const USER_AGENT: &str = "okhttp/4.12.0";
const CURL: &str = r"C:\Windows\System32\curl.exe";

#[derive(Clone)]
struct Entry {
    at: Instant,
    status: u16,
    content_type: String,
    body: Vec<u8>,
}

#[derive(Default)]
pub struct Sofa {
    cache: Mutex<HashMap<String, Entry>>,
}

fn ttl_for(path: &str) -> Duration {
    if path.ends_with("/image") {
        Duration::from_secs(24 * 60 * 60)
    } else if path.contains("/events/live") || path.starts_with("event/") {
        Duration::from_secs(15)
    } else {
        Duration::from_secs(60)
    }
}

fn curl(path: &str) -> Result<Entry, String> {
    let mut cmd = Command::new(CURL);
    cmd.args(["-s", "--compressed", "--max-time", "20", "-A", USER_AGENT, "-H", "Accept: */*"])
        // Status and content type go to stderr so stdout is the raw body.
        .args(["-w", "%{stderr}%{http_code} %{content_type}"])
        .arg(format!("{API}{path}"));
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let out = cmd.output().map_err(|e| e.to_string())?;
    let meta = String::from_utf8_lossy(&out.stderr);
    let mut parts = meta.trim().splitn(2, ' ');
    let status = parts.next().and_then(|s| s.parse().ok()).filter(|&s| s > 0).unwrap_or(502);
    let content_type = parts.next().filter(|s| !s.is_empty()).unwrap_or("application/json").to_string();
    Ok(Entry { at: Instant::now(), status, content_type, body: out.stdout })
}

impl Sofa {
    fn fetch(&self, path: &str) -> Result<Entry, String> {
        if let Some(e) = self.cache.lock().unwrap().get(path) {
            if e.at.elapsed() < ttl_for(path) {
                return Ok(e.clone());
            }
        }
        let entry = curl(path)?;
        if entry.status == 200 {
            let mut cache = self.cache.lock().unwrap();
            // Keep memory bounded for a long-running process.
            if cache.len() > 2000 {
                cache.retain(|p, e| e.at.elapsed() < ttl_for(p));
            }
            cache.insert(path.to_string(), entry.clone());
        }
        Ok(entry)
    }

    /// `path_and_query` is the request path without the leading slash, e.g. `team/44/image`.
    /// Blocking: call from a blocking thread.
    pub fn respond(&self, path_and_query: &str) -> Response<Vec<u8>> {
        let builder = Response::builder().header("Access-Control-Allow-Origin", "*");
        let valid = !path_and_query.is_empty()
            && !path_and_query.contains("..")
            && path_and_query.chars().all(|c| c.is_ascii_alphanumeric() || "-_/?=&%.".contains(c));
        if !valid {
            return builder.status(StatusCode::BAD_REQUEST).body(Vec::new()).unwrap();
        }
        match self.fetch(path_and_query) {
            Ok(e) => builder.status(e.status).header("Content-Type", e.content_type).body(e.body).unwrap(),
            Err(err) => builder.status(StatusCode::BAD_GATEWAY).body(err.into_bytes()).unwrap(),
        }
    }
}
