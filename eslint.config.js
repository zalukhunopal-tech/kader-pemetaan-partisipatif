import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * ESLint (flat config). Gaya penulisan diurus Prettier; ESLint hanya untuk galat dan pola berisiko:
 * aturan dasar JavaScript, typescript-eslint, dan aturan hooks React.
 */
export default tseslint.config(
  { ignores: ["dist", "dist-e2e", "dev-dist", "test-results", "playwright-report", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.flat.recommended.rules
  },
  {
    files: ["e2e/**/*.ts", "*.config.{ts,js}"],
    languageOptions: { globals: globals.node }
  }
);
