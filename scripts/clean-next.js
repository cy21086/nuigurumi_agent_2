const fs = require('fs');
const path = require('path');

const target = path.resolve(process.cwd(), '.next');
const maxAttempts = 5;
const delayMs = 500;

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function removeDir(dir) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (fs.existsSync(dir)) {
        // Node 14+ supports recursive rm
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`Removed ${dir}`);
      } else {
        // nothing to do
      }
      return 0;
    } catch (err) {
      console.warn(`Attempt ${attempt} to remove ${dir} failed:`, err && err.code ? err.code : err);
      // On Windows EPERM, try to relax attributes and retry
      try {
        // try chmod then retry
        if (fs.existsSync(dir)) {
          const walk = (p) => {
            try {
              const stats = fs.lstatSync(p);
              if (stats.isDirectory()) {
                const items = fs.readdirSync(p);
                items.forEach((it) => walk(path.join(p, it)));
              }
              // try to make writable
              fs.chmodSync(p, 0o666);
            } catch (e) {
              // ignore
            }
          };
          walk(dir);
        }
      } catch (e) {
        // ignore
      }

      if (attempt < maxAttempts) await sleep(delayMs);
    }
  }
  console.error(`Failed to remove ${dir} after ${maxAttempts} attempts.`);
  return 1;
}

(async () => {
  const code = await removeDir(target);
  if (code !== 0) {
    console.error('\nCould not clean .next directory. This is often caused by OneDrive syncing or another process locking files.');
    console.error('Suggestions:');
    console.error('- Pause OneDrive sync for this folder, then try again.');
    console.error("- Close editors or processes that may hold files (VSCode, terminals).");
    console.error("- Reboot if a process is stuck holding handles to files.");
    process.exit(1);
  }
  process.exit(0);
})();
