const expo = require('eslint-config-expo/flat');

module.exports = [
  ...expo,
  {
    ignores: [
      'node_modules/',
      'dist/',
      '.expo/'
    ],
  },
  {
    files: ['**/__tests__/**/*.js', '**/*.test.js', 'src/test/jest-setup.ts'],
    languageOptions: {
      globals: {
        it: 'readonly',
        expect: 'readonly',
        jest: 'readonly',
      },
    },
  },
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react/no-unescaped-entities': 'off',
      'react-hooks/immutability': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'import/first': 'off',
      'import/no-named-as-default': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/globals': 'off',
      'react/display-name': 'off',
      'react/no-children-prop': 'off',
    },
  },
];
