module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'unused-imports'],
  extends: [
    'next/core-web-vitals',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  overrides: [
    {
      files: ['tests/**/*.ts', 'tests/**/*.tsx'],
      rules: {
        'unused-imports/no-unused-imports': 'off',
        'unused-imports/no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
    {
      files: ['src/scripts/**/*.ts', 'src/scripts/**/*.tsx'],
      rules: {
        'unused-imports/no-unused-imports': 'off',
        'unused-imports/no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
  rules: {
    // Permite "any"
    '@typescript-eslint/no-explicit-any': 'off',

    // Retorno explícito de função
    '@typescript-eslint/explicit-function-return-type': 'off',

    // Variáveis/imports não utilizados
    'unused-imports/no-unused-imports': 'warn',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
    '@typescript-eslint/no-unused-vars': 'off',

    // Permite require
    '@typescript-eslint/no-var-requires': 'off',

    // Permite código inseguro em prototipagem
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',

    // Permite interfaces vazias
    '@typescript-eslint/no-empty-interface': 'off',

    // Desativa avisos comuns adicionais
    'no-console': 'off',
    'react-hooks/exhaustive-deps': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',
  },
};
