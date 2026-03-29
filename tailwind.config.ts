import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "bg-mcm-primary", "bg-mcm-dark", "bg-mcm-light",
    "bg-mcm-gray", "bg-mcm-card",
    "text-mcm-primary", "text-mcm-dark", "text-mcm-light",
    "text-mcm-text", "text-mcm-muted",
    "border-mcm-primary", "border-mcm-border",
    "ring-mcm-primary",
    "hover:bg-mcm-primary", "hover:bg-mcm-dark",
    "focus:ring-mcm-primary",
  ],
  theme: {
    extend: {
      colors: {
        mcm: {
          primary:  "#a93526",
          dark:     "#8a2b1f",
          light:    "#c45648",
          gray:     "#f8f5f5",
          card:     "#ffffff",
          text:     "#1e293b",
          muted:    "#64748b",
          border:   "#e2e8f0",
        },
      },
    },
  },
  plugins: [],
};
export default config;
