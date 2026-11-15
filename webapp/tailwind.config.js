/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Playfair Display", "Georgia", "serif"],
      },
      colors: {
        ink: "#111111",
        paper: "#f5f6f8",
        line: "#e4e7ec",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(17, 17, 17, 0.08)",
      },
    },
  },
  plugins: [],
};