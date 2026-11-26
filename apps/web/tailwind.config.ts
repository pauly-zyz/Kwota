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
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        flow: { "0%": { strokeDashoffset: "0" }, "100%": { strokeDashoffset: "-48" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        pulseGlow: { "0%,100%": { opacity: "0.55" }, "50%": { opacity: "1" } },
        sweep: { "0%": { transform: "rotate(-90deg)" }, "100%": { transform: "rotate(var(--angle))" } },
        shine: { "0%": { backgroundPosition: "200% 0" }, "100%": { backgroundPosition: "-200% 0" } },
        blink: { "0%,49%": { opacity: "1" }, "50%,100%": { opacity: "0" } },
        spinSlow: { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } },
      },
      animation: {
        tick: "tick 30s linear infinite",
        marquee: "marquee 40s linear infinite",
        flow: "flow 1.2s linear infinite",
        float: "float 6s ease-in-out infinite",
        pulseGlow: "pulseGlow 3s ease-in-out infinite",
        shine: "shine 6s linear infinite",
        blink: "blink 1s step-end infinite",
        spinSlow: "spinSlow 40s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
