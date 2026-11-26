# KWOTA — Pertanyaan Terbuka

Format: **[ID] Pertanyaan** — *usulan default saya* (dipakai bila Anda setuju / belum ada jawaban).
🔴 = memblokir milestone berikutnya, 🟡 = dibutuhkan sebelum milestone terkait, ⚪ = bisa diputuskan nanti.

## Fee & pool (Pons V2)
- 🔴 **[F1] Bagaimana mekanisme fee Pons V2?** Fee masuk ke treasury dalam token apa (ANT, $KWOTA, ETH, campuran)? Otomatis per trade atau harus di-*claim*? Apakah ada fase bonding curve sebelum pool DEX (alamat yang harus dikecualikan berbeda)? — *Saya butuh tautan dokumentasi Pons atau contoh tx fee di Blockscout.*
- 🟡 **[F2] Split fee final.** — *50% Pool / 30% Vault ANT / 20% Operasional.*
- 🟡 **[F3] Stablecoin untuk Pool:** USDG atau lainnya? Alamat resmi dari docs Robinhood Chain (saya tidak akan menebak). — *USDG; Anda konfirmasi alamatnya, atau izinkan saya mengambilnya dari docs.robinhood.com/chain di milestone 3.*
- 🟡 **[F4] Vault ANT berupa apa?** — *Safe multisig terpisah (bukan kontrak custom) — saldo ANT dibaca on-chain. Kontrak vault time-lock bisa fase 2.*
- 🟡 **[F5] Wallet terpisah untuk Pool / Vault / Ops**, atau semua tetap di treasury dan hanya dipisah di pembukuan? — *Wallet terpisah: lebih transparan dan mudah diverifikasi publik.*
- 🟡 **[F6] Bagaimana dana Pool sampai ke penyedia model** (bridge ke chain lain → top-up OpenRouter)? Siapa yang melakukan & seberapa sering? — *Manual oleh admin, setiap top-up dicatat dengan bukti di halaman transparansi.*
- ⚪ **[F7] Kelayakan hukum memegang stock token ANT** untuk wallet vault/treasury (pembatasan yurisdiksi stock token). — *Anda pastikan sebelum mainnet.*

## Epoch & kwota
- 🟡 **[E1] Durasi epoch.** — *24 jam, tutup pukul 00:00 UTC.*
- 🟡 **[E2] Minimum holding: angka final, dan diukur bagaimana?** — *TWAB selama epoch ≥ minimum (adil terhadap transfer kecil di tengah epoch). Alternatif: saldo tidak pernah turun di bawah minimum selama epoch (lebih ketat).*
- 🔴 **[E3] Berapa kwota yang dibagikan per epoch?** — *Anggaran = stablecoin Pool yang sudah terealisasi (swap terverifikasi) dan belum dialokasikan × 90%; 10% cadangan untuk selisih harga/biaya penyedia. Tidak ada kwota yang dicetak tanpa dana nyata.*
- 🟡 **[E4] Apakah kwota kedaluwarsa?** Tanpa kedaluwarsa, kewajiban tak terpakai menumpuk. — *Kedaluwarsa setelah 30 epoch; kwota kedaluwarsa kembali ke Pool (tercatat di ledger & transparansi).*
- ⚪ **[E5] Merkle root diposting on-chain?** — *MVP: publikasi off-chain (API + file snapshot + SHA-256). Opsional: admin memposting root via tx dari wallet sendiri (biaya gas kecil) mulai milestone 6.*
- ⚪ **[E6] Bonus loyalitas lintas epoch** (mis. multiplier untuk hold berturut-turut)? — *Tidak di MVP; rumus murni TWAB per epoch supaya sederhana & mudah diverifikasi.*
- ⚪ **[E7] Holder yang belum pernah login:** kwota tetap dikreditkan ke alamatnya (akun dibuat otomatis) dan bisa dipakai setelah SIWE. — *Ya.*

## Gateway & model
- 🟡 **[G1] Penyedia & daftar model awal.** — *OpenRouter; 5–8 model populer lintas vendor (harga rendah s/d premium).*
- 🟡 **[G2] Apakah model dari vendor Anthropic boleh ada di daftar?** Menyebut nama model secara faktual biasanya aman, tetapi berpotensi menimbulkan kesan afiliasi mengingat pair ANT. — *Boleh dicantumkan sebagai nama model saja (tanpa logo), dengan disclaimer.*
- 🟡 **[G3] Markup harga di atas harga penyedia.** — *0% di MVP (1 kwota = $1 harga penyedia), parameter `markup_bps` tetap tersedia.*
- 🟡 **[G4] Batas default:** maks. biaya per request, RPM per key/wallet. — *$0,50/request, 30 RPM per key, 60 RPM per wallet.*
- ⚪ **[G5] Endpoint tambahan** (embeddings, images)? — *Tidak di MVP; hanya chat completions + models.*

## Agen (ERC-8004)
- 🟡 **[A1] Alamat & ABI registry Agent Mint** (chain mana? testnet tersedia?), dan bagaimana *agent wallet* dicatat (metadata on-chain, registration file, atau = owner)? — *Adapter default mengikuti ERC-8004 Identity Registry (ERC-721).*
- 🟡 **[A2] Siapa yang boleh mengalokasikan ke agen?** — *Hanya `ownerOf(agentId)`.*
- ⚪ **[A3] Batas harian per hari UTC atau rolling 24 jam?** — *Hari UTC (lebih mudah dipahami & ditampilkan).*
- ⚪ **[A4] Batas jumlah agen per holder?** — *10.*

## Lainnya
- 🟡 **[O1] Alamat yang dibutuhkan:** kontrak $KWOTA (setelah launch), treasury, pool/vault/ops wallet, admin wallet(s), alamat LP pair. Untuk testnet: saya deploy token tiruan — setuju?
- 🟡 **[O2] RPC endpoint** testnet/mainnet: publik atau penyedia khusus?
- ⚪ **[O3] Domain & handle X.**
- ⚪ **[O4] Hosting:** — *Web di Vercel; API/indexer/worker + Postgres + Redis di Railway/Fly/VPS (proses long-running, jadi bukan serverless).*
- ⚪ **[O5] Bahasa UI:** — *Inggris sebagai default, dokumen internal bahasa Indonesia. Perlu dwibahasa?*
- ⚪ **[O6] Stack:** setuju Fastify + Drizzle (bukan Prisma)? Alasan ada di ARCHITECTURE.md §2.
