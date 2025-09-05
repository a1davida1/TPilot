# TypeScript Coding Standards
- **Disallow `any`**: prefer explicit interfaces or `unknown`.
- **No Non-null Assertions**: use optional chaining or `??` with defaults.
- **Strict Generics**: default to `unknown` for generic type parameters.
- **Testing**: mock types must match real interfaces.
- **Commit Hooks**: `npm run lint` and `npm test` must pass before commit.