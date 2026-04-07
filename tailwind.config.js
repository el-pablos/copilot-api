/** @type {import('tailwindcss').Config} */
export default {
  content: ["./public/**/*.{html,js}", "./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        space: {
          50: "#f0f0f5",
          100: "#e0e0eb",
          200: "#c1c1d6",
          300: "#a2a2c2",
          400: "#8383ad",
          500: "#646499",
          600: "#4a4a7a",
          700: "#31315c",
          800: "#1e1e3f",
          900: "#0f0f1a",
          950: "#080810",
        },
        neon: {
          purple: "#a855f7",
          cyan: "#22d3ee",
          pink: "#ec4899",
          green: "#22c55e",
        },
      },
      animation: {
        fadeIn: "fadeIn 0.3s ease-out",
        slideUp: "slideUp 0.3s ease-out",
        "pulse-ring": "pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "1" },
          "100%": { transform: "scale(1.3)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
}
