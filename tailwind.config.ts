import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        amber: {
          950: "#2C1810",
          900: "#3D2417",
          800: "#5C3A24",
          700: "#8B5E3C",
          600: "#8B6F5C",
          500: "#C4956A",
          400: "#D4A574",
          300: "#E8C5A0",
          200: "#F2D9BC",
          100: "#F8EDD8",
          50:  "#FDF8F0",
        },
        cream: {
          DEFAULT: "#FAF3EA",
          dark: "#F5EDE6",
        },
      },
      fontFamily: {
        serif: ["Noto Serif SC", "Source Han Serif SC", "Georgia", "serif"],
        sans:  ["Noto Sans SC", "Source Han Sans SC", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm:  "0.375rem",
        md:  "0.75rem",
        lg:  "1.25rem",
        xl:  "2rem",
      },
      boxShadow: {
        "brand": "0 4px 24px rgba(139,111,92,0.15)",
        "brand-lg": "0 8px 40px rgba(139,111,92,0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
