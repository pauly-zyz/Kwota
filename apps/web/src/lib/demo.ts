/** Dummy data shown when NEXT_PUBLIC_API_URL is not configured (pre-launch preview). */
const now = Math.floor(Date.now() / 1000);
const day = 86_400;
const epochStart = now - (now % day);

export const demoOverview = {
  updatedAt: new Date().toISOString(),
  feeSplit: { poolBps: 5000, vaultBps: 3000, opsBps: 2000 },
  feeInflows: [
    { token: "0xbbb6c29bcc3a1028a2b54310df73f4f7a3bcb373", total: "41250000000000000000", n: 1840 },
  ],
  bucketAllocations: [],
  pool: {
    creditedMicro: "18420000000", swaps: 14, distributedMicro: "15210000000", unallocatedMicro: "3210000000",
    consumedMicro: "9876000000", expiredMicro: "120000000", remainingFundsMicro: "8544000000", providerTopupsMicro: "12000000000",
  },
  kwota: { outstandingMicro: "5214000000", accountsWithBalance: 612, epochsPublished: 21, coverageBps: 16387 },
  usage: { requests: 184_220, tokens: "312480000" },
  holders: 1_487,
  vault: { address: null, antBalanceRaw: "12375000000000000000" },
  params: { epochSeconds: day, minHoldingRaw: "100000000000000000000000", minHoldingMode: "twab", distributeBps: 9000, expiryEpochs: 30 },
};

export const demoEpochs = Array.from({ length: 8 }, (_, i) => {
  const id = 22 - i;
  const start = epochStart - i * day;
  const budget = 700_000_000 + ((id * 7919) % 300) * 1_000_000;
  return {
    id, startTime: start, endTime: start + day, status: i === 0 ? "open" : "published",
    budgetMicro: i === 0 ? "0" : String(budget), distributedMicro: i === 0 ? "0" : String(budget - 37), dustOutMicro: "37",
    eligibleCount: i === 0 ? 0 : 540 + ((id * 31) % 90),
    merkleRoot: i === 0 ? null : `0x${((id * 2654435761) >>> 0).toString(16).padStart(8, "0").repeat(8)}`,
    snapshotSha256: null, onchainTx: null, publishedAt: null,
  };
});

export const demoModels = [
  { id: "openai/gpt-4o-mini", displayName: "GPT-4o mini", provider: "openrouter", contextLength: 128000, inputPriceMicroPerMTok: "150000", outputPriceMicroPerMTok: "600000", markupBps: 0 },
  { id: "google/gemini-2.0-flash", displayName: "Gemini 2.0 Flash", provider: "openrouter", contextLength: 1000000, inputPriceMicroPerMTok: "100000", outputPriceMicroPerMTok: "400000", markupBps: 0 },
  { id: "meta-llama/llama-3.3-70b", displayName: "Llama 3.3 70B", provider: "openrouter", contextLength: 131072, inputPriceMicroPerMTok: "100000", outputPriceMicroPerMTok: "320000", markupBps: 0 },
  { id: "deepseek/deepseek-chat", displayName: "DeepSeek V3", provider: "openrouter", contextLength: 64000, inputPriceMicroPerMTok: "320000", outputPriceMicroPerMTok: "1030000", markupBps: 0 },
  { id: "mistralai/mistral-small", displayName: "Mistral Small 3.1", provider: "openrouter", contextLength: 128000, inputPriceMicroPerMTok: "100000", outputPriceMicroPerMTok: "300000", markupBps: 0 },
];

export const demoSwaps = [
  { id: 3, bucket: "pool", txHash: "0x" + "3a".repeat(32), fromToken: "0xbbb6c29bcc3a1028a2b54310df73f4f7a3bcb373", fromAmount: "2100000000000000000", toToken: "usdg", toAmount: "1240000000", poolCreditMicro: "1240000000", createdAt: new Date(Date.now() - 3600e3).toISOString(), note: "Daily pool conversion" },
  { id: 2, bucket: "vault", txHash: "0x" + "2b".repeat(32), fromToken: null, fromAmount: null, toToken: "0xbbb6c29bcc3a1028a2b54310df73f4f7a3bcb373", toAmount: "1260000000000000000", poolCreditMicro: "0", createdAt: new Date(Date.now() - 7200e3).toISOString(), note: "Vault top-up" },
  { id: 1, bucket: "ops", txHash: "0x" + "1c".repeat(32), fromToken: null, fromAmount: null, toToken: "0xbbb6c29bcc3a1028a2b54310df73f4f7a3bcb373", toAmount: "840000000000000000", poolCreditMicro: "0", createdAt: new Date(Date.now() - 86400e3).toISOString(), note: null },
];
