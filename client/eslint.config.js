import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
export default [js.configs.recommended, {
  files: ['**/*.{js,jsx}'], plugins: { react, 'react-hooks': hooks },
  languageOptions: { globals: globals.browser, ecmaVersion: 2023, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
  settings: { react: { version: 'detect' } },
  rules: { 'react/jsx-uses-vars': 'error', 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn', 'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z]' }] },
}];
