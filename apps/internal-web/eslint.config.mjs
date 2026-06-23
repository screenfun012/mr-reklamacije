import config from '@mr/eslint-config'

export default [
  {
    ignores: [
      '.output/**',
      '.nitro/**',
      '.tanstack/**',
      '.vite/**',
      'src/routeTree.gen.ts',
      'src/components/tiptap/**',
      'src/hooks/**',
      'src/lib/tiptap-utils.ts',
    ],
  },
  ...config,
]
