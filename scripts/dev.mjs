#!/usr/bin/env node
// Smith — One-command local dev startup.
//
// 1. Verify local Postgres is reachable at localhost:5433
// 2. Kill anything listening on ports 4000 (server) and 5173 (client) so we
//    land on known ports every time (no Vite drift to 5174)
// 3. Launch server + client concurrently with labeled, color-coded output.
//    Ctrl+C kills both.

import { spawn } from 'node:child_process';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import net from 'node:net';

const exec = promisify(execCb);

const PG_HOST = 'localhost';
const PG_PORT = 5433;
const SERVER_PORT = 4000;
const CLIENT_PORT = 5173;

function probeTcp(host, port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch {}
      resolve(ok);
    };
    sock.once('connect', () => finish(true));
    sock.once('error', () => finish(false));
    setTimeout(() => finish(false), timeoutMs);
  });
}

async function killPort(port) {
  try {
    const { stdout } = await exec(`lsof -ti :${port} || true`);
    const pids = stdout.split('\n').map(s => s.trim()).filter(Boolean);
    if (!pids.length) return [];
    await exec(`kill -9 ${pids.join(' ')} 2>/dev/null || true`);
    // Give the OS a moment to release the port before strict-port binds it.
    await new Promise(r => setTimeout(r, 250));
    return pids;
  } catch {
    return [];
  }
}

function log(line)   { process.stdout.write(`${line}\n`); }
function warn(line)  { process.stderr.write(`${line}\n`); }

async function main() {
  log('');
  log('  Smith — local dev');
  log('  ─────────────────');

  // 1. Postgres preflight
  const pgUp = await probeTcp(PG_HOST, PG_PORT);
  if (!pgUp) {
    warn(`  ✗ Local Postgres not reachable at ${PG_HOST}:${PG_PORT}.`);
    warn('    Start it with one of:');
    warn('      brew services start postgresql@16');
    warn('      pg_ctl -D /opt/homebrew/var/postgresql@16 start');
    warn('      docker start smith-pg');
    warn('');
    warn(`    DB the server expects: postgres://smith:smith@${PG_HOST}:${PG_PORT}/smith`);
    warn('    (set in server/.env — see server/.env.example for the shape)');
    warn('');
    process.exit(1);
  }
  log(`  ✓ Postgres reachable on ${PG_HOST}:${PG_PORT}`);

  // 2. Clear stale ports so server lands on 4000 and Vite on 5173 reliably.
  for (const port of [SERVER_PORT, CLIENT_PORT]) {
    const killed = await killPort(port);
    if (killed.length) {
      log(`  ✓ Freed port ${port} (killed ${killed.join(', ')})`);
    } else {
      log(`  ✓ Port ${port} already free`);
    }
  }
  log('');

  // 3. Launch both via concurrently. --strictPort on Vite makes it fail loud
  //    if 5173 is taken, instead of silently drifting to 5174.
  //
  // IMPORTANT: each command `cd`s into its package directory so its working
  // directory is correct for dotenv (server/.env, client/.env). The
  // alternative — `npm --prefix server run dev` — keeps cwd at the repo
  // root, which makes dotenv miss server/.env and silently default every
  // env var. We learned this the hard way the first time we shipped the
  // feature flags.
  const args = [
    'concurrently',
    '--names', 'server,client',
    '--prefix-colors', 'cyan.bold,magenta.bold',
    '--kill-others',
    '--handle-input',
    'cd server && npm run dev',
    'cd client && npm run dev -- --port 5173 --strictPort',
  ];
  const child = spawn('npx', args, { stdio: 'inherit', shell: false });
  child.on('exit', (code) => process.exit(code ?? 0));
  const forward = (sig) => { try { child.kill(sig); } catch {} };
  process.on('SIGINT',  () => forward('SIGINT'));
  process.on('SIGTERM', () => forward('SIGTERM'));
}

main().catch((e) => {
  warn(String(e?.stack || e));
  process.exit(1);
});
