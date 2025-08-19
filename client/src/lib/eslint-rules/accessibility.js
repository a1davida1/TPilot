/**
 * Custom ESLint rules to prevent accessibility regressions
 * Ensures WCAG AA compliance and prevents hover-only patterns
 */

module.exports = {
  rules: {
    'no-hover-only-visibility': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Prevent hover-only visibility patterns that harm accessibility',
          category: 'Accessibility',
          recommended: true,
        },
        fixable: null,
        schema: [],
        messages: {
          hoverOnlyVisibility: 'Avoid hover-only visibility. Content should be readable without hovering.',
          hoverOnlyColor: 'Avoid hover-only color changes for critical information.',
        },
      },
      create(context) {
        return {
          JSXElement(node) {
            // Check for className patterns that suggest hover-only visibility
            const classNameProp = node.openingElement.attributes.find(
              attr => attr.name && attr.name.name === 'className'
            );
            
            if (classNameProp && classNameProp.value) {
              const classNames = classNameProp.value.value || '';
              
              // Pattern 1: opacity-0 with hover:opacity-100
              if (classNames.includes('opacity-0') && classNames.includes('hover:opacity-')) {
                context.report({
                  node,
                  messageId: 'hoverOnlyVisibility',
                });
              }
              
              // Pattern 2: invisible with hover:visible
              if (classNames.includes('invisible') && classNames.includes('hover:visible')) {
                context.report({
                  node,
                  messageId: 'hoverOnlyVisibility',
                });
              }
              
              // Pattern 3: text-transparent with hover color
              if (classNames.includes('text-transparent') && classNames.includes('hover:text-')) {
                context.report({
                  node,
                  messageId: 'hoverOnlyColor',
                });
              }
            }
          },
        };
      },
    },
    
    'require-accessible-colors': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Require use of theme tokens for guaranteed WCAG AA compliance',
          category: 'Accessibility',
          recommended: true,
        },
        fixable: 'code',
        schema: [],
        messages: {
          useThemeTokens: 'Use theme tokens (text-foreground, text-muted-foreground) instead of arbitrary colors.',
          useReadableClass: 'Use .text-readable or .text-readable-muted for guaranteed accessibility.',
        },
      },
      create(context) {
        const problematicPatterns = [
          /text-gray-\d+/,
          /text-slate-\d+/,
          /text-zinc-\d+/,
          /text-neutral-\d+/,
          /text-stone-\d+/,
        ];
        
        return {
          JSXElement(node) {
            const classNameProp = node.openingElement.attributes.find(
              attr => attr.name && attr.name.name === 'className'
            );
            
            if (classNameProp && classNameProp.value) {
              const classNames = classNameProp.value.value || '';
              
              problematicPatterns.forEach(pattern => {
                if (pattern.test(classNames)) {
                  context.report({
                    node,
                    messageId: 'useThemeTokens',
                    fix(fixer) {
                      // Suggest replacement with theme tokens
                      const newClassNames = classNames
                        .replace(/text-gray-\d+/g, 'text-foreground')
                        .replace(/text-slate-\d+/g, 'text-muted-foreground')
                        .replace(/text-zinc-\d+/g, 'text-muted-foreground')
                        .replace(/text-neutral-\d+/g, 'text-muted-foreground')
                        .replace(/text-stone-\d+/g, 'text-muted-foreground');
                      
                      return fixer.replaceText(
                        classNameProp.value,
                        `"${newClassNames}"`
                      );
                    },
                  });
                }
              });
            }
          },
        };
      },
    },
    
    'require-test-ids': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Require data-testid attributes on interactive elements',
          category: 'Testing',
          recommended: true,
        },
        fixable: null,
        schema: [],
        messages: {
          missingTestId: 'Interactive element should have a data-testid attribute for testing.',
        },
      },
      create(context) {
        const interactiveElements = ['button', 'input', 'select', 'textarea', 'a'];
        
        return {
          JSXElement(node) {
            const elementName = node.openingElement.name.name;
            
            if (interactiveElements.includes(elementName)) {
              const hasTestId = node.openingElement.attributes.some(
                attr => attr.name && attr.name.name === 'data-testid'
              );
              
              if (!hasTestId) {
                context.report({
                  node,
                  messageId: 'missingTestId',
                });
              }
            }
          },
        };
      },
    },
  },
};