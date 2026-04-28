/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070914",
        panel: "rgba(18, 24, 42, 0.72)",
        line: "rgba(255, 255, 255, 0.12)",
        neon: "#47f6c5",
        violet: "#a78bfa",
        rose: "#fb7185"
      },
      boxShadow: {
        glow: "0 0 42px rgba(71, 246, 197, 0.18)",
        card: "0 22px 80px rgba(0, 0, 0, 0.38)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
