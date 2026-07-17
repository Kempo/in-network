import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#EEF0FA",
        surface: "#FFFFFF",
        border: "#E5E7F2",
        primary: "#5468D4",
        "primary-hover": "#4759C0",
        ink: "#1E2233",
        muted: "#6B7280",
        user: "#DCE5FA",
        "user-border": "#B4C8F0",
        agent: "#DBEEDF",
        "agent-border": "#A9D8B4",
        accent: "#F76B5E",
      },
      borderRadius: { xl2: "16px" },
      boxShadow: {
        card: "0 1px 2px rgba(30,34,51,0.04), 0 4px 16px rgba(30,34,51,0.05)",
        bar: "0 1px 0 rgba(30,34,51,0.06)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
