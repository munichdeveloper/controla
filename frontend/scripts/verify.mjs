// `npm run verify` (in frontend/): starts Backend (own PostgreSQL), FakeN8n and Frontend,
// walks through the core pages with Playwright and writes a report plus screenshots to
// <repo>/target/verify-report/. Exit code != 0 when any step fails. No Docker needed.
//
// Environment (all optional):
//   VERIFY_SKIP_BUILD=1       reuse existing .next build and backend jar
//   VERIFY_DATABASE_URL       use this PostgreSQL instead of a throw-away local cluster
//                             (plus VERIFY_DATABASE_USER / VERIFY_DATABASE_PASSWORD)
//   VERIFY_PG_BIN             directory with initdb/pg_ctl/createdb
//   VERIFY_BREAK_API=/api/x   answer this API path with 500 (self-test of the failure report)
//   VERIFY_BACKEND_PORT       backend port (default 8081, baked into the frontend build)
//   PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH  custom Chromium
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, readdirSync, mkdirSync, rmSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(frontendDir, '..');
const reportDir = path.join(repoRoot, 'target', 'verify-report');
const backendPort = Number(process.env.VERIFY_BACKEND_PORT || 8081);
const frontendPort = 3027; // fixed by e2e/server.mjs, which we reuse
const baseUrl = `http://127.0.0.1:${frontendPort}`;
const apiUrl = `http://127.0.0.1:${backendPort}/api`;
const steps = [];
const children = [];
const cleanups = [];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const log = message => console.log(`[verify] ${message}`);

function record(name, ok, detail = '') {
  steps.push({ name, ok, detail });
  log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

function run(command, args, options = {}) {
  log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw new Error(`${command} konnte nicht gestartet werden: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} endete mit Exit-Code ${result.status}`);
}

function start(name, command, args, options = {}) {
  const logFile = createWriteStream(path.join(reportDir, `${name}.log`));
  const child = spawn(command, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe'], ...options });
  child.output = '';
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', chunk => { child.output += chunk; logFile.write(chunk); });
  }
  child.on('error', error => { child.output += `spawn error: ${error.message}\n`; });
  child.exited = new Promise(resolve => child.on('exit', code => resolve(code ?? -1)));
  children.push(child);
  return child;
}

async function waitFor(what, check, timeoutMs, child) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      throw new Error(`${what}: Prozess beendet (Exit ${child.exitCode}). Log: target/verify-report/*.log\n${child.output.slice(-1500)}`);
    }
    try {
      const value = await check();
      if (value) return value;
    } catch (error) { lastError = error.message; }
    await sleep(500);
  }
  throw new Error(`${what}: Zeitüberschreitung nach ${timeoutMs / 1000}s ${lastError}`);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
  });
}

async function assertPortFree(port, hint) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', () => reject(new Error(`Port ${port} ist belegt. ${hint}`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

function killAll() {
  for (const child of children) {
    if (child.exitCode === null && child.pid) {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
    }
  }
}

async function cleanup() {
  killAll();
  await sleep(500);
  for (const child of children) {
    if (child.exitCode === null && child.pid) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
    }
  }
  for (const fn of cleanups.reverse()) {
    try { fn(); } catch { /* best effort */ }
  }
}

// ---------- environment pieces ----------

function findPgBin() {
  const candidates = [process.env.VERIFY_PG_BIN, ''];
  for (const base of ['/usr/lib/postgresql', '/usr/pgsql', '/opt/homebrew/opt']) {
    if (existsSync(base)) {
      for (const entry of readdirSync(base).sort().reverse()) candidates.push(path.join(base, entry, 'bin'));
    }
  }
  for (const dir of candidates) {
    if (dir === undefined) continue;
    const probe = spawnSync(path.join(dir, 'initdb'), ['--version'], { encoding: 'utf8' });
    if (!probe.error && probe.status === 0) return dir;
  }
  throw new Error('Keine PostgreSQL-Binaries (initdb/pg_ctl) gefunden. VERIFY_PG_BIN setzen oder VERIFY_DATABASE_URL auf eine vorhandene Test-Datenbank richten.');
}

async function startDatabase() {
  if (process.env.VERIFY_DATABASE_URL) {
    return {
      url: process.env.VERIFY_DATABASE_URL,
      user: process.env.VERIFY_DATABASE_USER || 'controla_user',
      password: process.env.VERIFY_DATABASE_PASSWORD || 'controla_secure_password',
    };
  }
  const bin = findPgBin();
  const tool = name => path.join(bin, name);
  const dir = mkdtempSync(path.join(tmpdir(), 'controla-verify-pg-'));
  const port = await freePort();
  run(tool('initdb'), ['-D', path.join(dir, 'data'), '-U', 'controla', '--auth=trust', '-E', 'UTF8', '--no-locale'], { stdio: 'ignore' });
  run(tool('pg_ctl'), ['-D', path.join(dir, 'data'), '-w', '-l', path.join(reportDir, 'postgres.log'),
    '-o', `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1`, 'start'], { stdio: 'ignore' });
  cleanups.push(() => {
    spawnSync(tool('pg_ctl'), ['-D', path.join(dir, 'data'), '-m', 'immediate', 'stop'], { stdio: 'ignore' });
    rmSync(dir, { recursive: true, force: true });
  });
  run(tool('createdb'), ['-h', '127.0.0.1', '-p', String(port), '-U', 'controla', 'controla_verify'], { stdio: 'ignore' });
  return { url: `jdbc:postgresql://127.0.0.1:${port}/controla_verify`, user: 'controla', password: 'verify' };
}

function backendJar() {
  const dir = path.join(repoRoot, 'backend', 'target');
  const jar = existsSync(dir) && readdirSync(dir).find(f => /^backend-.*-exec\.jar$/.test(f));
  if (!jar) throw new Error('Backend-JAR fehlt (backend/target/backend-*-exec.jar). Ohne VERIFY_SKIP_BUILD wird er gebaut.');
  return path.join(dir, jar);
}

async function api(method, url, { token, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: response.status, ok: response.ok, text, json };
}

// ---------- browser tour ----------

const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

async function tour(browser, credentials, fixtures) {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, locale: 'de-DE', timezoneId: 'Europe/Berlin', acceptDownloads: true });
    if (process.env.VERIFY_BREAK_API) {
      await context.route(`**${process.env.VERIFY_BREAK_API}*`, route => route.fulfill({ status: 500, body: 'VERIFY_BREAK_API' }));
    }
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    let problems = [];
    page.on('pageerror', error => problems.push(`JavaScript-Fehler: ${error.message}`));
    page.on('console', message => {
      // failed resource loads are reported through the response check below
      if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) problems.push(`Konsolenfehler: ${message.text()}`);
    });
    page.on('response', response => {
      if (response.status() >= 500) problems.push(`HTTP ${response.status()} bei ${response.request().method()} ${new URL(response.url()).pathname}`);
    });

    const step = async (name, fn) => {
      problems = [];
      const label = `${viewport.name}: ${name}`;
      const shot = `${viewport.name}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
      let failure = '';
      try { await fn(); await page.waitForLoadState('networkidle').catch(() => {}); } catch (error) { failure = error.message.split('\n')[0]; }
      await page.screenshot({ path: path.join(reportDir, shot), fullPage: true }).catch(() => {});
      const all = [...(failure ? [failure] : []), ...new Set(problems)];
      record(label, all.length === 0, all.length ? `${all.join('; ')} (Screenshot: ${shot})` : `Screenshot: ${shot}`);
    };
    const heading = text => page.getByRole('heading', { name: text }).first().waitFor();

    await step('login', async () => {
      await page.goto(`${baseUrl}/login`);
      await page.locator('#password').waitFor();
      await page.locator('#username').fill(credentials.username);
      await page.locator('#password').fill(credentials.password);
      await page.screenshot({ path: path.join(reportDir, `${viewport.name}-login-form.png`) });
      await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
      await heading('Instanzübersicht');
    });
    await step('instanzuebersicht', async () => {
      await page.goto(baseUrl);
      await heading('Instanzübersicht');
      for (const name of Object.values(fixtures.names)) await page.getByText(name, { exact: true }).first().waitFor();
    });
    await step('instanzdetail-fehler', async () => {
      await page.goto(`${baseUrl}/instances/${fixtures.ids.errors}`);
      await page.getByRole('button', { name: 'Fehler', exact: true }).click();
      await page.getByText(fixtures.errorMessage).first().waitFor();
    });
    await step('alarme', async () => {
      await page.goto(`${baseUrl}/settings/alerts`);
      await heading('Alerts');
    });
    await step('export-import', async () => {
      await page.goto(`${baseUrl}/instances/${fixtures.ids.errors}`);
      await page.getByRole('button', { name: 'Workflows', exact: true }).click();
      await page.getByRole('button', { name: 'Alle', exact: true }).click();
      await page.locator('tbody input[type="checkbox"]').first().check();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: /^Exportieren \(1\)/ }).click();
      const file = await download;
      if (!/\.zip$/.test(file.suggestedFilename())) throw new Error(`Export lieferte keine ZIP-Datei: ${file.suggestedFilename()}`);
      const importButton = await page.getByTitle('Workflow importieren').count();
      log(`Import-Schaltfläche ${importButton ? 'vorhanden' : 'in dieser Edition nicht angeboten (Premium)'}`);
    });
    await step('einstellungen', async () => {
      await page.goto(`${baseUrl}/settings/backups`);
      await page.locator('h1').first().waitFor();
    });
    await context.close();
  }
}

// ---------- main ----------

async function main() {
  rmSync(reportDir, { recursive: true, force: true });
  mkdirSync(reportDir, { recursive: true });
  await assertPortFree(frontendPort, 'Der Frontend-Port ist fest (e2e/server.mjs).');
  await assertPortFree(backendPort, 'Anderen Backend-Port mit VERIFY_BACKEND_PORT wählen.');

  if (!process.env.VERIFY_SKIP_BUILD) {
    run('mvn', ['-B', '-q', '-pl', 'backend', '-DskipTests', 'package'], { cwd: repoRoot });
    run('npm', ['run', 'build'], { cwd: frontendDir, env: { ...process.env, BACKEND_URL: apiUrl } });
  }
  record('Build (Backend-JAR, Frontend)', true, process.env.VERIFY_SKIP_BUILD ? 'übersprungen (VERIFY_SKIP_BUILD)' : '');
  const jar = backendJar();
  if (!existsSync(path.join(frontendDir, '.next', 'standalone', 'server.js'))) throw new Error('Frontend-Build fehlt (.next/standalone). Ohne VERIFY_SKIP_BUILD wird er gebaut.');

  const db = await startDatabase();
  record('Test-Datenbank', true, db.url);

  // FakeN8n as separate process (test classes of the backend, see docs/TESTING_WITH_FAKE_N8N.md)
  const fakePort = await freePort();
  const fake = start('fake-n8n', 'mvn', ['-B', '-q', '-pl', 'backend', 'test-compile', 'exec:java',
    '-Dexec.mainClass=de.atstck.controla.testing.FakeN8n', '-Dexec.classpathScope=test', `-Dexec.args=${fakePort} 127.0.0.1`],
  { cwd: repoRoot, env: { ...process.env, FAKE_N8N_INSTANCES: 'online,offline,authfail,errors' } });
  const fakeUrl = `http://127.0.0.1:${fakePort}`;
  await waitFor('FakeN8n startet', async () => /fake-n8n listening/.test(fake.output), 180_000, fake);
  record('FakeN8n', true, fakeUrl);

  let adminPassword = '';
  const backend = start('backend', 'java', ['-jar', jar], { env: {
    ...process.env,
    SERVER_PORT: String(backendPort),
    SPRING_DATASOURCE_URL: db.url, SPRING_DATASOURCE_USERNAME: db.user, SPRING_DATASOURCE_PASSWORD: db.password,
    MAIL_HOST: '127.0.0.1', MAIL_PORT: '2525', MAIL_USERNAME: 'verify', MAIL_PASSWORD: 'verify',
    CORS_ALLOWED_ORIGINS: baseUrl, FRONTEND_URL: baseUrl, N8N_MONITOR_INTERVAL_MS: '2000',
  } });
  await waitFor('Backend startet', async () => {
    adminPassword ||= /Password: (\S+)/.exec(backend.output)?.[1] || '';
    return adminPassword && (await fetch(`http://127.0.0.1:${backendPort}/actuator/health`)).ok;
  }, 180_000, backend);
  record('Backend', true, `Port ${backendPort}`);

  const control = (method, p, body) => api(method, `${fakeUrl}/__control/${p}`, { body });
  const login = await api('POST', `${apiUrl}/auth/login`, { body: { username: 'admin', password: adminPassword } });
  if (!login.ok) throw new Error(`API-Login fehlgeschlagen: HTTP ${login.status} ${login.text}`);
  const token = login.json.token;

  const errorMessage = 'Verbindung zur Datenbank fehlgeschlagen';
  const names = { online: 'Verify online', offline: 'Verify offline', authfail: 'Verify Auth-Fehler', errors: 'Verify mit Fehlern' };
  const ids = {};
  const workflow = await control('POST', 'errors/workflow', { name: 'Rechnungen versenden' });
  if (!workflow.ok) throw new Error(`FakeN8n-Workflow nicht angelegt: HTTP ${workflow.status} ${workflow.text}`);
  await control('POST', 'errors/error-execution', { message: errorMessage });
  for (const key of Object.keys(names)) {
    const created = await api('POST', `${apiUrl}/instances`, { token, body: { name: names[key], baseUrl: `${fakeUrl}/i/${key}`, apiKey: `fake-key-${key}` } });
    if (!created.ok) throw new Error(`Instanz ${names[key]} nicht angelegt: HTTP ${created.status} ${created.text}`);
    ids[key] = created.json.id;
  }
  await control('POST', 'offline/down');
  await control('POST', 'authfail/api-key', { apiKey: 'rotated-key' });
  const expected = { online: 'online', offline: 'offline', authfail: 'error', errors: 'online' };
  await waitFor('Instanzstatus erkannt', async () => {
    const list = await api('GET', `${apiUrl}/instances`, { token });
    return list.ok && list.json.every(i => i.status === expected[Object.keys(names).find(k => ids[k] === i.id)]);
  }, 60_000).catch(async error => {
    const list = await api('GET', `${apiUrl}/instances`, { token });
    throw new Error(`${error.message}; Ist-Stand: ${JSON.stringify((list.json || []).map(i => [i.name, i.status]))}`);
  });
  record('Instanzen angebunden', true, 'online, offline, Auth-Fehler, mit Fehler-Executions');

  await api('GET', `${apiUrl}/version`, { token });
  const frontend = start('frontend', process.execPath, ['e2e/server.mjs'], { cwd: frontendDir });
  await waitFor('Frontend startet', async () => (await fetch(`${baseUrl}/login`)).ok, 90_000, frontend);
  record('Frontend', true, baseUrl);

  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  try {
    await tour(browser, { username: 'admin', password: adminPassword }, { ids, names, errorMessage });
  } finally {
    await browser.close();
  }
}

function writeReport(fatal) {
  const failed = steps.filter(s => !s.ok);
  const lines = ['# Controla Verifikation', '',
    `Ergebnis: **${failed.length === 0 && !fatal ? 'bestanden' : 'fehlgeschlagen'}** (${steps.length - failed.length}/${steps.length} Schritte)`, ''];
  if (fatal) lines.push(`Abbruch: ${fatal.replace(/\n/g, ' ')}`, '');
  lines.push('| Schritt | Ergebnis | Details |', '| --- | --- | --- |');
  for (const s of steps) lines.push(`| ${s.name} | ${s.ok ? 'bestanden' : 'fehlgeschlagen'} | ${s.detail.replace(/\|/g, '/')} |`);
  lines.push('', 'Screenshots (`*.png`) und Prozess-Logs (`*.log`) liegen neben diesem Bericht.', '');
  writeFileSync(path.join(reportDir, 'report.md'), lines.join('\n'));
  return failed.length === 0 && !fatal;
}

let fatal = '';
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { killAll(); process.exit(130); });
try {
  await main();
} catch (error) {
  fatal = error.message;
  record('Abbruch', false, fatal.split('\n')[0]);
}
const ok = writeReport(fatal);
await cleanup();
console.log(`\n[verify] ${ok ? 'BESTANDEN' : 'FEHLGESCHLAGEN'} - Bericht: ${path.relative(repoRoot, path.join(reportDir, 'report.md'))}`);
process.exit(ok ? 0 : 1);
