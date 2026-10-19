// A small in-memory rate limiter. Each (limit name, key) pair gets `max` hits per `windowMs`.
//
// Limitation worth knowing: the counters live in this server process. On a single server (or `npm run dev`)
// that is exact. If the app is later deployed to many serverless instances, each instance counts on its own,
// so the effective limit is looser; a shared store such as Redis would be the upgrade.

export interface LimitConfig {
  max: number;
  windowMs: number;
}

export const LIMITS = {
  review: { max: 30, windowMs: 60_000 }, // each review costs an AI call
  debrief: { max: 10, windowMs: 60_000 },
  transcribe: { max: 10, windowMs: 60_000 },
  speak: { max: 40, windowMs: 60_000 }, // a Listen press, plus a few questions fetched ahead
  history: { max: 60, windowMs: 60_000 },
  register: { max: 8, windowMs: 60 * 60_000 },
  confirmEmail: { max: 10, windowMs: 60_000 },
  resendConfirmation: { max: 5, windowMs: 10 * 60_000 },
  loginIp: { max: 20, windowMs: 15 * 60_000 }, // failed sign-ins from one address
  loginAccount: { max: 5, windowMs: 15 * 60_000 }, // failed sign-ins for one account from one address
} satisfies Record<string, LimitConfig>;

export type LimitName = keyof typeof LIMITS;

interface Bucket {
  count: number;
  resetAt: number;
}

export interface LimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const MAX_BUCKETS = 10_000;

export class RateLimiter {
  constructor(
    private readonly buckets: Map<string, Bucket> = new Map(),
    private readonly now: () => number = Date.now
  ) {}

  private active(id: string): Bucket | undefined {
    const bucket = this.buckets.get(id);
    if (bucket && bucket.resetAt <= this.now()) {
      this.buckets.delete(id);
      return undefined;
    }
    return bucket;
  }

  private sweep(): void {
    if (this.buckets.size < MAX_BUCKETS) return;
    const t = this.now();
    for (const [id, b] of this.buckets) if (b.resetAt <= t) this.buckets.delete(id);
    // Still full of live entries (someone is flooding us with new keys): drop the oldest rather than grow without bound.
    while (this.buckets.size >= MAX_BUCKETS) {
      const oldest = this.buckets.keys().next().value;
      if (oldest === undefined) break;
      this.buckets.delete(oldest);
    }
  }

  private result(config: LimitConfig, bucket: Bucket | undefined): LimitResult {
    const count = bucket?.count ?? 0;
    return {
      allowed: count < config.max,
      remaining: Math.max(0, config.max - count),
      retryAfterSeconds: bucket ? Math.max(1, Math.ceil((bucket.resetAt - this.now()) / 1000)) : 0,
    };
  }

  /** Counts one hit and says whether it is within the limit. */
  hit(name: LimitName, key: string, config: LimitConfig = LIMITS[name]): LimitResult {
    const id = `${name}:${key}`;
    let bucket = this.active(id);
    if (!bucket) {
      this.sweep();
      bucket = { count: 0, resetAt: this.now() + config.windowMs };
      this.buckets.set(id, bucket);
    }
    const allowed = bucket.count < config.max;
    if (allowed) bucket.count += 1;
    const r = this.result(config, bucket);
    return { ...r, allowed, remaining: Math.max(0, config.max - bucket.count) };
  }

  /** Looks without counting. */
  peek(name: LimitName, key: string, config: LimitConfig = LIMITS[name]): LimitResult {
    return this.result(config, this.active(`${name}:${key}`));
  }

  /** Forgets every counter. For tests. */
  clear(): void {
    this.buckets.clear();
  }

  reset(name: LimitName, key: string): void {
    this.buckets.delete(`${name}:${key}`);
  }
}

// One shared limiter per server process. Stored on globalThis so every route sees the same counters,
// even if the framework loads this file more than once in development.
const g = globalThis as unknown as { __intervueLimiter?: RateLimiter };
export const limiter: RateLimiter = (g.__intervueLimiter ??= new RateLimiter());

/** The caller's address. Behind a proxy or host (Vercel, nginx) the first X-Forwarded-For entry is the client. */
export function clientIp(headers: Headers | { get(name: string): string | null | undefined }): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return (first || headers.get("x-real-ip")?.trim() || "unknown").slice(0, 64);
}

export function checkLimit(name: LimitName, ip: string): LimitResult {
  return limiter.hit(name, ip);
}

// ── Sign-in lockout ──────────────────────────────────────────────────────────
// Only failures count. A lockout applies to the (address, account) pair, and separately to the address overall.

const accountKey = (ip: string, email: string) => `${ip}|${email.trim().toLowerCase()}`;

export function loginLockedFor(ip: string, email: string): number {
  const byAccount = limiter.peek("loginAccount", accountKey(ip, email));
  const byIp = limiter.peek("loginIp", ip);
  return Math.max(byAccount.allowed ? 0 : byAccount.retryAfterSeconds, byIp.allowed ? 0 : byIp.retryAfterSeconds);
}

export function recordLoginFailure(ip: string, email: string): void {
  limiter.hit("loginAccount", accountKey(ip, email));
  limiter.hit("loginIp", ip);
}

export function recordLoginSuccess(ip: string, email: string): void {
  limiter.reset("loginAccount", accountKey(ip, email));
}
