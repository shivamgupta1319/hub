import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['out/**', 'dist/**', 'node_modules/**', '.ui-shots/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['src/main/**', 'src/preload/**', '*.config.*', 'scripts/**'],
    languageOptions: { globals: globals.node }
  },
  {
    // Tests index into arrays they just built; asserting non-null there is clearer than guards.
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' }
  },
  {
    files: ['src/renderer/**'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules
  }
)
