const { app, utilityProcess } = require('electron')

const runnerPath = process.argv[2]
const commandArgs = process.argv.slice(3)

if (!runnerPath || commandArgs.length === 0) {
  console.error('Usage: electron engine-utility-probe.cjs <runner-path> <engine-args...>')
  process.exit(2)
}

let settled = false

function finish(code, output) {
  if (settled) return
  settled = true
  clearTimeout(timer)
  if (output) {
    const stream = code === 0 ? process.stdout : process.stderr
    stream.write(output)
  }
  app.exit(code)
}

const timer = setTimeout(() => {
  finish(1, 'Engine utility process timed out.\n')
}, 30_000)

app.whenReady().then(() => {
  const child = utilityProcess.fork(runnerPath, commandArgs, {
    env: process.env,
    stdio: 'pipe',
    serviceName: 'DevDesk Engine Probe',
  })

  let stderr = ''
  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  child.on('message', (message) => {
    if (message?.ok === true && typeof message.stdout === 'string') {
      finish(0, message.stdout)
      child.kill()
      return
    }
    if (message?.ok === false) {
      finish(1, typeof message.stderr === 'string' ? message.stderr : 'Engine utility process failed.\n')
      child.kill()
    }
  })

  child.on('error', (error) => {
    finish(1, `${error.stack || error.message}\n`)
  })

  child.on('exit', (code) => {
    if (!settled) {
      finish(1, stderr || `Engine utility process exited before responding (code ${code}).\n`)
    }
  })
})
