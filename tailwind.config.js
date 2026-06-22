/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18212f",
        cloud: "#f5f7fb",
        brand: {
          50: "#eef7ff",
          100: "#d9edff",
          500: "#1687ef",
          600: "#0870d2",
          700: "#0759aa"
        }
      },
      boxShadow: {
        panel: "0 12px 35px rgba(28, 46, 74, 0.08)"
      }
    }
  },
  plugins: []
};
