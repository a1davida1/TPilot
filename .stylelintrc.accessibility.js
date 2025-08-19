module.exports = {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-prettier',
  ],
  plugins: [
    'stylelint-a11y',
    './client/src/lib/stylelint-rules/theme-compliance.js',
  ],
  rules: {
    // Accessibility rules
    'a11y/content-property-no-static-value': true,
    'a11y/font-size-is-readable': [true, { severity: 'warning' }],
    'a11y/line-height-is-vertical-rhythmed': [true, { severity: 'warning' }],
    'a11y/no-display-none': [true, { severity: 'warning' }],
    'a11y/no-obsolete-attribute': true,
    'a11y/no-obsolete-element': true,
    'a11y/no-text-align-justify': true,
    'a11y/selector-pseudo-class-focus': true,
    
    // Custom theme compliance rules
    'custom/theme-token-colors': true,
    'custom/ensure-contrast': [true, { severity: 'warning' }],
    
    // Color and contrast
    'color-hex-case': 'lower',
    'color-hex-length': 'short',
    'color-named': 'never',
    'color-no-invalid-hex': true,
    
    // Font and typography
    'font-family-name-quotes': 'always-where-recommended',
    'font-family-no-duplicate-names': true,
    'font-family-no-missing-generic-family-keyword': true,
    'font-weight-notation': 'numeric',
    
    // Units and values
    'length-zero-no-unit': true,
    'number-leading-zero': 'always',
    'number-no-trailing-zeros': true,
    'unit-case': 'lower',
    'unit-no-unknown': true,
    
    // Properties
    'property-case': 'lower',
    'property-no-unknown': true,
    'property-no-vendor-prefix': [
      true,
      {
        ignoreProperties: ['backdrop-filter', 'webkit-backdrop-filter'],
      },
    ],
    
    // Declaration blocks
    'declaration-block-no-duplicate-properties': [
      true,
      {
        ignore: ['consecutive-duplicates-with-different-values'],
      },
    ],
    'declaration-block-no-shorthand-property-overrides': true,
    'declaration-block-semicolon-newline-after': 'always',
    'declaration-block-semicolon-space-before': 'never',
    'declaration-block-trailing-semicolon': 'always',
    
    // Selectors
    'selector-class-pattern': [
      '^([a-z][a-z0-9]*)(-[a-z0-9]+)*$',
      {
        message: 'Expected class selector to be kebab-case',
      },
    ],
    'selector-max-id': 0,
    'selector-no-qualifying-type': [
      true,
      {
        ignore: ['attribute', 'class'],
      },
    ],
    'selector-pseudo-class-case': 'lower',
    'selector-pseudo-class-no-unknown': true,
    'selector-pseudo-element-case': 'lower',
    'selector-pseudo-element-no-unknown': true,
    'selector-type-case': 'lower',
    'selector-type-no-unknown': true,
    
    // Media queries
    'media-feature-name-case': 'lower',
    'media-feature-name-no-unknown': true,
    'media-feature-name-no-vendor-prefix': true,
    
    // At-rules
    'at-rule-case': 'lower',
    'at-rule-name-case': 'lower',
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['tailwind', 'apply', 'variants', 'responsive', 'screen', 'layer'],
      },
    ],
    'at-rule-no-vendor-prefix': true,
    
    // Comments
    'comment-empty-line-before': [
      'always',
      {
        except: ['first-nested'],
        ignore: ['stylelint-commands'],
      },
    ],
    'comment-whitespace-inside': 'always',
    
    // General
    'indentation': 2,
    'max-empty-lines': 2,
    'max-line-length': [
      120,
      {
        ignore: ['non-comments'],
      },
    ],
    'no-duplicate-selectors': true,
    'no-empty-source': true,
    'no-eol-whitespace': true,
    'no-extra-semicolons': true,
    'no-invalid-double-slash-comments': true,
    'no-missing-end-of-source-newline': true,
  },
  ignoreFiles: [
    'node_modules/**/*',
    'dist/**/*',
    'build/**/*',
  ],
};