module.exports = {
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  plugins: [
    'jsx-a11y',
    'react-hooks',
    'custom-accessibility',
  ],
  rules: {
    // Custom accessibility rules
    'custom-accessibility/no-hover-only-visibility': 'error',
    'custom-accessibility/require-accessible-colors': 'error',
    'custom-accessibility/require-test-ids': 'warn',
    
    // JSX a11y rules for enhanced accessibility
    'jsx-a11y/no-autofocus': 'warn',
    'jsx-a11y/click-events-have-key-events': 'error',
    'jsx-a11y/no-static-element-interactions': 'error',
    'jsx-a11y/anchor-is-valid': 'error',
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-proptypes': 'error',
    'jsx-a11y/aria-unsupported-elements': 'error',
    'jsx-a11y/role-has-required-aria-props': 'error',
    'jsx-a11y/role-supports-aria-props': 'error',
    'jsx-a11y/tabindex-no-positive': 'error',
    
    // Theme token enforcement
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Literal[value=/text-gray-\\d+/]',
        message: 'Use theme tokens (text-foreground, text-muted-foreground) instead of gray utilities.',
      },
      {
        selector: 'Literal[value=/bg-gray-\\d+/]',
        message: 'Use theme tokens (bg-background, bg-card) instead of gray utilities.',
      },
      {
        selector: 'Literal[value=/border-gray-\\d+/]',
        message: 'Use theme tokens (border-border) instead of gray utilities.',
      },
      {
        selector: 'Literal[value=/opacity-0.*hover:opacity/]',
        message: 'Avoid hover-only visibility patterns. Use .text-readable for permanent readability.',
      },
    ],
    
    // React hooks
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    
    // React specific
    'react/prop-types': 'off', // Using TypeScript
    'react/react-in-jsx-scope': 'off', // Not needed with new JSX transform
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
};