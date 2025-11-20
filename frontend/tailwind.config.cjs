/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-dark": "#050816",
        "bg-card": "#0f172a",
        "accent": "#38bdf8",
        "accent-soft": "#0ea5e9",
      },
      boxShadow: {
        "soft-xl": "0 20px 40px rgba(15,23,42,0.5)",
      },
    },
  },
  plugins: [],
};
