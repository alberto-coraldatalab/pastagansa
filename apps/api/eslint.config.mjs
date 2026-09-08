import tseslint from 'typescript-eslint';

export default [
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: { parser: tseslint.parser, parserOptions: { project: './tsconfig.json' } },
    rules: {
      'no-console': 'error',
      'prefer-const': 'error'
    }
  }
];
