import Link from "next/link";
import { Meter } from "@/components/Meter";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <Meter value={0} size={220} label="0" sub="kwota found here" />
      <h1 className="mt-6 text-2xl text-fog-100">Page not found</h1>
      <Link href="/" className="mt-6 rounded-full bg-volt px-5 py-2 text-ink">Back home</Link>
    </div>
  );
}
