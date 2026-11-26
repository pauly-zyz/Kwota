"use client";
import { useCallback, useEffect, useState } from "react";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";
import { createSiweMessage } from "viem/siwe";
import { api, getToken, setToken } from "./api";
import { config } from "./config";

function decode(token: string | null): { address: string; exp: number } | null {
  if (!token?.startsWith("kws_")) return null;
  try {
    const p = JSON.parse(atob(token.slice(4).split(".")[0]!.replace(/-/g, "+").replace(/_/g, "/")));
    return p.exp * 1000 > Date.now() ? p : null;
  } catch {
    return null;
  }
}

/** SIWE session bound to the connected wallet. */
export function useSession() {
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

  const payload = decode(token);
  const signedIn = !!payload && !!address && payload.address === address.toLowerCase();

  const signIn = useCallback(async () => {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      if (chainId !== config.chainId) await switchChainAsync({ chainId: config.chainId }).catch(() => undefined);
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
  return { address, signedIn, signIn, signOut, busy, error };
}
