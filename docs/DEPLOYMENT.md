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

## 3. Backend di Vercel (project yang sama — disarankan)

API ikut ter-deploy sebagai Vercel Function di `/api` (file `api/index.js`, hasil bundle `apps/api/src/vercel.ts`).
Web otomatis memakai `/api` dan keluar dari mode demo begitu `GET /api/health` → `ready: true`.

Yang perlu ada di project Vercel:
1. **Database**: Storage → Create Database → Neon (Postgres) → Connect ke project ini (mengisi `DATABASE_URL`/`POSTGRES_URL`).
2. **Env** `PROVIDER_API_KEY` = key penyedia model (Production). Opsional: `ADMIN_ADDRESSES`, `CRON_SECRET`, `KWOTA_TOKEN_ADDRESS`, `TREASURY_ADDRESS`.
3. Redeploy. Migrasi, `SESSION_SECRET` (disimpan di DB), dan impor model berjalan otomatis saat start pertama.

Cron harian (`/api/cron`) menjalankan epoch, membersihkan reservasi macet, dan satu putaran indexer. Di plan Hobby cron
hanya 1×/hari — untuk indexer real-time setelah launch pakai plan Pro atau hosting proses panjang (3a/3b).
Setelah mengubah kode API, jalankan `pnpm --filter @kwota/api bundle:vercel` dan commit `api/index.js` (dicek di CI).

## 3a. Backend sekali klik (Render)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/pauly-zyz/Kwota)

`render.yaml` membuat: Postgres, Redis (Key Value) dan satu web service `kwota-api` (Docker) yang menjalankan API + indexer + worker
dalam satu proses (`RUN_INDEXER`, `RUN_WORKER`), migrasi dan seed model otomatis (`AUTO_SEED`).

1. Login Render dengan GitHub, beri akses ke repo, klik tombol di atas.
2. Isi secret yang diminta: `PROVIDER_API_KEY` (key penyedia model), `ADMIN_ADDRESSES` (wallet admin Anda). `KWOTA_TOKEN_ADDRESS` / `TREASURY_ADDRESS` boleh kosong sampai launch.
3. Setelah live, buka `https://<nama-service>.onrender.com/health` → `{"ok":true}`.
4. Di Vercel set `NEXT_PUBLIC_API_URL=https://<nama-service>.onrender.com` lalu redeploy. App otomatis keluar dari mode demo.
5. Admin → "Credit tester kwota" untuk memberi saldo uji ke wallet (testnet).

Catatan: plan free Render tidur setelah 15 menit tanpa trafik (request pertama lambat) dan Postgres free kedaluwarsa setelah 30 hari —
pindah ke plan berbayar sebelum launch. `CORS_ORIGINS` default `https://kwota*.vercel.app`; ganti dengan domain persis Anda.

## 3b. API + indexer + worker (hosting lain)

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
