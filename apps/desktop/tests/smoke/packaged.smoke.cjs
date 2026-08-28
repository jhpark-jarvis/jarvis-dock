const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { FuseV1Options, getCurrentFuseWire } = require('@electron/fuses');

const desktopDirectory = path.resolve(__dirname, '../..');
const packageJson = JSON.parse(
  readFileSync(path.join(desktopDirectory, 'package.json'), 'utf8'),
);
const productName = packageJson.productName;
const packageDirectory = path.join(
  desktopDirectory,
  'out',
  `${productName}-${process.platform}-${process.arch}`,
);

const getExecutablePath = () => {
  if (process.platform === 'win32') {
    return path.join(packageDirectory, `${productName}.exe`);
  }

  if (process.platform === 'darwin') {
    return path.join(
      packageDirectory,
      `${productName}.app`,
      'Contents',
      'MacOS',
      productName,
    );
  }

  return path.join(packageDirectory, productName);
};

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const verifyFuses = async (executablePath) => {
  const fuseWire = await getCurrentFuseWire(executablePath);
  const disabled = '0'.charCodeAt(0);
  const enabled = '1'.charCodeAt(0);
  const expectedFuses = new Map([
    [FuseV1Options.RunAsNode, disabled],
    [FuseV1Options.EnableCookieEncryption, enabled],
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable, disabled],
    [FuseV1Options.EnableNodeCliInspectArguments, disabled],
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation, enabled],
    [FuseV1Options.OnlyLoadAppFromAsar, enabled],
  ]);

  assert.equal(fuseWire.version, '1', 'Expected Electron Fuse Version 1.');

  for (const [fuse, expectedState] of expectedFuses) {
    assert.equal(
      fuseWire[fuse],
      expectedState,
      `Unexpected packaged fuse state for ${FuseV1Options[fuse]}.`,
    );
  }
};

const launchAndStop = async (executablePath) => {
  const child = spawn(executablePath, [], {
    cwd: path.dirname(executablePath),
    stdio: 'ignore',
    windowsHide: true,
  });
  const childExit = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });

  try {
    const result = await Promise.race([
      childExit.then(({ code, signal }) => {
        throw new Error(
          `Packaged Dock exited unexpectedly with code ${code} and signal ${signal}.`,
        );
      }),
      delay(3_000),
    ]);

    assert.equal(result, undefined);
  } finally {
    if (child.exitCode === null && !child.killed) {
      child.kill();
    }
  }

  const shutdown = await Promise.race([
    childExit,
    delay(5_000).then(() => {
      throw new Error('Packaged Dock did not stop within 5 seconds.');
    }),
  ]);

  assert.ok(shutdown, 'Packaged Dock should emit an exit event.');
};

const run = async () => {
  const executablePath = getExecutablePath();

  assert.ok(
    existsSync(executablePath),
    `Packaged Dock executable was not found: ${executablePath}`,
  );
  await verifyFuses(executablePath);
  if (process.argv.includes('--verify-only')) {
    console.log(`Packaged Dock artifact smoke passed: ${executablePath}`);
    return;
  }
  await launchAndStop(executablePath);

  console.log(`Packaged Dock smoke passed: ${executablePath}`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
