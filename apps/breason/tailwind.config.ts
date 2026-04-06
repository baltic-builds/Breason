import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#7C3AED", // Забота
          blue: "#0EA5E9",   // Доверие
          metal: "#475569",  // Надежность
          white: "#FFFFFF",  // Творчество
          orange: "#F97316", // Оптимизм
          lime: "#84CC16",   // Энергия
        },
      },
    },
  },
  plugins: [],
};
export default config;
