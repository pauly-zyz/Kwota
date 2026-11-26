# KWOTA ($KWOTA)

> Your AI kwota, funded by every trade.

Protokol kredit inferensi AI di Robinhood Chain: fee trading $KWOTA → Pool Kwota → kwota pemakaian AI untuk holder dan agen ERC-8004 mereka.

## Isi repo

| Path | Isi |
|---|---|
| `apps/web` | Next.js (statis): landing, dApp (saldo, API key, agen, playground), transparansi, admin, docs |
| `apps/api` | Fastify: gateway `/v1` kompatibel OpenAI + metering, SIWE, API key, agen (ERC-8004 + EIP-712), indexer, mesin epoch, admin |
| `packages/core` | Logika murni: TWAB eksak, alokasi pro-rata, split fee, harga/metering, Merkle snapshot |
| `packages/db` | Skema Drizzle + migrasi (ledger & audit log append-only) |
| `packages/contracts` | Foundry: token tiruan khusus testnet |

## Mulai

```bash
pnpm install
docker compose up -d
pnpm test
```

Detail: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) · Arsitektur: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ·
Keputusan: [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md) · Sebelum mainnet: [`docs/MAINNET_CHECKLIST.md`](docs/MAINNET_CHECKLIST.md)

---

*Disclaimer: KWOTA adalah proyek independen dan tidak berafiliasi dengan, didukung, atau disponsori oleh Anthropic, PBC maupun Robinhood. ANT hanya dirujuk sebagai stock token pada pasangan perdagangan.*
