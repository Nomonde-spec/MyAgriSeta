const path = require('node:path');
const { spawn } = require('node:child_process');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];
let shuttingDown = false;
let apiExited = false;

function startProcess(name, cwd, args) {
  const child = spawn(npmCommand, args, {
    cwd: path.resolve(__dirname, '..', cwd),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  children.push(child);

  child.on('error', (error) => {
    console.error(`${name} could not start: ${error.message}`);
    shutdown(1);
  });
  child.on('exit', (code) => {
    if (name === 'API') apiExited = true;
    if (!shuttingDown) {
      console.error(`${name} stopped${code === null ? '' : ` with exit code ${code}`}.`);
      shutdown(code || 1);
    }
  });

  return child;
}

async function waitForApi(child) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (apiExited || child.exitCode !== null) {
      throw new Error('The API stopped before becoming ready.');
    }
    try {
      const response = await fetch('http://127.0.0.1:3000/health', {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        console.log('API is ready. Starting Expo web.');
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error('The API did not become ready at http://localhost:3000/health.');
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
  process.exitCode = exitCode;
}

async function main() {
  try {
    const api = startProcess('API', 'server', ['run', 'dev']);
    await waitForApi(api);
    startProcess('Expo', 'mobile', ['run', 'web']);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Development services could not start.');
    shutdown(1);
  }
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());

void main();
