/**
 * Custom Stylelint rules to enforce theme token usage and prevent accessibility issues
 */

const stylelint = require('stylelint');

const ruleName = 'custom/theme-token-colors';
const messages = stylelint.utils.ruleMessages(ruleName, {
  expected: 'Use theme tokens instead of hardcoded colors for accessibility compliance',
  hoverOnly: 'Avoid hover-only color changes that harm accessibility',
});

const rule = (primaryOption) => {
  return (root, result) => {
    const validOptions = stylelint.utils.validateOptions(result, ruleName, {
      actual: primaryOption,
      possible: [true, false],
    });

    if (!validOptions) {
      return;
    }

    // Patterns to detect hardcoded colors
    const colorPatterns = [
      /#[0-9a-fA-F]{3,8}/,  // Hex colors
      /rgb\(/,               // RGB colors
      /rgba\(/,              // RGBA colors
      /hsl\(/,               // HSL colors (not using var())
      /hsla\(/,              // HSLA colors
    ];

    // Allowed theme token patterns
    const allowedPatterns = [
      /hsl\(var\(--[^)]+\)\)/,  // HSL with CSS variables
      /var\(--[^)]+\)/,         // Direct CSS variables
      /currentColor/,           // Current color
      /inherit/,                // Inherited color
      /transparent/,            // Transparent
    ];

    root.walkDecls((decl) => {
      if (decl.prop === 'color' || decl.prop === 'background-color' || decl.prop === 'border-color') {
        const value = decl.value;
        
        // Skip if it's an allowed pattern
        if (allowedPatterns.some(pattern => pattern.test(value))) {
          return;
        }
        
        // Check for hardcoded colors
        if (colorPatterns.some(pattern => pattern.test(value))) {
          stylelint.utils.report({
            message: messages.expected,
            node: decl,
            result,
            ruleName,
          });
        }
      }
      
      // Check for hover-only color changes
      if (decl.parent.selector && decl.parent.selector.includes(':hover')) {
        const nonHoverDecl = findNonHoverDeclaration(decl, root);
        if (!nonHoverDecl && (decl.prop === 'color' || decl.prop === 'opacity')) {
          stylelint.utils.report({
            message: messages.hoverOnly,
            node: decl,
            result,
            ruleName,
          });
        }
      }
    });
  };
};

function findNonHoverDeclaration(hoverDecl, root) {
  let found = false;
  const selector = hoverDecl.parent.selector.replace(':hover', '');
  
  root.walkRules(rule => {
    if (rule.selector === selector) {
      rule.walkDecls(decl => {
        if (decl.prop === hoverDecl.prop) {
          found = true;
        }
      });
    }
  });
  
  return found;
}

rule.ruleName = ruleName;
rule.messages = messages;

module.exports = rule;

// Additional rule for contrast checking
const contrastRuleName = 'custom/ensure-contrast';
const contrastMessages = stylelint.utils.ruleMessages(contrastRuleName, {
  lowContrast: 'Color combination may not meet WCAG AA contrast requirements',
});

const contrastRule = (primaryOption) => {
  return (root, result) => {
    const validOptions = stylelint.utils.validateOptions(result, contrastRuleName, {
      actual: primaryOption,
      possible: [true, false],
    });

    if (!validOptions) {
      return;
    }

    // This would need to be enhanced with actual contrast calculation
    // For now, it warns about common low-contrast patterns
    const lowContrastPatterns = [
      /color:\s*#999/,        // Light gray text
      /color:\s*#ccc/,        // Very light gray
      /color:\s*rgba\([^,]+,[^,]+,[^,]+,\s*0\.[1-4]\)/,  // Low opacity
    ];

    root.walkDecls('color', (decl) => {
      lowContrastPatterns.forEach(pattern => {
        if (pattern.test(decl.toString())) {
          stylelint.utils.report({
            message: contrastMessages.lowContrast,
            node: decl,
            result,
            ruleName: contrastRuleName,
          });
        }
      });
    });
  };
};

contrastRule.ruleName = contrastRuleName;
contrastRule.messages = contrastMessages;

module.exports.contrastRule = contrastRule;