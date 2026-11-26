"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { useSession } from "@/lib/session";
import { demoMode } from "@/lib/config";
import { ConnectButton } from "./ConnectButton";
import { Button, Card } from "./ui";
import { Meter } from "./Meter";

export function SignInGate({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const { isConnected } = useAccount();
  const { signedIn, signIn, busy, error } = useSession();
  if (!mounted) return null;

  if (demoMode) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <div className="flex justify-center"><Meter value={0.35} size={200} /></div>
        <h2 className="mt-2 text-xl font-medium text-fog-100">The app opens at launch</h2>
        <p className="mt-2 text-sm text-fog">
          This preview is running without the KWOTA API. Once $KWOTA is live and the API is connected, you can sign in with your wallet here to see
          your kwota, create API keys, fund agents and try the playground.
        </p>
      </Card>
    );
  }
  if (!isConnected) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <div className="flex justify-center"><Meter value={0} size={200} /></div>
        <h2 className="mt-2 text-xl font-medium text-fog-100">Connect your wallet</h2>
        <p className="mt-2 text-sm text-fog">Use the wallet that holds your $KWOTA on Robinhood Chain.</p>
        <div className="mt-5 flex justify-center"><ConnectButton /></div>
      </Card>
    );
  }
  if (!signedIn) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <div className="flex justify-center"><Meter value={0.5} size={200} /></div>
        <h2 className="mt-2 text-xl font-medium text-fog-100">Sign in with Ethereum</h2>
        <p className="mt-2 text-sm text-fog">Sign a free message to prove you own this wallet. No transaction, no gas.</p>
        <div className="mt-5 flex justify-center">
          <Button onClick={signIn} disabled={busy}>{busy ? "Waiting for signature…" : "Sign in"}</Button>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </Card>
    );
  }
  return <>{children}</>;
}
