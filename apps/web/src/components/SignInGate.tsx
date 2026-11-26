"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { useSession } from "@/lib/session";
import { demoMode } from "@/lib/config";
import { ConnectButton } from "./ConnectButton";
import { Button, Card } from "./ui";
import { Meter } from "./Meter";

function DemoNote() {
  if (!demoMode) return null;
  return (
    <p className="mt-4 rounded-xl border border-amber/30 bg-amber/5 px-3 py-2 text-xs text-amber">
      Demo mode: balances, keys and agents are simulated in your browser. No transaction, no real kwota.
    </p>
  );
}

export function SignInGate({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const { isConnected } = useAccount();
  const { signedIn, signIn, tryAsGuest, busy, error } = useSession();
  if (!mounted) return null;
  if (signedIn) return <>{children}</>;

  if (!isConnected) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <div className="flex justify-center"><Meter value={0} size={200} /></div>
        <h2 className="mt-2 text-xl font-medium text-fog-100">Connect your wallet</h2>
        <p className="mt-2 text-sm text-fog">Use the wallet that holds your $KWOTA on Robinhood Chain.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <ConnectButton />
          {demoMode && <Button variant="ghost" onClick={tryAsGuest}>Try without a wallet</Button>}
        </div>
        <DemoNote />
      </Card>
    );
  }
  return (
    <Card className="mx-auto max-w-xl text-center">
      <div className="flex justify-center"><Meter value={0.5} size={200} /></div>
      <h2 className="mt-2 text-xl font-medium text-fog-100">Sign in with Ethereum</h2>
      <p className="mt-2 text-sm text-fog">Sign a free message to prove you own this wallet. No transaction, no gas.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={signIn} disabled={busy}>{busy ? "Waiting for signature…" : "Sign in"}</Button>
        {demoMode && <Button variant="ghost" onClick={tryAsGuest}>Skip — use demo account</Button>}
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <DemoNote />
    </Card>
  );
}
