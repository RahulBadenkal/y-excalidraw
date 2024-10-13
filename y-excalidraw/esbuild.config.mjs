import { build } from 'esbuild';
import { resolve } from 'path';
import fs from "fs"

// console.log(process.cwd())
const packageJsonFile = JSON.parse(fs.readFileSync(resolve(process.cwd(), "../", "package.json"), "utf-8"))
const peerDependencies = Object.keys(packageJsonFile.peerDependencies)
const dependencies = Object.keys(packageJsonFile.dependencies)
const devDependencies = Object.keys(packageJsonFile.devDependencies)
const allDependencies = [
  ...peerDependencies,
  ...dependencies,
  ...devDependencies,
]
// console.log(allDependencies)

// ESM build
await build({
  entryPoints: [resolve(process.cwd(), 'index.ts')],
  outfile: resolve(process.cwd(), 'dist', 'y-excalidraw.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  minify: false,
  sourcemap: true,
  external: allDependencies,
  loader: {
    '.ts': 'ts', // Use esbuild's TypeScript loader
  },
})

// CJS build
await build({
  entryPoints: [resolve(process.cwd(), 'index.ts')],
  outfile: resolve(process.cwd(), 'dist', 'y-excalidraw.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  minify: false,
  sourcemap: true,
  external: allDependencies,
  loader: {
    '.ts': 'ts', // Use esbuild's TypeScript loader
  },
});
