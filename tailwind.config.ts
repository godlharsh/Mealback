import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#0F3D2E",
          primary: "#1F7A4D",
          yellow: "#F6C945",
          mint: "#EAF5EE",
          coral: "#E8704A",
          ink: "#14281F",
          muted: "#5C6B63",
          light: "#F4FAF6",
        },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "sans-serif"],
      },
      boxShadow: {
        soft: "0 4px 20px -2px rgba(15, 61, 46, 0.08)",
        card: "0 8px 30px -4px rgba(15, 61, 46, 0.1)",
        ticket: "0 10px 30px -5px rgba(15, 61, 46, 0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
