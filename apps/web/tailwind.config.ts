import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        paper: "#f4f1ea",
        brass: "#b88746",
        signal: "#d24726",
        slateblue: "#26364f"
      },
      fontFamily: {
        display: ["Georgia", "Times New Roman", "serif"],
        sans: ["Aptos", "Segoe UI", "sans-serif"]
      },
      boxShadow: {
        card: "0 18px 50px rgba(17, 24, 39, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
