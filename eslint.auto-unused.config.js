// Standalone config to safely auto-fix unused imports and guide param fixes.
// Use with: npm run fix:unused:imports or npm run lint:unused
import tseslint from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";

export default [
  // Ignore build artifacts & vendor
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/.vite/**",
      "**/*.min.*"
    ]
  },

  // Type-aware linting
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["client/src/**/*.{ts,tsx}", "server/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: process.cwd()
      }
    },
    plugins: { "unused-imports": unusedImports },
    rules: {
      // Prefer removing unused imports automatically
      "unused-imports/no-unused-imports": "error",

      // Report (but don't auto-remove) unused vars; allow underscore escape
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          vars: "all",
          args: "after-used",
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_"
        }
      ],

      // Secondary reporter that can suggest removal when safe
      "unused-imports/no-unused-vars": [
        "warn",
        { vars: "all", args: "after-used", varsIgnorePattern: "^_", argsIgnorePattern: "^_" }
      ]
    }
  },

  // Relax in tests to avoid churn on helpers/mocks
  {
    files: ["tests/**/*", "**/__tests__/**/*", "client/src/pages/**/__tests__/**/*"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "off",
      "unused-imports/no-unused-vars": "off"
    }
  }
];
