# KWOTA — Menjalankan & Deploy

## 1. Lokal (5 menit)

Prasyarat: Node 22, pnpm 10, Docker (atau Postgres 16 + Redis lokal).

```bash
pnpm install
docker compose up -d                       # Postgres + Redis
cp .env.example apps/api/.env              # isi seperlunya; default = mode mock
cd apps/api && set -a && . ./.env && set +a
pnpm seed                                  # migrasi + model default + registry (opsional)
pnpm dev                                   # API di http://localhost:8787
```

Di terminal lain:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8787 pnpm --filter @kwota/web dev   # http://localhost:3000
pnpm --filter @kwota/api indexer           # butuh RPC_URL + KWOTA_TOKEN_ADDRESS
pnpm --filter @kwota/api worker            # epoch, release reservasi macet, rekonsiliasi ledger
```

Test:

```bash
pnpm test                                  # 30 unit (core) + 47 integrasi (api, butuh Postgres: TEST_DATABASE_URL)
pnpm typecheck
cd packages/contracts && forge test        # kontrak token tiruan testnet
```

`MODEL_PROVIDER=mock` menjalankan gateway tanpa penyedia (balasan echo, token tetap dimeter) — cocok untuk demo/testing.

## 2. Web → Vercel

Repo sudah punya `vercel.json` di root (build `@kwota/web`, output statis `apps/web/out`).

- **Root Directory** project Vercel: biarkan kosong (root repo). Jika diset ke `apps/web`, build juga tetap jalan (Next.js terdeteksi otomatis).
- Tanpa env apa pun situs tampil dalam **Preview mode** (data dummy di halaman transparansi, dApp menampilkan "opens at launch").
- Setelah API online, set di Vercel → Settings → Environment Variables lalu redeploy:

| Variabel | Contoh |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.kwota.xyz` |
| `NEXT_PUBLIC_CHAIN_ID` | `46630` (testnet) / `4663` (mainnet) |
| `NEXT_PUBLIC_RPC_URL` | opsional — default RPC publik resmi (rate-limited); isi endpoint provider untuk production |
| `NEXT_PUBLIC_EXPLORER_URL` | opsional — default explorer resmi sesuai chain |
| `NEXT_PUBLIC_KWOTA_TOKEN_ADDRESS` | CA $KWOTA |
| `NEXT_PUBLIC_VAULT_ADDRESS` | wallet/Safe vault ANT |
| `NEXT_PUBLIC_PONS_URL`, `NEXT_PUBLIC_DEXSCREENER_URL`, `NEXT_PUBLIC_X_URL` | tautan |

## 3. API + indexer + worker

Proses long-running (bukan serverless). Satu image Docker (`Dockerfile`), tiga perintah:

| Proses | Perintah |
|---|---|
| API | default (`pnpm --filter @kwota/api start`, migrasi otomatis) |
| Indexer | `pnpm --filter @kwota/api indexer` |
| Worker | `pnpm --filter @kwota/api worker` |

Bisa di Railway / Fly.io / Render / VPS + Postgres terkelola + Redis terkelola. Wajib di production:
`NODE_ENV=production`, `SESSION_SECRET` (acak ≥ 32 char), `DATABASE_URL`, `REDIS_URL` (wajib bila API > 1 instance), `CORS_ORIGINS` = domain web
(juga dipakai sebagai domain SIWE), `RPC_URL`, alamat-alamat, `ADMIN_ADDRESSES`, dan `OPENROUTER_API_KEY` (hanya di env server).

## 4. Testnet end-to-end (sebelum launch)

1. Deploy token tiruan: `cd packages/contracts && MOCK_INITIAL_HOLDER=0x… forge script script/DeployMock.s.sol --rpc-url $RPC_URL --broadcast --interactives 1`.
2. Isi `KWOTA_TOKEN_ADDRESS`, `TREASURY_ADDRESS` (wallet dev), `POOL/VAULT/OPS`, `INDEXER_START_BLOCK` (blok deploy), `EPOCH_GENESIS_TIME`.
3. Jalankan API + indexer + worker; transfer token tiruan ke beberapa wallet.
4. Kirim stablecoin testnet dari wallet dev ke pool wallet → catat di Admin → "Record swap".
5. Tunggu epoch tutup → Admin → Compute → Publish → cek halaman transparansi, `/public/epochs/1/snapshot`, dan `verify-epoch`.
