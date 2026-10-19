import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const shared = {
  'no-empty': 'off',
  'no-control-regex': 'off',
  'no-useless-assignment': 'off',
  'no-useless-escape': 'off',
  'prefer-const': 'off',
  'preserve-caught-error': 'off',
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
  'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
};

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      'website/**',
      'runtime/**',
      'docs/**',
      'releases/**',
      'licenses/**',
      'workflows/**',
    ],
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    extends: [eslint.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      ...shared,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: true, allowTernary: true },
      ],
    },
  },
  {
    files: ['desktop/**/*.cjs'],
    extends: [eslint.configs.recommended],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: shared,
  },
  {
    files: ['desktop/**/*.mjs', 'scripts/**/*.mjs', 'tests/**/*.mjs'],
    extends: [eslint.configs.recommended],
    languageOptions: { sourceType: 'module', globals: globals.node },
    rules: shared,
  },
  eslintConfigPrettier,
);
