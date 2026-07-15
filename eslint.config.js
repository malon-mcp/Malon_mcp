import tseslint from 'typescript-eslint';

export default tseslint.config(
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'coverage/'],
  },
);
