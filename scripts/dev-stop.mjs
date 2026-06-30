#!/usr/bin/env node
// Smith — Stop any local dev processes lingering on ports 4000 and 5173.

import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execCb);

const PORTS = [4000, 5173];

for (const port of PORTS) {
  try {
    const { stdout } = await exec(`lsof -ti :${port} || true`);
    const pids = stdout.split('\n').map(s => s.trim()).filter(Boolean);
    if (!pids.length) {
      console.log(`  ✓ Port ${port} already free`);
      continue;
    }
    await exec(`kill -9 ${pids.join(' ')} 2>/dev/null || true`);
    console.log(`  ✓ Freed port ${port} (killed ${pids.join(', ')})`);
  } catch (e) {
    console.error(`  ✗ Could not clear port ${port}: ${e.message}`);
  }
}
