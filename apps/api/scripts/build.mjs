/**
 * Production build.
 *
 * Why a bundler and not plain `tsc`: `@soz/shared-types` and `@soz/content` point
 * their `main`/`exports` straight at `./src/index.ts`. A tsc-compiled API would
 * still emit a bare `import '@soz/shared-types'`, node would resolve it through
 * the workspace symlink to a .ts file, and the process would die at startup.
 * Making tsc work would mean giving both packages their own dist and dual
 * exports, which in turn breaks running them from source in dev.
 *
 * Bundling sidesteps all of it: workspace code is inlined, everything in
 * `dependencies` stays external and is resolved from node_modules as usual.
 *
 *   pnpm --filter @soz/api build
 */
import { createRequire } from 'node:module';

import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

// Real npm dependencies stay external — bundling native/CJS packages like
// postgres or @sentry/node is asking for trouble, and node resolves them fine.
// Only the workspace packages need inlining.
const external = Object.keys(pkg.dependencies).filter((d) => !d.startsWith('@soz/'));

const result = await build({
  // migrate.ts is a second entry point because the container runs migrations on
  // boot before starting the server.
  entryPoints: ['src/index.ts', 'src/db/migrate.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external,
  sourcemap: true,
  logLevel: 'info',
  metafile: true,
});

const bytes = Object.values(result.metafile.outputs).reduce((n, o) => n + o.bytes, 0);
console.log(`✓ built ${Object.keys(result.metafile.outputs).length} files, ${(bytes / 1024).toFixed(0)} kB`);
