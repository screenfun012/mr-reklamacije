import config from '@mr/eslint-config'

export default [
  {
    ignores: ['.output/**', '.nitro/**', '.tanstack/**', '.vite/**', 'src/routeTree.gen.ts'],
  },
  ...config,
]
