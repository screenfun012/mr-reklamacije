/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'repo-no-hono',
      severity: 'error',
      comment: 'Repositories must not depend on HTTP layer',
      from: { path: '^src/modules/.+\\.repository\\.ts$' },
      to: { path: 'node_modules/hono' },
    },
    {
      name: 'service-no-hono',
      severity: 'error',
      comment: 'Services must not depend on HTTP layer',
      from: { path: '^src/modules/.+\\.service\\.ts$' },
      to: { path: 'node_modules/hono' },
    },
    {
      name: 'controller-no-repo',
      severity: 'error',
      comment: 'Controllers must call services, not repositories',
      from: { path: '^src/modules/.+\\.controller\\.ts$' },
      to: { path: '^src/modules/.+\\.repository\\.ts$' },
    },
    {
      name: 'no-sibling-modules',
      severity: 'error',
      comment:
        'Domain modules must not import sibling modules directly (use core ports + container)',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/', pathNot: '^src/modules/$1/' },
    },
  ],
  options: {
    exclude: {
      path: '__tests__',
    },
    doNotFollow: {
      path: 'node_modules',
    },
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: ['.ts', '.js'],
    },
  },
}
