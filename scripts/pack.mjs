import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
const outPath = join(root, `browser-agent-runtime-v${version}.zip`)

if (!existsSync(dist)) {
  console.error('dist/ missing — run npm run build first')
  process.exit(1)
}

function listFiles(dir) {
  const entries = readdirSync(dir)
  const files = []
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...listFiles(full))
    } else {
      files.push(full)
    }
  }
  return files
}

const isWin = process.platform === 'win32'
if (isWin) {
  const escaped = outPath.replace(/'/g, "''")
  const distGlob = join(dist, '*').replace(/'/g, "''")
  const ps = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `if (Test-Path -LiteralPath '${escaped}') { Remove-Item -LiteralPath '${escaped}' -Force }; Compress-Archive -Path '${distGlob}' -DestinationPath '${escaped}' -Force`,
    ],
    { stdio: 'inherit' },
  )
  if (ps.status !== 0) {
    process.exit(ps.status ?? 1)
  }
} else {
  const tar = spawnSync('tar', ['-a', '-cf', outPath, '-C', dist, '.'], { stdio: 'inherit' })
  if (tar.status !== 0) {
    process.exit(tar.status ?? 1)
  }
}

console.log(`Packed ${listFiles(dist).length} files → ${relative(root, outPath)}`)
