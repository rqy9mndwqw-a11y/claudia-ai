import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0E0E14",
        accent: "#E8295B",
        coral: "#D4614A",
        surface: "#16161F",
        "surface-light": "#1E1E2A",
        agent: {
          token: "#3b82f6",
          chart: "#22c55e",
          risk: "#a855f7",
          claudia: "#ec4899",
        },
      },
      boxShadow: {
        "glow-token": "0 0 12px rgba(59, 130, 246, 0.4)",
        "glow-chart": "0 0 12px rgba(34, 197, 94, 0.4)",
        "glow-risk": "0 0 12px rgba(168, 85, 247, 0.4)",
        "glow-claudia": "0 0 12px rgba(236, 72, 153, 0.4)",
      },
      fontFamily: {
        heading: ["Syne", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 5px rgba(236, 72, 153, 0.2)" },
          "50%": { boxShadow: "0 0 20px rgba(236, 72, 153, 0.5)" },
        },
        "glow-pulse-amber": {
          "0%, 100%": { boxShadow: "0 0 5px rgba(245, 158, 11, 0.2)" },
          "50%": { boxShadow: "0 0 20px rgba(245, 158, 11, 0.5)" },
        },
        "gold-shimmer": {
          "0%, 100%": { opacity: "0.8", filter: "drop-shadow(0 0 2px rgba(245, 158, 11, 0.5))" },
          "50%": { opacity: "1", filter: "drop-shadow(0 0 12px rgba(245, 158, 11, 0.8))" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "1", filter: "drop-shadow(0 0 10px rgba(232, 41, 91, 0.4))" },
          "50%": { opacity: "0.85", filter: "drop-shadow(0 0 24px rgba(232, 41, 91, 0.7))" },
        },
        "cursor-blink": {
          "from, to": { opacity: "0" },
          "50%": { opacity: "1" },
        },
        "stat-glow": {
          "0%, 100%": { textShadow: "0 0 4px rgba(232, 41, 91, 0.0)" },
          "50%": { textShadow: "0 0 12px rgba(232, 41, 91, 0.4)" },
        },
      },
      animation: {
        "glow-pink": "glow-pulse 3s ease-in-out infinite",
        "glow-amber": "glow-pulse-amber 3s ease-in-out infinite",
        "burn-gold": "gold-shimmer 2s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2.5s ease-in-out infinite",
        "cursor-blink": "cursor-blink 1s step-end infinite",
        "stat-glow": "stat-glow 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
