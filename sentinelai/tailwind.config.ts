// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // SentinelAI Custom Colors
        cyber: {
          cyan: "#00f5ff",
          purple: "#b347ea",
          emerald: "#00ff88",
          red: "#ff3366",
          orange: "#ff6b35",
          yellow: "#ffd700",
          blue: "#0066ff",
        },
        sentinel: {
          900: "#020408",
          800: "#060d14",
          700: "#0a1628",
          600: "#0f2040",
          500: "#162d54",
          400: "#1e3a68",
          300: "#2a4f8a",
          200: "#3a6db5",
          100: "#5a8fd0",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "var(--font-jetbrains-mono)", "monospace"],
      },
      backgroundImage: {
        "cyber-grid":
          "linear-gradient(rgba(0, 245, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 245, 255, 0.03) 1px, transparent 1px)",
        "sentinel-gradient":
          "linear-gradient(135deg, #020408 0%, #060d14 50%, #0a1628 100%)",
        "glow-cyan":
          "radial-gradient(ellipse at center, rgba(0, 245, 255, 0.15) 0%, transparent 70%)",
        "glow-purple":
          "radial-gradient(ellipse at center, rgba(179, 71, 234, 0.15) 0%, transparent 70%)",
        "card-gradient":
          "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
      },
      backgroundSize: {
        "cyber-grid": "50px 50px",
      },
      boxShadow: {
        "cyber-cyan":
          "0 0 20px rgba(0, 245, 255, 0.3), 0 0 60px rgba(0, 245, 255, 0.1)",
        "cyber-purple":
          "0 0 20px rgba(179, 71, 234, 0.3), 0 0 60px rgba(179, 71, 234, 0.1)",
        "cyber-emerald":
          "0 0 20px rgba(0, 255, 136, 0.3), 0 0 60px rgba(0, 255, 136, 0.1)",
        "cyber-red":
          "0 0 20px rgba(255, 51, 102, 0.3), 0 0 60px rgba(255, 51, 102, 0.1)",
        glass:
          "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        "card-hover":
          "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 245, 255, 0.1)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "scan-line": "scanLine 3s linear infinite",
        typewriter: "typewriter 3s steps(40) 1s forwards",
        "fade-in": "fadeIn 0.5s ease-in-out forwards",
        "slide-up": "slideUp 0.4s ease-out forwards",
        "slide-in-right": "slideInRight 0.3s ease-out forwards",
        float: "float 6s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        glowPulse: {
          "0%, 100%": { opacity: "1", filter: "brightness(1)" },
          "50%": { opacity: "0.7", filter: "brightness(1.5)" },
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        typewriter: {
          from: { width: "0" },
          to: { width: "100%" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;