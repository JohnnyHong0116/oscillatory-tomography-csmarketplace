const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function containedDirectory(root, directory) {
  const relative = path.relative(fs.realpathSync(root), fs.realpathSync(directory));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Build directory must stay inside the web workspace: ${directory}`);
  }
}

/** Publish a complete fresh output, not a potentially stale in-place Parcel
 * directory. Retain old hashed assets so already-open reports still lazy-load.
 * No recursive deletion: the previous release remains recoverable on disk. */
function publishBuild(root, stage) {
  containedDirectory(root, stage);
  const html = fs.readFileSync(path.join(stage, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']?([^\s"'>]+)/g)].map(match => match[1]);
  if (!scripts.length) throw new Error('Build has no entry script; refusing to publish.');
  for (const script of scripts) {
    const file = path.resolve(stage, script);
    if (path.dirname(file) !== path.resolve(stage) || !fs.existsSync(file)) throw new Error(`Missing build entry: ${script}`);
  }
  const target = path.join(root, 'dist');
  let backup;
  if (fs.existsSync(target)) {
    containedDirectory(root, target);
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      if (!entry.isFile() || entry.name === 'index.html') continue;
      const destination = path.join(stage, entry.name);
      if (!fs.existsSync(destination)) fs.copyFileSync(path.join(target, entry.name), destination);
    }
    const backups = path.join(root, '.parcel-build-backups');
    fs.mkdirSync(backups, { recursive: true });
    containedDirectory(root, backups);
    backup = path.join(fs.mkdtempSync(path.join(backups, 'run-')), 'previous-output');
    // Both resolved move targets are inside the verified workspace.
    fs.renameSync(target, backup);
  }
  try { fs.renameSync(stage, target); }
  catch (error) {
    if (backup && !fs.existsSync(target)) fs.renameSync(backup, target);
    throw error;
  }
  return { scripts, backup };
}

function main() {
  const root = path.resolve(__dirname, '..');
  const staging = path.join(root, '.parcel-build-staging');
  fs.mkdirSync(staging, { recursive: true });
  containedDirectory(root, staging);
  const job = fs.mkdtempSync(path.join(staging, 'run-'));
  const stage = path.join(job, 'output');
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/parcel/lib/bin.js'),
    'build', 'index.html', '--dist-dir', stage, '--cache-dir', path.join(job, 'cache'),
    '--public-url', './', '--no-cache'], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) { process.exitCode = result.status ?? 1; return; }
  const published = publishBuild(root, stage);
  console.log(`Published web/dist: ${published.scripts.join(', ')}`);
  if (published.backup) console.log(`Previous build retained at ${path.relative(root, published.backup)}`);
}

module.exports = { publishBuild };
if (require.main === module) main();
