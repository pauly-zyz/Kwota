CREATE TYPE "public"."account_type" AS ENUM('holder', 'agent');--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('active', 'stopped', 'frozen');--> statement-breakpoint
CREATE TYPE "public"."auth_method" AS ENUM('api_key', 'eip712', 'session');--> statement-breakpoint
CREATE TYPE "public"."bucket" AS ENUM('pool', 'vault', 'ops');--> statement-breakpoint
CREATE TYPE "public"."epoch_status" AS ENUM('open', 'closing', 'computed', 'published');--> statement-breakpoint
CREATE TYPE "public"."exclusion_reason" AS ENUM('lp', 'treasury', 'vault', 'ops', 'protocol', 'burn', 'blacklist');--> statement-breakpoint
CREATE TYPE "public"."inflow_class" AS ENUM('fee', 'non_fee');--> statement-breakpoint
CREATE TYPE "public"."ledger_kind" AS ENUM('epoch_credit', 'usage_debit', 'allocation_out', 'allocation_in', 'reclaim_out', 'reclaim_in', 'admin_adjust', 'expiry', 'onchain_claim', 'onchain_deposit');--> statement-breakpoint
CREATE TYPE "public"."usage_status" AS ENUM('reserved', 'settled', 'failed', 'released');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_daily_usage" (
	"agent_id" integer NOT NULL,
	"day" date NOT NULL,
	"spent_micro" bigint DEFAULT 0 NOT NULL,
	"reserved_micro" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "agent_daily_usage_agent_id_day_pk" PRIMARY KEY("agent_id","day")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_registries" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"address" char(42) NOT NULL,
	"adapter" text DEFAULT 'erc8004_v1' NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"registry_id" integer NOT NULL,
	"agent_token_id" numeric(78, 0) NOT NULL,
	"name" text,
	"owner_address" char(42) NOT NULL,
	"agent_wallet" char(42) NOT NULL,
	"allocator_user_id" integer NOT NULL,
	"status" "agent_status" DEFAULT 'active' NOT NULL,
	"daily_limit_micro" bigint NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"agent_id" integer,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"secret_hash" text NOT NULL,
	"rpm_limit" integer,
	"max_cost_per_request_micro" bigint,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_prefix_unique" UNIQUE("prefix")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"before" jsonb,
	"after" jsonb,
	"signature" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "epoch_allocations" (
	"epoch_id" integer NOT NULL,
	"address" char(42) NOT NULL,
	"twab_raw" numeric(78, 0) NOT NULL,
	"balance_seconds" numeric(78, 0) NOT NULL,
	"share_ppm" integer NOT NULL,
	"kwota_micro" bigint NOT NULL,
	CONSTRAINT "epoch_allocations_epoch_id_address_pk" PRIMARY KEY("epoch_id","address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "epochs" (
	"id" integer PRIMARY KEY NOT NULL,
	"start_time" integer NOT NULL,
	"end_time" integer NOT NULL,
	"start_block" bigint,
	"end_block" bigint,
	"status" "epoch_status" DEFAULT 'open' NOT NULL,
	"budget_micro" bigint DEFAULT 0 NOT NULL,
	"dust_in_micro" bigint DEFAULT 0 NOT NULL,
	"dust_out_micro" bigint DEFAULT 0 NOT NULL,
	"distributed_micro" bigint DEFAULT 0 NOT NULL,
	"total_weight" numeric(78, 0) DEFAULT 0 NOT NULL,
	"eligible_count" integer DEFAULT 0 NOT NULL,
	"merkle_root" text,
	"snapshot_sha256" text,
	"snapshot_json" text,
	"params_used" jsonb,
	"onchain_tx" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "excluded_addresses" (
	"address" char(42) PRIMARY KEY NOT NULL,
	"reason" "exclusion_reason" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"note" text,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fee_allocations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"inflow_id" bigint NOT NULL,
	"bucket" "bucket" NOT NULL,
	"token" char(42) NOT NULL,
	"amount_raw" numeric(78, 0) NOT NULL,
	"split_version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "holder_balances" (
	"address" char(42) PRIMARY KEY NOT NULL,
	"balance_raw" numeric(78, 0) NOT NULL,
	"last_block" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "indexer_cursors" (
	"name" text PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"last_block" bigint NOT NULL,
	"last_block_hash" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kwota_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" "account_type" NOT NULL,
	"agent_id" integer,
	"balance_micro" bigint DEFAULT 0 NOT NULL,
	"reserved_micro" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kwota_accounts_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"delta_micro" bigint NOT NULL,
	"kind" "ledger_kind" NOT NULL,
	"ref_type" text,
	"ref_id" text,
	"balance_after_micro" bigint NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "models" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"provider_model_id" text NOT NULL,
	"display_name" text NOT NULL,
	"context_length" integer,
	"input_price_micro_per_mtok" bigint NOT NULL,
	"output_price_micro_per_mtok" bigint NOT NULL,
	"markup_bps" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "param_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"version" integer NOT NULL,
	"value" jsonb NOT NULL,
	"signer" text,
	"signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "params" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_topups" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"amount_micro" bigint NOT NULL,
	"proof_ref" text NOT NULL,
	"recorded_by" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "swaps" (
	"id" serial PRIMARY KEY NOT NULL,
	"bucket" "bucket" NOT NULL,
	"tx_hash" char(66) NOT NULL,
	"from_token" char(42),
	"from_amount_raw" numeric(78, 0),
	"to_token" char(42) NOT NULL,
	"to_amount_raw" numeric(78, 0) NOT NULL,
	"to_address" char(42) NOT NULL,
	"pool_credit_micro" bigint DEFAULT 0 NOT NULL,
	"recorded_by" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "swaps_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "token_transfers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"token" char(42) NOT NULL,
	"tx_hash" char(66) NOT NULL,
	"log_index" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"block_hash" char(66) NOT NULL,
	"block_time" integer NOT NULL,
	"from_address" char(42) NOT NULL,
	"to_address" char(42) NOT NULL,
	"amount_raw" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "treasury_inflows" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"token" char(42) NOT NULL,
	"tx_hash" char(66) NOT NULL,
	"log_index" integer DEFAULT -1 NOT NULL,
	"from_address" char(42) NOT NULL,
	"amount_raw" numeric(78, 0) NOT NULL,
	"block_number" bigint NOT NULL,
	"block_time" integer NOT NULL,
	"usd_estimate_micro" bigint,
	"classification" "inflow_class" DEFAULT 'fee' NOT NULL,
	"classified_by" text,
	"classification_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_requests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"api_key_id" integer,
	"agent_id" integer,
	"model_id" text NOT NULL,
	"status" "usage_status" NOT NULL,
	"stream" boolean DEFAULT false NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"reserved_micro" bigint NOT NULL,
	"cost_micro" bigint,
	"provider_request_id" text,
	"latency_ms" integer,
	"error_code" text,
	"auth_method" "auth_method" NOT NULL,
	"nonce" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" char(42) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_address_unique" UNIQUE("address")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_daily_usage" ADD CONSTRAINT "agent_daily_usage_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agents" ADD CONSTRAINT "agents_registry_id_agent_registries_id_fk" FOREIGN KEY ("registry_id") REFERENCES "public"."agent_registries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agents" ADD CONSTRAINT "agents_allocator_user_id_users_id_fk" FOREIGN KEY ("allocator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "epoch_allocations" ADD CONSTRAINT "epoch_allocations_epoch_id_epochs_id_fk" FOREIGN KEY ("epoch_id") REFERENCES "public"."epochs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fee_allocations" ADD CONSTRAINT "fee_allocations_inflow_id_treasury_inflows_id_fk" FOREIGN KEY ("inflow_id") REFERENCES "public"."treasury_inflows"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kwota_accounts" ADD CONSTRAINT "kwota_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_kwota_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."kwota_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_requests" ADD CONSTRAINT "usage_requests_account_id_kwota_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."kwota_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_registries_uniq" ON "agent_registries" USING btree ("chain_id","address");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agents_uniq" ON "agents" USING btree ("registry_id","agent_token_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fee_alloc_uniq" ON "fee_allocations" USING btree ("inflow_id","bucket");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kwota_accounts_user" ON "kwota_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_account" ON "ledger_entries" USING btree ("account_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_idem" ON "ledger_entries" USING btree ("account_id","kind","ref_type","ref_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "param_versions_key_version" ON "param_versions" USING btree ("key","version");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "token_transfers_uniq" ON "token_transfers" USING btree ("chain_id","tx_hash","log_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "token_transfers_token_time" ON "token_transfers" USING btree ("token","block_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "token_transfers_block" ON "token_transfers" USING btree ("block_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "treasury_inflows_uniq" ON "treasury_inflows" USING btree ("chain_id","tx_hash","log_index","token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_account_time" ON "usage_requests" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_status" ON "usage_requests" USING btree ("status");