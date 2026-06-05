import config from '@mr/eslint-config'

export default [
  ...config,
  {
    ignores: ['.dependency-cruiser.cjs'],
  },
  {
    files: ['src/**/*.repository.ts', 'src/**/*.service.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'hono',
              message: 'Repository and service layers must not import Hono (HTTP).',
            },
          ],
        },
      ],
    },
  },
]
