/* eslint-disable @typescript-eslint/naming-convention */
module.exports = {
  // ...
  extends: [
    'plugin:svelte/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:unicorn/recommended',
  ],
  plugins: ['simple-import-sort'],

  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.eslint.json',
    sourceType: 'module',
    ecmaVersion: 2021,
    ecmaFeatures: {
      globalReturn: false,
      impliedStrict: false,
      jsx: false,
    },
    extraFileExtensions: ['.svelte'], // This is a required setting in `@typescript-eslint/parser` v4.24.0.
  },
  overrides: [
    {
      files: ['*.svelte'],
      parser: 'svelte-eslint-parser',
      // Parse the `<script>` in `.svelte` as TypeScript by adding the following configuration.
      parserOptions: {
        parser: '@typescript-eslint/parser',
      },
    },
    {
      files: ['*.svelte', '*.ts'],
      rules: {
        'simple-import-sort/exports': 'error',
        'simple-import-sort/imports': [
          'error',
          {
            groups: [
              // Side effect imports.
              ['^\\u0000'],
              // Node.js builtins prefixed with `node:`.
              ['^node:'],
              // Packages.
              // Things that start with a letter (or digit or underscore), or `@` followed by a letter.
              ['^@?\\w'],
              // svelte
              ['^\\$env|\\$app'],
              ['^\\$lib/models'],
              ['^\\$lib/machines'],
              ['^\\$lib/workers'],
              ['^\\$lib'],

              // Absolute imports and other imports such as Vue-style `@/foo`.
              // Anything not matched in another group.
              ['^'],
              // Relative imports.
              // Anything that starts with a dot.

              ['^\\.'],
              ['^\\./\\$types'],
            ],
          },
        ],
      },
    },
  ],
  rules: {
    '@typescript-eslint/keyword-spacing': 'error',
    'no-multi-spaces': ['error'],
    'unicorn/filename-case': [
      'error',
      {
        cases: {
          camelCase: true,
          pascalCase: true,
        },
      },
    ],
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'default',
        format: ['camelCase'],
      },
      {
        selector: 'variable',
        format: ['PascalCase', 'UPPER_CASE'],
        types: ['boolean'],
        prefix: ['is', 'should', 'has', 'can', 'did', 'will'],
      },
      {
        selector: 'variableLike',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
      },

      {
        selector: 'parameter',
        format: ['camelCase'],
        leadingUnderscore: 'allow',
      },
      {
        selector: 'memberLike',
        modifiers: ['private'],
        format: ['camelCase'],
        leadingUnderscore: 'forbid',
      },
      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
      {
        selector: 'property',
        modifiers: ['readonly'],
        format: ['PascalCase'],
      },
      {
        selector: 'enumMember',
        format: ['UPPER_CASE'],
      },
      {
        selector: 'objectLiteralMethod',
        format: ['snake_case', 'camelCase'],
      },
      {
        selector: 'objectLiteralProperty',
        format: [],
      },
    ],
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    'svelte/no-unused-svelte-ignore': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    quotes: [2, 'single', { avoidEscape: true }],
    semi: [2, 'always'],
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        disallowTypeAnnotations: false,
        fixStyle: 'separate-type-imports',
      },
    ],
  },
};
