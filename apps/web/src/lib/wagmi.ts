import { createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { chain, config } from "./config";

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [injected()],
  transports: { [chain.id]: config.rpcUrl ? http(config.rpcUrl) : http() },
  ssr: false,
});
