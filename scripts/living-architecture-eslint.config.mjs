import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments/configs'
import importPlugin from 'eslint-plugin-import'
import sonarjs from 'eslint-plugin-sonarjs'
import stylistic from '@stylistic/eslint-plugin'
import unicorn from 'eslint-plugin-unicorn'
import vitest from '@vitest/eslint-plugin'
import noGenericNames from './no-generic-names-eslint-rule.mjs'

class MissingLintRepositoryRootError extends Error {
  constructor() {
    super('Expected NT_SKILLZ_LINT_REPO_ROOT environment variable.')
  }
}

const lintRepositoryRoot = process.env.NT_SKILLZ_LINT_REPO_ROOT

if (!lintRepositoryRoot) {
  throw new MissingLintRepositoryRootError()
}

const typescriptFiles = ['**/*.ts', '**/*.tsx']
const testFiles = ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx']
const ignoredPaths = [
  '**/dist',
  '**/out-tsc',
  '**/node_modules',
  '**/.nx',
  '*.config.ts',
  '*.config.mjs',
  '*.config.js',
  'vitest.workspace.ts',
  '**/*.d.ts',
  '**/test-output',
  '**/api/generated/**',
  '**/.vitepress/cache/**',
  '.riviere/**',
]

const noLetRule = {
  selector: 'VariableDeclaration[kind="let"]',
  message: 'Use const. Avoid mutation.',
}

const noGenericErrorRule = {
  selector: 'NewExpression[callee.name="Error"]',
  message: 'Use custom precise error classes instead of generic Error or fail assertions in tests.',
}

const noEmptyStringFallbackRule = {
  selector: 'LogicalExpression[operator="??"][right.type="Literal"][right.value=""]',
  message:
    'Banned: `?? \'\'` violates fail-fast principle. Never use empty string fallback. Options: (1) Fail fast if value should exist, (2) Handle undefined explicitly without empty string, (3) Create a type that represents emptiness.',
}

const restrictedSyntaxRules = ['error', noLetRule, noGenericErrorRule, noEmptyStringFallbackRule]

const restrictedImportPatterns = [
  {
    group: ['*/utils/*', '*/utils', '*/utilities'],
    message: 'No utils folders. Use domain-specific names.',
  },
  {
    group: ['*/helpers/*', '*/helpers'],
    message: 'No helpers folders. Use domain-specific names.',
  },
  {
    group: ['*/common/*', '*/common'],
    message: 'No common folders. Use domain-specific names.',
  },
  {
    group: ['*/shared/*', '*/shared'],
    message: 'No shared folders. Use domain-specific names.',
  },
  {
    group: ['*/core/*', '*/core'],
    message: 'No core folders. Use domain-specific names.',
  },
  {
    group: ['*/src/lib/*', '*/src/lib', './lib/*', './lib', '../lib/*', '../lib'],
    message: 'No lib folders in projects. Use domain-specific names.',
  },
]

const namingConventionRules = [
  'error',
  {
    selector: 'variable',
    format: ['camelCase'],
  },
  {
    selector: 'variable',
    modifiers: ['const'],
    format: ['camelCase', 'UPPER_CASE'],
  },
  {
    selector: 'function',
    format: ['camelCase', 'PascalCase'],
  },
  {
    selector: 'parameter',
    format: ['camelCase'],
    leadingUnderscore: 'allow',
  },
  {
    selector: 'typeLike',
    format: ['PascalCase'],
  },
  {
    selector: 'enumMember',
    format: ['PascalCase'],
  },
  {
    selector: 'objectLiteralProperty',
    format: null,
  },
]

export default tseslint.config(
  {
    files: typescriptFiles,
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  {
    ignores: ignoredPaths,
  },
  eslintComments.recommended,
  {
    rules: {
      '@eslint-community/eslint-comments/no-use': ['error', { allow: [] }],
    },
  },
  sonarjs.configs.recommended,
  {
    rules: {
      'sonarjs/void-use': 'off',
    },
  },
  {
    files: typescriptFiles,
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      custom: {
        rules: {
          'no-generic-names': noGenericNames,
        },
      },
      import: importPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        projectService: {
          allowDefaultProject: ['vitest.config.ts'],
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 50,
        },
        tsconfigRootDir: lintRepositoryRoot,
      },
    },
    rules: {
      'custom/no-generic-names': 'error',
      'no-warning-comments': 'off',
      'multiline-comment-style': 'off',
      'capitalized-comments': 'off',
      'no-inline-comments': 'error',
      'spaced-comment': 'off',
      'no-negated-condition': 'error',
      'no-restricted-syntax': restrictedSyntaxRules,
      'prefer-const': 'error',
      'no-var': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'import/no-duplicates': 'error',
      'no-restricted-imports': ['error', { patterns: restrictedImportPatterns }],
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', 3],
      complexity: ['error', 12],
      'no-restricted-globals': [
        'error',
        {
          name: '__dirname',
          message: 'Use dirname(fileURLToPath(import.meta.url)) in ESM.',
        },
        {
          name: '__filename',
          message: 'Use fileURLToPath(import.meta.url) in ESM.',
        },
      ],
      '@typescript-eslint/naming-convention': namingConventionRules,
    },
  },
  {
    files: typescriptFiles,
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      '@stylistic/indent': ['error', 2],
      '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: false }],
    },
  },
  {
    files: typescriptFiles,
    plugins: {
      unicorn,
    },
    rules: {
      'unicorn/prefer-string-replace-all': 'error',
      'unicorn/prefer-type-error': 'error',
    },
  },
  {
    files: testFiles,
    plugins: {
      vitest,
    },
    rules: {
      'vitest/no-conditional-expect': 'error',
      'vitest/no-conditional-in-test': 'error',
      'vitest/prefer-strict-equal': 'error',
      'vitest/consistent-test-it': ['error', { fn: 'it' }],
      'vitest/consistent-test-filename': ['error', { pattern: '.*\\.spec\\.[tj]sx?$' }],
      'vitest/max-expects': ['error', { max: 4 }],
      'vitest/prefer-called-with': 'error',
      'vitest/prefer-to-have-length': 'error',
      'vitest/require-to-throw-message': 'error',
      'vitest/prefer-spy-on': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
)
