import { defineChain } from "viem";

const OFFICIAL: Record<number, { rpc: string; explorer: string }> = {
  4663: { rpc: "https://rpc.mainnet.chain.robinhood.com", explorer: "https://robinhoodchain.blockscout.com" },
  46630: { rpc: "https://rpc.testnet.chain.robinhood.com", explorer: "https://explorer.testnet.chain.robinhood.com" },
};
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 46630);

const env = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export const config = {
  /** default: the API served by Vercel Functions on the same domain */
  apiUrl: env(process.env.NEXT_PUBLIC_API_URL)?.replace(/\/$/, "") ?? "/api",
  chainId: CHAIN_ID,
  rpcUrl: env(process.env.NEXT_PUBLIC_RPC_URL) ?? OFFICIAL[CHAIN_ID]?.rpc,
  explorerUrl: env(process.env.NEXT_PUBLIC_EXPLORER_URL) ?? OFFICIAL[CHAIN_ID]?.explorer,
  token: env(process.env.NEXT_PUBLIC_KWOTA_TOKEN_ADDRESS) as `0x${string}` | undefined,
  vault: env(process.env.NEXT_PUBLIC_VAULT_ADDRESS) as `0x${string}` | undefined,
  ant: "0xbbb6c29bcc3a1028a2b54310df73f4f7a3bcb373" as `0x${string}`,
  links: {
    pons: env(process.env.NEXT_PUBLIC_PONS_URL),
    dexscreener: env(process.env.NEXT_PUBLIC_DEXSCREENER_URL),
    x: env(process.env.NEXT_PUBLIC_X_URL),
  },
};

/**
 * Demo mode = the KWOTA API is not reachable/ready yet. Decided at runtime from
 * GET {apiUrl}/health (see ApiModeProvider). Live binding: importers always read
 * the current value; React components should use useDemo() to re-render.
 */
export let demoMode = true;
export function setDemoMode(v: boolean) {
  demoMode = v;
}

export const chain = defineChain({
  id: config.chainId,
  name: config.chainId === 4663 ? "Robinhood Chain" : "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: config.rpcUrl ? [config.rpcUrl] : [] } },
  blockExplorers: config.explorerUrl ? { default: { name: "Blockscout", url: config.explorerUrl } } : undefined,
  testnet: config.chainId !== 4663,
});

export const explorerTx = (h: string) => (config.explorerUrl ? `${config.explorerUrl}/tx/${h}` : undefined);
export const explorerAddr = (a: string) => (config.explorerUrl ? `${config.explorerUrl}/address/${a}` : undefined);
