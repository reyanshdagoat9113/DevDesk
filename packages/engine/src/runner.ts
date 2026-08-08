import { runCli } from './cli.js';

// utilityProcess.fork() loads this explicit entrypoint. Its process.argv
// layout is owned by Electron, so delegating from a known module avoids
// relying on the CLI module's direct-execution guard.
const utilityProcess = process as NodeJS.Process & {
  parentPort?: { close: () => void; postMessage: (message: unknown) => void };
};
const output: string[] = [];

void runCli(process.argv, (value) => output.push(value))
  .then(() => {
    utilityProcess.parentPort?.postMessage({ ok: true, stdout: `${output.join('\n')}\n` });
  })
  .catch((error) => {
    utilityProcess.parentPort?.postMessage({
      ok: false,
      stderr: error instanceof Error ? error.stack || error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(() => {
    utilityProcess.parentPort?.close();
  });
