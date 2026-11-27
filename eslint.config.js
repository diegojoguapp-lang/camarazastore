import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['**/node_modules/**', 'dist/**', 'dist-store/**'] },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } }
    }
  },
  {
    files: ['src/**/*.{js,jsx}', 'camaraza-store/src/**/*.{js,jsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error'
    }
  },
  {
    files: ['*.{js,mjs}', 'tests/**/*.mjs', 'camaraza-store/*.{js,mjs}'],
    languageOptions: { globals: globals.node }
  }
]
