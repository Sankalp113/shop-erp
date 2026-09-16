import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "functions/**",
  ]),
  {
    rules: {
      // Firestore documents are inherently untyped — allow any for dynamic data
      "@typescript-eslint/no-explicit-any": "off",
      // Allow empty catch blocks for fire-and-forget Firebase ops
      "@typescript-eslint/no-empty-object-type": "off",
      // Allow unused vars prefixed with _
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      // Relax some React rules for rapid development
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);

export default eslintConfig;
