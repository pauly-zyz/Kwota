import { eq } from "drizzle-orm";
import { tables, type Db } from "@kwota/db";
import { validateSplit, type FeeSplit, type MinHoldingMode } from "@kwota/core";
import { z } from "zod";

export interface Params {
  fee_split: FeeSplit;
  /** raw token units (18 decimals) as decimal string */
  min_holding_raw: string;
  min_holding_mode: MinHoldingMode;
  epoch_seconds: number;
  epoch_distribute_bps: number;
  kwota_expiry_epochs: number;
  max_cost_per_request_micro: string;
  max_output_tokens: number;
  rpm_per_key: number;
  rpm_per_wallet: number;
  max_agents_per_holder: number;
  agent_daily_limit_max_micro: string;
}

export const DEFAULT_PARAMS: Params = {
  fee_split: { poolBps: 5000, vaultBps: 3000, opsBps: 2000 },
  min_holding_raw: "0",
  min_holding_mode: "twab",
  epoch_seconds: 86_400,
  epoch_distribute_bps: 9000,
  kwota_expiry_epochs: 30,
  max_cost_per_request_micro: "500000",
  max_output_tokens: 4096,
  rpm_per_key: 30,
  rpm_per_wallet: 60,
  max_agents_per_holder: 10,
  agent_daily_limit_max_micro: "100000000",
};

const uintStr = z.string().regex(/^\d+$/);
export const paramSchemas: { [K in keyof Params]: z.ZodType<Params[K]> } = {
  fee_split: z
    .object({ poolBps: z.number().int(), vaultBps: z.number().int(), opsBps: z.number().int() })
    .superRefine((v, ctx) => {
      try {
        validateSplit(v);
      } catch (e) {
        ctx.addIssue({ code: "custom", message: (e as Error).message });
      }
    }),
  min_holding_raw: uintStr,
  min_holding_mode: z.enum(["twab", "min_balance"]),
  epoch_seconds: z.number().int().min(3600).max(30 * 86_400),
  epoch_distribute_bps: z.number().int().min(0).max(10_000),
  kwota_expiry_epochs: z.number().int().min(0).max(3650),
  max_cost_per_request_micro: uintStr,
  max_output_tokens: z.number().int().min(1).max(200_000),
  rpm_per_key: z.number().int().min(1).max(10_000),
  rpm_per_wallet: z.number().int().min(1).max(10_000),
  max_agents_per_holder: z.number().int().min(0).max(1000),
  agent_daily_limit_max_micro: uintStr,
};

export class ParamService {
  private cache: { at: number; v: Params & { _versions: Record<string, number> } } | null = null;
  constructor(private db: Db) {}

  async all(): Promise<Params & { _versions: Record<string, number> }> {
    if (this.cache && Date.now() - this.cache.at < 5000) return this.cache.v;
    const rows = await this.db.select().from(tables.params);
    const v: Record<string, unknown> = { ...DEFAULT_PARAMS };
    const versions: Record<string, number> = {};
    for (const r of rows) {
      if (r.key in DEFAULT_PARAMS) {
        v[r.key] = r.value;
        versions[r.key] = r.version;
      }
    }
    const out = { ...(v as unknown as Params), _versions: versions };
    this.cache = { at: Date.now(), v: out };
    return out;
  }

  invalidate() {
    this.cache = null;
  }

  /** Validated update; caller is responsible for authorization & audit. */
  async set<K extends keyof Params>(key: K, value: unknown, signer: string, signature: string | null) {
    const schema = paramSchemas[key];
    if (!schema) throw new Error(`unknown param ${String(key)}`);
    const parsed = schema.parse(value);
    return this.db.transaction(async (tx) => {
      const [cur] = await tx.select().from(tables.params).where(eq(tables.params.key, key)).for("update");
      const version = (cur?.version ?? 0) + 1;
      if (cur) {
        await tx.update(tables.params).set({ value: parsed, version, updatedBy: signer, updatedAt: new Date() }).where(eq(tables.params.key, key));
      } else {
        await tx.insert(tables.params).values({ key, value: parsed, version, updatedBy: signer });
      }
      await tx.insert(tables.paramVersions).values({ key, version, value: parsed, signer, signature });
      this.invalidate();
      return { before: cur?.value ?? DEFAULT_PARAMS[key], after: parsed, version };
    });
  }
}
