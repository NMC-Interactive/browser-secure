import { execSync, execFileSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface DaemonState {
  version: 1;
  pid: number;
  port: number;
  wsUrl: string;
  profile: string;
  profileId: string;
  profilePath: string;
  startedAt: string;
  browserPath: string;
}

// ---------------------------------------------------------------------------
// State file management
// ---------------------------------------------------------------------------

function getDaemonDir(): string {
  const dir = path.join(os.homedir(), '.browser-secure');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return dir;
}

export function getDaemonStatePath(): string {
  return path.join(getDaemonDir(), 'daemon.json');
}

export function loadDaemonState(): DaemonState | null {
  const statePath = getDaemonStatePath();
  if (!fs.existsSync(statePath)) return null;
  try {
    const content = fs.readFileSync(statePath, 'utf-8');
    const state = JSON.parse(content) as DaemonState;
    if (state.version !== 1 || !state.pid || !state.wsUrl) return null;
    return state;
  } catch {
    return null;
  }
}

function saveDaemonState(state: DaemonState): void {
  fs.writeFileSync(getDaemonStatePath(), JSON.stringify(state, null, 2), 'utf-8');
}

export function clearDaemonState(): void {
  const p = getDaemonStatePath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export function isDaemonRunning(state?: DaemonState | null): boolean {
  const s = state ?? loadDaemonState();
  if (!s) return false;
  // Verify Chrome is still listening on the debug port
  try {
    const out = execSync(
      `curl -s --max-time 2 http://localhost:${s.port}/json/version`,
      { encoding: 'utf-8', stdio: 'pipe', timeout: 3000 }
    );
    return out.includes('Chrome');
  } catch {
    clearDaemonState();
    return false;
  }
}

export function isChromeRunning(): boolean {
  try {
    const out = execSync('pgrep "Google Chrome"', { stdio: 'pipe' }).toString().trim();
    return out.split('\n').filter(Boolean).length > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Chrome binary detection
// ---------------------------------------------------------------------------

function getChromePath(): string | undefined {
  const platform = process.platform;
  if (platform === 'darwin') {
    const p = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(p)) return p;
  } else if (platform === 'linux') {
    for (const p of ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium']) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === 'win32') {
    for (const p of [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ]) {
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Wait for Chrome to expose WebSocket endpoint
// ---------------------------------------------------------------------------

async function waitForChromeReady(port: number, maxWaitMs = 20000): Promise<string | null> {
  const deadline = Date.now() + maxWaitMs;
  const jsonUrl = `http://localhost:${port}/json/version`;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(jsonUrl);
      if (res.ok) {
        const data = await res.json() as { webSocketDebuggerUrl?: string };
        if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
      }
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  return null;
}

// ---------------------------------------------------------------------------
// Daemon lifecycle
// ---------------------------------------------------------------------------

export async function startDaemon(profileId?: string): Promise<{ state: DaemonState }> {
  if (isDaemonRunning()) {
    const existing = loadDaemonState()!;
    if (!profileId || existing.profileId === profileId) {
      console.log(`🔁 Daemon already running on profile: ${existing.profile} [${existing.profileId}]`);
      return { state: existing };
    }
    throw new Error(
      `Daemon already running with profile "${existing.profile}" [${existing.profileId}].\n` +
      `Close the current daemon first: browser-secure daemon stop\n` +
      `Then restart with the desired profile.`
    );
  }

  const profile = profileId ?? 'Default';
  const userDataDir = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
  const profileDir = profile === 'Default'
    ? path.join(userDataDir, 'Default')
    : path.join(userDataDir, profile);

  if (!fs.existsSync(profileDir)) {
    throw new Error(
      `Chrome profile "${profile}" does not exist. Create it first:\n` +
      `  browser-secure profile --create "${profile}"`
    );
  }

  const chromePath = getChromePath();
  if (!chromePath) {
    throw new Error('System Chrome not found. Cannot start daemon.');
  }

  // Allocate a random CDP port
  const port = 9222 + Math.floor(Math.random() * 1000);

  console.log(`🚀 Starting Chrome daemon...`);
  console.log(`   Profile: ${profile}`);
  console.log(`   CDP port: ${port}`);

  // On macOS, use `open -n` with full app path to force a new Chrome instance.
  // The daemon uses a SEPARATE temp --user-data-dir so it doesn't conflict with
  // River's running Chrome and doesn't close their tabs. Profile is still loaded
  // via --profile-directory so the session/cookies from that profile are used.
  const daemonUserDataDir = path.join(os.tmpdir(), `browser-secure-daemon-${Date.now()}`);
  fs.mkdirSync(daemonUserDataDir, { recursive: true });

  let child: ReturnType<typeof spawn>;
  if (process.platform === 'darwin') {
    // `open -n` = new instance; `--args` pass through to Chrome binary
    child = spawn('open', [
      '-n', '/Applications/Google Chrome.app', '--args',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${daemonUserDataDir}`,
      profile !== 'Default' ? `--profile-directory=${profile}` : '',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--disable-webgl',
      '--disable-accelerated-2d-canvas',
    ].filter(Boolean) as string[], { detached: true, stdio: 'ignore' });
  } else {
    const profileArgs = profile === 'Default' ? [] : [`--profile-directory=${profile}`];
    child = spawn(chromePath, [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      ...profileArgs,
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--disable-webgl',
      '--disable-accelerated-2d-canvas',
    ], { detached: true, stdio: 'ignore' });
  }
  child.unref();

  // Wait for Chrome to expose the WebSocket URL
  const wsUrl = await waitForChromeReady(port, 20000);

  if (!wsUrl) {
    try { process.kill(child.pid!, 0); } catch { /* */ }
    throw new Error(
      'Chrome daemon failed to start.\n' +
      'Try: browser-secure daemon start --profile ' + profile
    );
  }

  // Find the actual Chrome PID by matching the debug port
  // The `open -n` process exits immediately; Chrome's PID is different
  let chromePid = child.pid ?? 0;
  if (process.platform === 'darwin') {
    await new Promise(r => setTimeout(r, 1000)); // let Chrome stabilize
    try {
      const out = execSync(
        `lsof -i :${port} -t 2>/dev/null | head -1`,
        { encoding: 'utf-8', stdio: 'pipe' }
      ).trim();
      if (out) chromePid = parseInt(out, 10);
    } catch { /* use child.pid as fallback */ }
  }

  const state: DaemonState = {
    version: 1,
    pid: chromePid,
    port,
    wsUrl,
    profile,
    profileId: profile,
    profilePath: daemonUserDataDir,
    startedAt: new Date().toISOString(),
    browserPath: chromePath,
  };

  saveDaemonState(state);
  console.log(`✅ Daemon started`);
  console.log(`   Profile: ${state.profile} [${state.profileId}]`);
  console.log(`   PID: ${state.pid}`);

  return { state };
}

export async function stopDaemon(): Promise<void> {
  const state = loadDaemonState();
  if (!state) {
    console.log('No daemon running.');
    return;
  }

  // Kill the Chrome PID tracked at start (resolved via lsof on the debug port,
  // so it's the real Chrome process, not the `open` wrapper). Fall back to
  // looking up the pid on the CDP port if the tracked pid is stale.
  const chromePids = new Set<number>();
  if (state.pid) chromePids.add(state.pid);

  try {
    const out = execFileSync('lsof', ['-i', `:${state.port}`, '-t'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    for (const line of out.split('\n')) {
      const pid = parseInt(line, 10);
      if (!isNaN(pid)) chromePids.add(pid);
    }
  } catch { /* port already free */ }

  for (const pid of chromePids) {
    try { process.kill(pid, 'SIGTERM'); } catch (_) { /* */ }
  }
  if (chromePids.size > 0) {
    await new Promise(r => setTimeout(r, 2000));
    for (const pid of chromePids) {
      try { process.kill(pid, 'SIGKILL'); } catch (_) { /* */ }
    }
  }

  clearDaemonState();
  console.log('🛑 Daemon stopped.');
}

export function getDaemonStatus(): DaemonState | null {
  const state = loadDaemonState();
  if (!state || !isDaemonRunning(state)) return null;
  return state;
}

export function printDaemonStatus(): void {
  const state = loadDaemonState();
  if (!state) {
    console.log('Daemon: NOT RUNNING');
    return;
  }
  if (!isDaemonRunning(state)) {
    console.log('Daemon: STALE (run: browser-secure daemon stop to clean up)');
    return;
  }

  const elapsed = Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  console.log('Daemon: RUNNING');
  console.log(`  Profile: ${state.profile} [${state.profileId}]`);
  console.log(`  PID: ${state.pid}`);
  console.log(`  Uptime: ${mins}m ${secs}s`);
  console.log(`  Started: ${state.startedAt}`);
}
