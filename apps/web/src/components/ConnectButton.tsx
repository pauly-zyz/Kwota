"use client";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useEffect, useState } from "react";
import { short } from "@/lib/format";
import { Button } from "./ui";

export function ConnectButton({ compact = false }: { compact?: boolean }) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return <Button variant="ghost" disabled>Connect</Button>;

  if (isConnected && address) {
    return (
      <Button variant="ghost" onClick={() => disconnect()} title="Disconnect">
        <span className="h-2 w-2 rounded-full bg-volt" />
        <span className="font-mono">{short(address)}</span>
      </Button>
    );
  }
  const list = connectors.filter((c, i, a) => a.findIndex((x) => x.name === c.name) === i);
  return (
    <div className="relative">
      <Button onClick={() => (list.length === 1 ? connect({ connector: list[0]! }) : setOpen((o) => !o))} disabled={isPending}>
        {isPending ? "Connecting…" : compact ? "Connect" : "Connect wallet"}
      </Button>
      {open && list.length > 1 && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-line bg-ink-800 p-1 shadow-xl">
          {list.map((c) => (
            <button
              key={c.uid}
              onClick={() => {
                setOpen(false);
                connect({ connector: c });
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-fog-100 hover:bg-ink-700"
            >
              {c.icon && <img src={c.icon} alt="" className="h-5 w-5" />}
              {c.name}
            </button>
          ))}
        </div>
      )}
      {error && <div className="absolute right-0 mt-2 w-64 text-right text-xs text-danger">{error.message.split("\n")[0]}</div>}
    </div>
  );
}
