import { AppTabs } from "@/components/Nav";
import { SignInGate } from "@/components/SignInGate";
import { DemoBanner } from "@/components/DemoBanner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <DemoBanner what="The app runs on simulated balances in your browser" />
      <AppTabs />
      <SignInGate>{children}</SignInGate>
    </div>
  );
}
