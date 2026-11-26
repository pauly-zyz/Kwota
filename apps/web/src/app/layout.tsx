import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

const display = localFont({
  src: [
    { path: "../../node_modules/@fontsource/chakra-petch/files/chakra-petch-latin-500-normal.woff2", weight: "500" },
    { path: "../../node_modules/@fontsource/chakra-petch/files/chakra-petch-latin-600-normal.woff2", weight: "600" },
    { path: "../../node_modules/@fontsource/chakra-petch/files/chakra-petch-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KWOTA — Your AI kwota, funded by every trade",
  description: "Every $KWOTA trade funds a pool of AI inference credits. Holders and their ERC-8004 agents spend kwota on AI models — fully transparent, on Robinhood Chain.",
  icons: { icon: "/favicon.svg" },
  openGraph: { title: "KWOTA", description: "Your AI kwota, funded by every trade.", type: "website" },
};

export const viewport: Viewport = { themeColor: "#0B0D0C", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans">
        <Providers>
          <Nav />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
