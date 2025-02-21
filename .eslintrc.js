module.exports = {
  env: {
    browser: true,
    es6: true,
    jest: true,
    mocha: true,
    node: true
  },
  globals: {
    artifacts: false,
    assert: false,
    contract: false,
    web3: false
  },
  extends: [],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json']
  },
  ignorePatterns: [
    '.eslintrc.js',
    '**/types/truffle-contracts',
    'coverage',
    'dist/'
  ],
  rules: {
    'no-console': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/return-await': 'off',
    '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    '@typescript-eslint/require-array-sort-compare': 'off'
  },
  overrides: []
}