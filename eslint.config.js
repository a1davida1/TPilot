import globals from 'globals';
import tseslintPlugin from '@typescript-eslint/eslint-plugin';
import tseslintParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  console: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  fetch: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  Headers: 'readonly',
  FormData: 'readonly',
  File: 'readonly',
  Blob: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  Image: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  queueMicrotask: 'readonly',
  Crypto: 'readonly',
  crypto: 'readonly',
  performance: 'readonly',
};

const es2020Globals = {
  globalThis: 'readonly',
  BigInt: 'readonly',
  BigInt64Array: 'readonly',
  BigUint64Array: 'readonly',
  Atomics: 'readonly',
  SharedArrayBuffer: 'readonly',
  WeakRef: 'readonly',
  FinalizationRegistry: 'readonly',
  Intl: 'readonly',
};

const nodeGlobals = {
  module: 'readonly',
  require: 'readonly',
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  exports: 'readonly',
  Buffer: 'readonly',
  console: 'readonly',
  global: 'readonly',
  setTimeout: 'readonly',
  setInterval: 'readonly',
  clearTimeout: 'readonly',
  clearInterval: 'readonly',
  setImmediate: 'readonly',
  clearImmediate: 'readonly',
};

export default [
  {
    ignores: [
      'node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.min.js',
      '**/*.min.css',
      '**/vendor/**',
      '**/.cache/**',
      '**/public/build/**',
      'client/dist/**',
      '**/attached_assets/**',
      'assistant-last40-unified/**',
      'unified-tasks-snapshot/**',
      '**/tmp/**',
      'browser-extension/**',
      '*.accessibility.js',
      'client/src/lib/eslint-rules/**',
      'client/src/lib/stylelint-rules/**',
      'production-server.js',
      'production-start.js',
      'scripts/**',
      'assistant-last40-unified/**',
      'unified-tasks-snapshot/**',
      'logs/**',
      '*.log',
      '*.md',
      '*.txt',
      'bundle-report.html',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parser: tseslintParser,
      globals: {
        ...browserGlobals,
        ...es2020Globals,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tseslintPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-namespace': 'warn',
      'no-case-declarations': 'warn',
      'no-prototype-builtins': 'warn',
      'no-useless-escape': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...nodeGlobals,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
  {
    files: ['server/**/*.{js,ts}', 'scripts/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        ...nodeGlobals,
      },
    },
  },
  {
    files: ['tests/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        ...nodeGlobals,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
  {
    files: ['*.config.{js,ts}', 'server/start-production.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['vite.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];