import { build } from 'esbuild';
import { resolve } from 'path';
import fs from "fs"

// console.log(process.cwd())
const packageJsonFiles = [
  resolve(process.cwd(), "./", "package.json"),
]
const dependencies = []
for (let filePath of packageJsonFiles) {
  const packageJsonFile = JSON.parse(fs.readFileSync(filePath, "utf-8"))
  const _peerDependencies = Object.keys(packageJsonFile.peerDependencies || {})
  const _dependencies = Object.keys(packageJsonFile.dependencies || {})
  const _devDependencies = Object.keys(packageJsonFile.devDependencies || {})
  const _allDependencies = [
    ..._peerDependencies,
    ..._dependencies,
    ..._devDependencies,
  ]
  dependencies.push(..._allDependencies)
}

// console.log(allDependencies)

// ESM build
await build({
  entryPoints: [resolve(process.cwd(), 'src', 'index.ts')],
  outfile: resolve(process.cwd(), 'dist', 'y-excalidraw.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  minify: false,
  sourcemap: true,
  external: dependencies,
  loader: {
    '.ts': 'ts', // Use esbuild's TypeScript loader
  },
})

// CJS build
await build({
  entryPoints: [resolve(process.cwd(), 'src', 'index.ts')],
  outfile: resolve(process.cwd(), 'dist', 'y-excalidraw.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  minify: false,
  sourcemap: true,
  external: dependencies,
  loader: {
    '.ts': 'ts', // Use esbuild's TypeScript loader
  },
});
