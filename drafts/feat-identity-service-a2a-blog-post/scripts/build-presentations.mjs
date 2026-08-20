#!/usr/bin/env node

import {
  cpSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = process.cwd()
const presentationsRoot = resolve(repoRoot, 'presentations')
const slidevCliPath = resolve(repoRoot, 'node_modules/.bin/slidev')

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const listDeckPaths = (directory) => {
  const entries = readdirSync(directory, { withFileTypes: true })
  const deckPaths = []

  for (const entry of entries) {
    const entryPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      deckPaths.push(...listDeckPaths(entryPath))
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue
    }

    const source = readFileSync(entryPath, 'utf8')
    if (/^---[\s\S]*?^theme:\s*.+$/m.test(source)) {
      deckPaths.push(entryPath)
    }
  }

  return deckPaths
}

const copyStaticDirectory = (sourceDir, targetDir) => {
  if (!statSync(sourceDir, { throwIfNoEntry: false })) {
    return
  }

  cpSync(sourceDir, targetDir, { recursive: true })
}

if (!statSync(presentationsRoot, { throwIfNoEntry: false })) {
  console.log('No presentations directory found. Skipping slide build.')
  process.exit(0)
}

if (!statSync(slidevCliPath, { throwIfNoEntry: false })) {
  console.error('Missing slide build dependencies. Run npm install first.')
  process.exit(1)
}

const deckPaths = listDeckPaths(presentationsRoot)

if (deckPaths.length === 0) {
  console.log('No Slidev decks found. Skipping slide build.')
  process.exit(0)
}

for (const deckPath of deckPaths) {
  const deckDir = dirname(deckPath)
  const outDir = join(deckDir, 'site')

  rmSync(outDir, { recursive: true, force: true })
  run(slidevCliPath, [
    'build',
    deckPath,
    '--out',
    outDir,
    '--base',
    './',
    '--without-notes',
  ])

  copyStaticDirectory(join(deckDir, 'figures'), join(outDir, 'figures'))

  console.log(`Built ${relative(repoRoot, outDir)}`)
}
