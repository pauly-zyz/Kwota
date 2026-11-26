import { Redis } from "ioredis";

/** Minimal KV used for rate limits, nonces and caches. Redis in prod, memory in dev/tests. */
export interface Kv {
  /** increment counter, set TTL on first increment; returns new value */
  incr(key: string, ttlSec: number): Promise<number>;
  /** set if not exists; true when set */
  setNx(key: string, value: string, ttlSec: number): Promise<boolean>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
  del(key: string): Promise<void>;
  close(): Promise<void>;
}

export class MemoryKv implements Kv {
  private m = new Map<string, { v: string; exp: number }>();
  private live(key: string) {
    const e = this.m.get(key);
    if (e && e.exp < Date.now()) {
      this.m.delete(key);
      return undefined;
    }
    return e;
  }
  async incr(key: string, ttlSec: number) {
    const e = this.live(key);
    const n = (e ? Number(e.v) : 0) + 1;
    this.m.set(key, { v: String(n), exp: e?.exp ?? Date.now() + ttlSec * 1000 });
    return n;
  }
  async setNx(key: string, value: string, ttlSec: number) {
    if (this.live(key)) return false;
    this.m.set(key, { v: value, exp: Date.now() + ttlSec * 1000 });
    return true;
  }
  async get(key: string) {
    return this.live(key)?.v ?? null;
  }
  async set(key: string, value: string, ttlSec: number) {
    this.m.set(key, { v: value, exp: Date.now() + ttlSec * 1000 });
  }
  async del(key: string) {
    this.m.delete(key);
  }
  async close() {}
}

export class RedisKv implements Kv {
  private r: Redis;
  constructor(url: string) {
    this.r = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
  }
  async incr(key: string, ttlSec: number) {
    const res = await this.r.multi().incr(key).expire(key, ttlSec, "NX").exec();
    return Number(res?.[0]?.[1] ?? 0);
  }
  async setNx(key: string, value: string, ttlSec: number) {
    return (await this.r.set(key, value, "EX", ttlSec, "NX")) === "OK";
  }
  async get(key: string) {
    return this.r.get(key);
  }
  async set(key: string, value: string, ttlSec: number) {
    await this.r.set(key, value, "EX", ttlSec);
  }
  async del(key: string) {
    await this.r.del(key);
  }
  async close() {
    this.r.disconnect();
  }
}

export function createKv(url?: string): Kv {
  return url ? new RedisKv(url) : new MemoryKv();
}
