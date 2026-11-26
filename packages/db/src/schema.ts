import { sql } from "drizzle-orm";
import {
  bigint, bigserial, boolean, char, customType, index, integer, jsonb, pgEnum, pgTable,
  primaryKey, serial, text, timestamp, uniqueIndex, date,
} from "drizzle-orm/pg-core";

/** numeric(78,0) mapped to bigint — raw on-chain token amounts. */
const uint256 = customType<{ data: bigint; driverData: string }>({
  dataType: () => "numeric(78, 0)",
  toDriver: (v) => v.toString(),
  fromDriver: (v) => BigInt(v),
});
const micro = (name: string) => bigint(name, { mode: "bigint" });
const addr = (name: string) => char(name, { length: 42 });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ───────────── enums
export const exclusionReason = pgEnum("exclusion_reason", ["lp", "treasury", "vault", "ops", "protocol", "burn", "blacklist"]);
export const bucketEnum = pgEnum("bucket", ["pool", "vault", "ops"]);
export const inflowClass = pgEnum("inflow_class", ["fee", "non_fee"]);
export const epochStatus = pgEnum("epoch_status", ["open", "closing", "computed", "published"]);
export const accountType = pgEnum("account_type", ["holder", "agent"]);
export const ledgerKind = pgEnum("ledger_kind", [
  "epoch_credit", "usage_debit", "allocation_out", "allocation_in", "reclaim_out", "reclaim_in",
  "admin_adjust", "expiry", "onchain_claim", "onchain_deposit",
]);
export const usageStatus = pgEnum("usage_status", ["reserved", "settled", "failed", "released"]);
export const authMethod = pgEnum("auth_method", ["api_key", "eip712", "session"]);
export const agentStatus = pgEnum("agent_status", ["active", "stopped", "frozen"]);

// ───────────── config & audit
export const params = pgTable("params", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paramVersions = pgTable("param_versions", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),
  version: integer("version").notNull(),
  value: jsonb("value").notNull(),
  signer: text("signer"),
  signature: text("signature"),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("param_versions_key_version").on(t.key, t.version)]);

export const excludedAddresses = pgTable("excluded_addresses", {
  address: addr("address").primaryKey(),
  reason: exclusionReason("reason").notNull(),
  active: boolean("active").notNull().default(true),
  note: text("note"),
  addedBy: text("added_by"),
  createdAt: createdAt(),
});

export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  signature: text("signature"),
  ip: text("ip"),
  createdAt: createdAt(),
});

// ───────────── indexer
export const indexerCursors = pgTable("indexer_cursors", {
  name: text("name").primaryKey(),
  chainId: integer("chain_id").notNull(),
  lastBlock: bigint("last_block", { mode: "bigint" }).notNull(),
  lastBlockHash: text("last_block_hash"),
  lastBlockTime: integer("last_block_time").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tokenTransfers = pgTable("token_transfers", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  chainId: integer("chain_id").notNull(),
  token: addr("token").notNull(),
  txHash: char("tx_hash", { length: 66 }).notNull(),
  logIndex: integer("log_index").notNull(),
  blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
  blockHash: char("block_hash", { length: 66 }).notNull(),
  blockTime: integer("block_time").notNull(),
  from: addr("from_address").notNull(),
  to: addr("to_address").notNull(),
  amount: uint256("amount_raw").notNull(),
}, (t) => [
  uniqueIndex("token_transfers_uniq").on(t.chainId, t.txHash, t.logIndex),
  index("token_transfers_token_time").on(t.token, t.blockTime),
  index("token_transfers_block").on(t.blockNumber),
]);

export const holderBalances = pgTable("holder_balances", {
  address: addr("address").primaryKey(),
  balance: uint256("balance_raw").notNull(),
  lastBlock: bigint("last_block", { mode: "bigint" }).notNull(),
});

export const treasuryInflows = pgTable("treasury_inflows", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  chainId: integer("chain_id").notNull(),
  token: addr("token").notNull(), // 0x000…000 = native ETH
  txHash: char("tx_hash", { length: 66 }).notNull(),
  logIndex: integer("log_index").notNull().default(-1),
  from: addr("from_address").notNull(),
  amount: uint256("amount_raw").notNull(),
  blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
  blockTime: integer("block_time").notNull(),
  usdEstimateMicro: micro("usd_estimate_micro"),
  classification: inflowClass("classification").notNull().default("fee"),
  classifiedBy: text("classified_by"),
  classificationNote: text("classification_note"),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("treasury_inflows_uniq").on(t.chainId, t.txHash, t.logIndex, t.token)]);

export const feeAllocations = pgTable("fee_allocations", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  inflowId: bigint("inflow_id", { mode: "bigint" }).notNull().references(() => treasuryInflows.id),
  bucket: bucketEnum("bucket").notNull(),
  token: addr("token").notNull(),
  amount: uint256("amount_raw").notNull(),
  splitVersion: integer("split_version").notNull(),
}, (t) => [uniqueIndex("fee_alloc_uniq").on(t.inflowId, t.bucket)]);

export const swaps = pgTable("swaps", {
  id: serial("id").primaryKey(),
  bucket: bucketEnum("bucket").notNull(),
  txHash: char("tx_hash", { length: 66 }).notNull().unique(),
  fromToken: addr("from_token"),
  fromAmount: uint256("from_amount_raw"),
  toToken: addr("to_token").notNull(),
  toAmount: uint256("to_amount_raw").notNull(),
  toAddress: addr("to_address").notNull(),
  /** realized stable value credited to the pool budget (µkwota), pool bucket only */
  poolCreditMicro: micro("pool_credit_micro").notNull().default(sql`0`),
  recordedBy: text("recorded_by").notNull(),
  verified: boolean("verified").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  note: text("note"),
  createdAt: createdAt(),
});

export const providerTopups = pgTable("provider_topups", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  amountMicro: micro("amount_micro").notNull(),
  proofRef: text("proof_ref").notNull(),
  recordedBy: text("recorded_by").notNull(),
  note: text("note"),
  createdAt: createdAt(),
});

// ───────────── epochs
export const epochs = pgTable("epochs", {
  id: integer("id").primaryKey(),
  startTime: integer("start_time").notNull(),
  endTime: integer("end_time").notNull(),
  startBlock: bigint("start_block", { mode: "bigint" }),
  endBlock: bigint("end_block", { mode: "bigint" }),
  status: epochStatus("status").notNull().default("open"),
  budgetMicro: micro("budget_micro").notNull().default(sql`0`),
  dustInMicro: micro("dust_in_micro").notNull().default(sql`0`),
  dustOutMicro: micro("dust_out_micro").notNull().default(sql`0`),
  distributedMicro: micro("distributed_micro").notNull().default(sql`0`),
  totalWeight: uint256("total_weight").notNull().default(sql`0`),
  eligibleCount: integer("eligible_count").notNull().default(0),
  merkleRoot: text("merkle_root"),
  snapshotSha256: text("snapshot_sha256"),
  snapshotJson: text("snapshot_json"),
  paramsUsed: jsonb("params_used"),
  onchainTx: text("onchain_tx"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const epochAllocations = pgTable("epoch_allocations", {
  epochId: integer("epoch_id").notNull().references(() => epochs.id),
  address: addr("address").notNull(),
  twab: uint256("twab_raw").notNull(),
  balanceSeconds: uint256("balance_seconds").notNull(),
  sharePpm: integer("share_ppm").notNull(),
  kwotaMicro: micro("kwota_micro").notNull(),
}, (t) => [primaryKey({ columns: [t.epochId, t.address] })]);

// ───────────── users, accounts, ledger
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  address: addr("address").notNull().unique(),
  createdAt: createdAt(),
});

export const kwotaAccounts = pgTable("kwota_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: accountType("type").notNull(),
  agentId: integer("agent_id").unique(),
  balanceMicro: micro("balance_micro").notNull().default(sql`0`),
  reservedMicro: micro("reserved_micro").notNull().default(sql`0`),
  createdAt: createdAt(),
}, (t) => [index("kwota_accounts_user").on(t.userId)]);

export const ledgerEntries = pgTable("ledger_entries", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  accountId: integer("account_id").notNull().references(() => kwotaAccounts.id),
  deltaMicro: micro("delta_micro").notNull(),
  kind: ledgerKind("kind").notNull(),
  refType: text("ref_type"),
  refId: text("ref_id"),
  balanceAfterMicro: micro("balance_after_micro").notNull(),
  actor: text("actor").notNull(),
  createdAt: createdAt(),
}, (t) => [index("ledger_account").on(t.accountId, t.id), uniqueIndex("ledger_idem").on(t.accountId, t.kind, t.refType, t.refId)]);

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  agentId: integer("agent_id"),
  name: text("name").notNull(),
  prefix: text("prefix").notNull().unique(),
  secretHash: text("secret_hash").notNull(),
  rpmLimit: integer("rpm_limit"),
  maxCostPerRequestMicro: micro("max_cost_per_request_micro"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// ───────────── gateway
export const models = pgTable("models", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  providerModelId: text("provider_model_id").notNull(),
  displayName: text("display_name").notNull(),
  contextLength: integer("context_length"),
  inputPriceMicroPerMTok: micro("input_price_micro_per_mtok").notNull(),
  outputPriceMicroPerMTok: micro("output_price_micro_per_mtok").notNull(),
  markupBps: integer("markup_bps").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const usageRequests = pgTable("usage_requests", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  accountId: integer("account_id").notNull().references(() => kwotaAccounts.id),
  userId: integer("user_id").notNull(),
  apiKeyId: integer("api_key_id"),
  agentId: integer("agent_id"),
  modelId: text("model_id").notNull(),
  status: usageStatus("status").notNull(),
  stream: boolean("stream").notNull().default(false),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  reservedMicro: micro("reserved_micro").notNull(),
  costMicro: micro("cost_micro"),
  providerRequestId: text("provider_request_id"),
  latencyMs: integer("latency_ms"),
  errorCode: text("error_code"),
  authMethod: authMethod("auth_method").notNull(),
  nonce: text("nonce"),
  createdAt: createdAt(),
  settledAt: timestamp("settled_at", { withTimezone: true }),
}, (t) => [index("usage_account_time").on(t.accountId, t.createdAt), index("usage_status").on(t.status)]);

// ───────────── agents
export const agentRegistries = pgTable("agent_registries", {
  id: serial("id").primaryKey(),
  chainId: integer("chain_id").notNull(),
  address: addr("address").notNull(),
  adapter: text("adapter").notNull().default("erc8004_v1"),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
}, (t) => [uniqueIndex("agent_registries_uniq").on(t.chainId, t.address)]);

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  registryId: integer("registry_id").notNull().references(() => agentRegistries.id),
  agentTokenId: uint256("agent_token_id").notNull(),
  name: text("name"),
  ownerAddress: addr("owner_address").notNull(),
  agentWallet: addr("agent_wallet").notNull(),
  allocatorUserId: integer("allocator_user_id").notNull().references(() => users.id),
  status: agentStatus("status").notNull().default("active"),
  dailyLimitMicro: micro("daily_limit_micro").notNull(),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("agents_uniq").on(t.registryId, t.agentTokenId)]);

export const agentDailyUsage = pgTable("agent_daily_usage", {
  agentId: integer("agent_id").notNull().references(() => agents.id),
  day: date("day").notNull(),
  spentMicro: micro("spent_micro").notNull().default(sql`0`),
  reservedMicro: micro("reserved_micro").notNull().default(sql`0`),
}, (t) => [primaryKey({ columns: [t.agentId, t.day] })]);

// ───────────── shared KV (serverless: nonces, rate limits, caches) and generated secrets
export const kvStore = pgTable("kv_store", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [index("kv_store_expires").on(t.expiresAt)]);

export const appSecrets = pgTable("app_secrets", {
  name: text("name").primaryKey(),
  value: text("value").notNull(),
  createdAt: createdAt(),
});
