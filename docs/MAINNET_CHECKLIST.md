# Checklist sebelum mainnet

## Keputusan (lihat OPEN_QUESTIONS.md)
- [ ] Split fee final (default 50/30/20) — set via Admin → Parameters
- [ ] Minimum holding + mode (TWAB / never-below) — default 0 / TWAB
- [ ] Durasi epoch (default 24 jam), anggaran per epoch (default 90%), kedaluwarsa (default 30 epoch)
- [ ] Daftar model + harga final (cek harga live penyedia; seed hanya placeholder)
- [ ] Syarat penyedia model mengizinkan pemakaian ini (reseller/proxy kredit)
- [ ] Status hukum memegang ANT (stock token) di vault/treasury untuk yurisdiksi Anda
- [ ] Apakah model vendor Anthropic dicantumkan (nama saja, tanpa logo)

## Alamat & config (production)
- [ ] `CHAIN_ID=4663`, `RPC_URL` & explorer dari dokumentasi resmi
- [ ] CA $KWOTA setelah launch di Pons, blok deploy → `INDEXER_START_BLOCK`
- [ ] `TREASURY_ADDRESS` = wallet dev penerima fee; `POOL/VAULT/OPS` (disarankan Safe multisig)
- [ ] `LP_PAIR_ADDRESSES` (pair KWOTA/ANT di Pons) + kontrak Pons/router di `PROTOCOL_ADDRESSES`
- [ ] Alamat USDG resmi → `STABLE_TOKEN_ADDRESSES`; `TRACKED_FEE_TOKENS` sesuai token fee yang masuk
- [ ] Registry ERC-8004 Agent Mint → Admin → Registries (atau `AGENT_REGISTRY_ADDRESS` + seed)
- [ ] `ADMIN_ADDRESSES` = wallet admin Anda (bukan wallet panas server)
- [ ] `EPOCH_GENESIS_TIME` diumumkan; `AUTO_PUBLISH_EPOCHS` (disarankan `false` di minggu-minggu awal)

## Keamanan
- [ ] `SESSION_SECRET` acak, `NODE_ENV=production`, `REDIS_URL` aktif
- [ ] `OPENROUTER_API_KEY` hanya di secret manager hosting; batas belanja diset di dashboard penyedia
- [ ] `CORS_ORIGINS` hanya domain resmi
- [ ] Backup Postgres harian + uji restore
- [ ] Alarm: worker log "LEDGER MISMATCH", indexer berhenti maju, coverage < 100%
- [ ] Review kode independen untuk gateway/ledger; pertimbangkan audit sebelum fase 2 (kontrak)

## Uji akhir
- [ ] `pnpm test` hijau di CI
- [ ] Simulasi penuh di testnet (lihat DEPLOYMENT.md §4) termasuk agen EIP-712 & tombol stop
- [ ] `verify-epoch --rpc` cocok untuk minimal 3 epoch testnet
- [ ] Load test ringan gateway (rate limit & reservasi konkuren)
- [ ] Disclaimer non-afiliasi tampil di footer (sudah) dan di materi X/Pons
