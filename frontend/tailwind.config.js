/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const plugin = require("tailwindcss/plugin");

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "slide-up": "slide-up 250ms ease-out",
        "fade-in": "fade-in 200ms ease-out",
      },
    },
  },
  plugins: [
    require("daisyui"),
    plugin(function ({ addVariant }) {
      // pointer-fine: mouse/trackpad (desktop)
      addVariant("pointer-fine", "@media (pointer: fine)");
      // pointer-coarse: touch screen (mobile/tablet)
      addVariant("pointer-coarse", "@media (pointer: coarse)");
    }),
  ],
  daisyui: {
    themes: [
      {
        ToM: {
          "color-scheme": "dark",
          primary: "oklch(74.722% 0.072 131.116)",
          "primary-content": "oklch(13.454% 0.033 35.791)",
          secondary: "oklch(86.19% 0.047 102.15)",
          "secondary-content": "oklch(12.818% 0.005 229.389)",
          accent: "oklch(79% 0.076 298.300)",
          "accent-content": "oklch(13.454% 0.033 35.791)",
          neutral: "oklch(30.1% 0 253.041)",
          "neutral-content": "oklch(85.5% 0 253.041)",
          "base-100": "oklch(25.7% 0 0)",
          "base-200": "oklch(22.648% 0 0)",
          "base-300": "oklch(20.944% 0 0)",
          "base-content": "oklch(84.87% 0 0)",
          info: "oklch(86.19% 0.047 224.14)",
          "info-content": "oklch(12.523% 0.028 240.033)",
          success: "oklch(74.722% 0.072 131.116)",
          "success-content": "oklch(14.045% 0.018 156.596)",
          warning: "oklch(88.15% 0.14 87.722)",
          "warning-content": "oklch(15.496% 0.023 81.519)",
          error: "oklch(65.72% 0.199 27.33)",
          "error-content": "oklch(12.523% 0.028 240.033)",
          "--rounded-box": "1rem",
          "--rounded-btn": "1rem",
          "--rounded-badge": "2rem",
          "--border-btn": "1px",
        },
      },
      "winter",
    ],
  },
};
