import { AppTabs } from "@/components/Nav";
import { SignInGate } from "@/components/SignInGate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <AppTabs />
      <SignInGate>{children}</SignInGate>
    </div>
  );
}
