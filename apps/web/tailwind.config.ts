import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0B0D0C", 900: "#0B0D0C", 800: "#111413", 700: "#171B19", 600: "#1F2421", 500: "#2A302C" },
        line: "#262B28",
        fog: { DEFAULT: "#9BA39E", 200: "#C9CFCB", 100: "#E7EBE8" },
        volt: { DEFAULT: "#C8F23A", 600: "#A9D11F", 900: "#2B3510" },
        amber: { DEFAULT: "#FFB547" },
        danger: "#FF6B5B",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      keyframes: {
        tick: { "0%": { transform: "translateY(0)" }, "100%": { transform: "translateY(-50%)" } },
        fill: { "0%": { strokeDashoffset: "var(--from)" }, "100%": { strokeDashoffset: "var(--to)" } },
      },
      animation: { tick: "tick 30s linear infinite" },
    },
  },
  plugins: [],
} satisfies Config;
