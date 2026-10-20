// Runs the API server and the Vite dev server together; Ctrl+C stops both.
import { spawn } from 'node:child_process'

const procs = [
  spawn('npm', ['run', 'dev:server'], { stdio: 'inherit' }),
  spawn('npm', ['run', 'dev:client'], { stdio: 'inherit' }),
]
const stop = () => procs.forEach((p) => p.kill('SIGTERM'))
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
procs.forEach((p) => p.on('exit', (code) => code && stop()))
