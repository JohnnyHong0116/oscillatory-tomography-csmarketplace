const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

const webRoot = path.resolve(__dirname, '..');
const output = path.join(webRoot, '.parcel-dev');
// Fail clearly rather than serving a different port that the API client cannot use.
const portCheck = net.createServer();
portCheck.once('error', error => {
  console.error(`Cannot start frontend on port 1234: ${error.message}. Stop the existing frontend terminal (Ctrl+C), then retry.`);
  process.exitCode = 1;
});
portCheck.listen(1234, () => portCheck.close(() => {
  // Parcel on this Windows installation can keep serving stale generated files
  // even with --no-cache. Preserve old output on the same drive (Windows can
  // put the system Temp directory on a different drive, where rename fails).
  if (fs.existsSync(output)) {
    if (fs.realpathSync(output) !== output) throw new Error('Refusing to move an unexpected dev-output path.');
    const backupRoot = path.join(webRoot, '.parcel-dev-backups');
    fs.mkdirSync(backupRoot, { recursive: true });
    const backup = fs.mkdtempSync(path.join(backupRoot, 'run-'));
    fs.renameSync(output, path.join(backup, 'previous-output'));
  }
  const child = spawn(process.execPath, [path.join(webRoot, 'node_modules/parcel/lib/bin.js'), 'serve', 'index.html',
    '--port', '1234', '--dist-dir', '.parcel-dev', '--cache-dir', '.parcel-dev-cache', '--no-cache'],
  { cwd: webRoot, stdio: 'inherit', windowsHide: true });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
  process.on('SIGINT', () => child.kill());
  process.on('SIGTERM', () => child.kill());
}));
