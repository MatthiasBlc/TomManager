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
    themes: ["coffee", "winter"],
  },
};
