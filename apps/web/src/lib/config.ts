import { defineChain } from "viem";

const env = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export const config = {
  apiUrl: env(process.env.NEXT_PUBLIC_API_URL)?.replace(/\/$/, ""),
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 46630),
  rpcUrl: env(process.env.NEXT_PUBLIC_RPC_URL),
  explorerUrl:
    env(process.env.NEXT_PUBLIC_EXPLORER_URL) ??
    (Number(process.env.NEXT_PUBLIC_CHAIN_ID || 46630) === 4663 ? "https://robinhoodchain.blockscout.com" : undefined),
  token: env(process.env.NEXT_PUBLIC_KWOTA_TOKEN_ADDRESS) as `0x${string}` | undefined,
  vault: env(process.env.NEXT_PUBLIC_VAULT_ADDRESS) as `0x${string}` | undefined,
  ant: "0xbbb6c29bcc3a1028a2b54310df73f4f7a3bcb373" as `0x${string}`,
  links: {
    pons: env(process.env.NEXT_PUBLIC_PONS_URL),
    dexscreener: env(process.env.NEXT_PUBLIC_DEXSCREENER_URL),
    x: env(process.env.NEXT_PUBLIC_X_URL),
  },
};

export const demoMode = !config.apiUrl;

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
