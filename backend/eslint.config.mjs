import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Scripts CLI : console.log autorise
    files: ["src/scripts/**", "prisma/**"],
    rules: {
      "no-console": "off",
    },
  },
  {
    ignores: ["dist/"],
  },
];
