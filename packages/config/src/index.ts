import { defineChain, type Chain } from "viem";

/**
 * Robinhood Chain definitions. Only values given in the project brief are
 * defaulted (chain IDs, mainnet explorer, ANT address). RPC URLs and every other
 * address MUST come from env/config — never guessed.
 */
export const ROBINHOOD_MAINNET_ID = 4663;
export const ROBINHOOD_TESTNET_ID = 46630;

/** ANT (stock token) — from the project brief. */
export const ANT_ADDRESS = "0xbbb6c29bcc3a1028a2b54310df73f4f7a3bcb373" as const;

export function robinhoodChain(opts: {
  chainId: number;
  rpcUrl: string;
  explorerUrl?: string;
}): Chain {
  const mainnet = opts.chainId === ROBINHOOD_MAINNET_ID;
  const explorer =
    opts.explorerUrl || (mainnet ? "https://robinhoodchain.blockscout.com" : undefined);
  return defineChain({
    id: opts.chainId,
    name: mainnet ? "Robinhood Chain" : "Robinhood Chain Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: opts.rpcUrl ? [opts.rpcUrl] : [] } },
    blockExplorers: explorer ? { default: { name: "Blockscout", url: explorer } } : undefined,
    testnet: !mainnet,
  });
}

export function explorerTx(explorer: string | undefined, hash: string) {
  return explorer ? `${explorer.replace(/\/$/, "")}/tx/${hash}` : undefined;
}
export function explorerAddress(explorer: string | undefined, addr: string) {
  return explorer ? `${explorer.replace(/\/$/, "")}/address/${addr}` : undefined;
}

export const isAddress = (v: string | undefined): v is `0x${string}` =>
  !!v && /^0x[0-9a-fA-F]{40}$/.test(v);
