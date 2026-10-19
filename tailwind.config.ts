import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Motion language: short, ease-out, never blocking. Everything below is switched off by prefers-reduced-motion (globals.css).
      keyframes: {
        "slide-in-left": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-up": { from: { opacity: "0", transform: "translateY(14px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
        pop: { "0%": { opacity: "0", transform: "scale(0)" }, "70%": { transform: "scale(1.25)" }, "100%": { opacity: "1", transform: "scale(1)" } },
        "scale-x": { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        draw: { from: { strokeDashoffset: "1" }, to: { strokeDashoffset: "0" } },
        "pulse-ring": { "0%": { boxShadow: "0 0 0 0 rgba(220,38,38,0.55)" }, "100%": { boxShadow: "0 0 0 14px rgba(220,38,38,0)" } },
        float: { "0%,100%": { transform: "translate3d(0,0,0)" }, "50%": { transform: "translate3d(0,-24px,0)" } },
      },
      animation: {
        "slide-in-left": "slide-in-left 260ms cubic-bezier(0.22,1,0.36,1)",
        "fade-in": "fade-in 220ms ease-out",
        "fade-up": "fade-up 480ms cubic-bezier(0.22,1,0.36,1) backwards",
        "scale-in": "scale-in 260ms cubic-bezier(0.22,1,0.36,1) backwards",
        pop: "pop 420ms cubic-bezier(0.22,1,0.36,1) backwards",
        "scale-x": "scale-x 700ms cubic-bezier(0.22,1,0.36,1) backwards",
        shimmer: "shimmer 1.6s infinite",
        draw: "draw 1100ms cubic-bezier(0.65,0,0.35,1) forwards",
        "pulse-ring": "pulse-ring 1.4s ease-out infinite",
        float: "float 14s ease-in-out infinite",
      },
      boxShadow: {
        card: "0 1px 2px rgba(10,25,18,0.12), 0 8px 24px -8px rgba(10,25,18,0.35)",
        lift: "0 2px 4px rgba(10,25,18,0.14), 0 16px 32px -10px rgba(10,25,18,0.45)",
        glow: "0 0 0 1px rgba(110,231,183,0.25), 0 8px 30px -6px rgba(16,185,129,0.45)",
      },
      fontFamily: { sans: ["var(--font-inter)", "system-ui", "sans-serif"] },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Light Green Palette for Cards & Surfaces (#E2ECE5 replacing white)
        sage: {
          50: "#EEF5F0",
          100: "#E2ECE5", // Light green card/panel base
          200: "#CFDFD4",
          300: "#B8CEBF",
          400: "#99B5A5",
          500: "#7A9E8A",
          600: "#5B7F6D",
        },
        // Secondary & Canvas: Forest Green (#344E41, Canvas: #23382B)
        forest: {
          50: "#F0F5F2",
          100: "#DCE6E0",
          200: "#BCD0C4",
          300: "#95B3A1",
          400: "#699079",
          500: "#496B58",
          600: "#3D5A4A",
          700: "#344E41", // Major buttons, badges, highlights
          750: "#2D4438", // Deep contrast green for primary actions
          800: "#283C32",
          850: "#23382B", // Darker calmer green webpage canvas
          900: "#1D2D25",
          950: "#131E19",
        },
        // 10% Accent: Warm Gold (#E69F00)
        gold: {
          50: "#FEF9EE",
          100: "#FDF2DC",
          200: "#FBE3B6",
          300: "#F7D08A",
          400: "#F1B94C",
          500: "#E69F00", // Callouts, energy breaks, highlight accents
          600: "#C88600",
          700: "#9E6600",
          800: "#7A4D00",
          900: "#573500",
        },
        // Text: Dark Slate (#1F2933)
        darkslate: {
          50: "#F5F7FA",
          100: "#E4E7EB",
          200: "#CBD2D9",
          300: "#9AA5B1",
          400: "#7B8794",
          500: "#616E7C",
          600: "#52606D",
          700: "#3E4C59",
          800: "#323F4B",
          900: "#1F2933", // Body text
          950: "#121820",
        },
      },
    },
  },
  plugins: [],
};
export default config;
