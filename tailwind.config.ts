import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
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
