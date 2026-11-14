// Probe the frontend and the real backend through Next.js's /api rewrite.
const base = `http://127.0.0.1:${process.env.PORT || 3000}`;
try {
  const ui = await fetch(`${base}/login`, { signal: AbortSignal.timeout(4000) });
  if (!ui.ok || !(await ui.text()).includes('Controla')) throw new Error('UI unavailable');
  const api = await fetch(`${base}/api/license`, { signal: AbortSignal.timeout(4000) });
  if (!api.ok || typeof (await api.json()).edition !== 'string') throw new Error('API unavailable');
} catch {
  console.error('Controla UI/API health check failed');
  process.exit(1);
}
