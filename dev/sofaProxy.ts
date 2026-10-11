import { execFile } from "node:child_process";
import type { Plugin } from "vite";

// Sofascore blocks Node/OpenSSL TLS fingerprints and browser user agents,
// but accepts Windows' own TLS stack (Schannel). So the dev server forwards
// /sofa/* through the system curl.exe instead of Node's fetch.
// The Tauri build will do the same from Rust with native-tls.
const API = "https://www.sofascore.com/api/v1/";
const CURL = "C:\\Windows\\System32\\curl.exe";
const UA = "okhttp/4.12.0";

type Entry = { at: number; status: number; type: string; body: Buffer };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<Entry>>();

function ttlFor(path: string): number {
  if (path.endsWith("/image")) return 24 * 60 * 60_000;
  if (path.includes("/events/live") || path.includes("/event/")) return 15_000;
  return 60_000;
}

function fetchWithCurl(path: string): Promise<Entry> {
  const args = ["-s", "--compressed", "-A", UA, "-H", "Accept: */*", "-w", "%{stderr}%{http_code} %{content_type}", API + path];
  return new Promise((resolve, reject) => {
    execFile(CURL, args, { encoding: "buffer", maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      const [code, type] = stderr.toString().trim().split(" ");
      resolve({ at: Date.now(), status: Number(code) || 502, type: type || "application/json", body: stdout });
    });
  });
}

async function get(path: string): Promise<Entry> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlFor(path)) return hit;
  let p = inflight.get(path);
  if (!p) {
    p = fetchWithCurl(path).finally(() => inflight.delete(path));
    inflight.set(path, p);
  }
  const entry = await p;
  if (entry.status === 200) cache.set(path, entry);
  return entry;
}

export function sofaProxy(): Plugin {
  return {
    name: "sofa-proxy",
    configureServer(server) {
      server.middlewares.use("/sofa/", async (req, res) => {
        const path = (req.url ?? "").replace(/^\//, "");
        if (!/^[\w\-/?=&%.]+$/.test(path)) {
          res.statusCode = 400;
          return res.end();
        }
        try {
          const e = await get(path);
          res.statusCode = e.status;
          res.setHeader("Content-Type", e.type);
          res.end(e.body);
        } catch (err) {
          res.statusCode = 502;
          res.end(String(err));
        }
      });
    },
  };
}
