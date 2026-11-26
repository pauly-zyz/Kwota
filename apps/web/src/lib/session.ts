"use client";
import { useCallback, useEffect, useState } from "react";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";
import { createSiweMessage } from "viem/siwe";
import { api, demoToken, getToken, setToken, tokenAddress } from "./api";
import { config } from "./config";
import { useDemo } from "./apiMode";

/** Address used for "try without a wallet" in demo mode. */
export const DEMO_GUEST = "0xdead00000000000000000000000000000000beef";

/** SIWE session bound to the connected wallet. */
export function useSession() {
  const demoMode = useDemo();
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const [token, setTok] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setTok(getToken());
    sync();
    window.addEventListener("kwota-session", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("kwota-session", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const tokenAddr = tokenAddress(token);
  const guest = demoMode && tokenAddr === DEMO_GUEST;
  const signedIn = !!tokenAddr && (guest || (!!address && tokenAddr === address.toLowerCase()));

  const signIn = useCallback(async () => {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      if (chainId !== config.chainId) await switchChainAsync({ chainId: config.chainId }).catch(() => undefined);
      if (demoMode) {
        // same wallet UX (free signature), but verified nowhere: demo state stays in this browser
        await signMessageAsync({ message: `Sign in to the KWOTA demo.\n\nAddress: ${address}\nNo transaction, no gas, no real kwota.\nIssued: ${new Date().toISOString()}` });
        setToken(demoToken(address));
        return;
      }
      const { nonce } = await api<{ nonce: string }>("/auth/nonce", { auth: false });
      const message = createSiweMessage({
        address, chainId: config.chainId, domain: window.location.host, nonce, uri: window.location.origin, version: "1",
        statement: "Sign in to KWOTA. This does not send a transaction or cost gas.", issuedAt: new Date(),
        expirationTime: new Date(Date.now() + 10 * 60_000),
      });
      const signature = await signMessageAsync({ message });
      const res = await api<{ token: string }>("/auth/verify", { method: "POST", json: { message, signature }, auth: false });
      setToken(res.token);
    } catch (e) {
      setError((e as Error).message.split("\n")[0] ?? "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }, [address, chainId, signMessageAsync, switchChainAsync]);

  const signOut = useCallback(() => setToken(null), []);
  const tryAsGuest = useCallback(() => setToken(demoToken(DEMO_GUEST)), []);
  return { address: guest ? (DEMO_GUEST as `0x${string}`) : address, signedIn, signIn, signOut, tryAsGuest, guest, busy, error };
}
