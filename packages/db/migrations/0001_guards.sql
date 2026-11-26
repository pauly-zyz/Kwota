-- Ledger and audit log are append-only: reject UPDATE / DELETE.
CREATE OR REPLACE FUNCTION kwota_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'table % is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER ledger_entries_append_only BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION kwota_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION kwota_reject_mutation();
--> statement-breakpoint
ALTER TABLE kwota_accounts ADD CONSTRAINT kwota_accounts_balance_ok
  CHECK (reserved_micro >= 0 AND balance_micro >= reserved_micro);
--> statement-breakpoint
ALTER TABLE agent_daily_usage ADD CONSTRAINT agent_daily_usage_ok
  CHECK (spent_micro >= 0 AND reserved_micro >= 0);
