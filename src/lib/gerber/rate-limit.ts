/**
 * Límite de peticiones en memoria por instancia y ventana deslizante.
 * En Vercel se usa la cabecera x-vercel-forwarded-for que inyecta su proxy.
 * Fuera de Vercel, TRUSTED_PROXY_HOPS indica cuántos proxies fiables hay delante
 * (0 desactiva la confianza en X-Forwarded-For). Con varias instancias, el límite
 * en memoria no es global: para protección fuerte usa el Firewall de Vercel
 * o un almacén de rate limits compartido.
 */
import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from "./limits";

export interface RateOptions { max?: number; windowMs?: number }
interface Entry { times: number[]; windowMs: number }
const MAX_KEYS = 20_000;
const hits = new Map<string, Entry>();

function prune(now: number): void {
  for (const [key, entry] of hits) {
    const last = entry.times[entry.times.length - 1] ?? 0;
    if (now - last > entry.windowMs) hits.delete(key);
  }
  if (hits.size > MAX_KEYS) {
    let toDrop = hits.size - Math.floor(MAX_KEYS * 0.8);
    for (const key of hits.keys()) {
      if (toDrop-- <= 0) break;
      hits.delete(key);
    }
  }
}

export function allowRequest(key: string, opts: RateOptions = {}, now = Date.now()): boolean {
  const max = opts.max ?? RATE_LIMIT_MAX_REQUESTS;
  const windowMs = opts.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const entry = hits.get(key) ?? { times: [], windowMs };
  entry.windowMs = windowMs;
  entry.times = entry.times.filter((t) => t > now - windowMs);
  if (entry.times.length >= max) { hits.set(key, entry); return false; }
  entry.times.push(now);
  hits.set(key, entry);
  if (hits.size > MAX_KEYS) prune(now);
  return true;
}

export function retryAfterSeconds(key: string, opts: RateOptions = {}, now = Date.now()): number {
  const entry = hits.get(key);
  const windowMs = opts.windowMs ?? RATE_LIMIT_WINDOW_MS;
  if (!entry || entry.times.length === 0) return 1;
  return Math.max(1, Math.ceil((entry.times[0] + windowMs - now) / 1000));
}

type HeaderReader = { get(name: string): string | null };
const validIp = (ip: string) => ip.length <= 64 && /^[a-f0-9:.]+$/i.test(ip);
export function clientIp(headers: HeaderReader): string {
  if (process.env.VERCEL === "1") {
    const ip = (headers.get("x-vercel-forwarded-for") || headers.get("x-real-ip") || "").split(",")[0].trim();
    if (validIp(ip)) return ip;
  }
  const hops = Math.max(0, Math.trunc(Number(process.env.TRUSTED_PROXY_HOPS ?? 1)) || 0);
  if (hops > 0) {
    const parts = (headers.get("x-forwarded-for") || "").split(",").map((p) => p.trim()).filter(Boolean);
    const ip = parts[parts.length - hops];
    if (ip && validIp(ip)) return ip;
  }
  return "local";
}
export function clientKey(request: Request): string { return clientIp(request.headers); }
