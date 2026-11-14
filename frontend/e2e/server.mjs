import { cp, access } from 'node:fs/promises';

// Use the same standalone output and static asset layout as the Docker image.
await cp('.next/static', '.next/standalone/.next/static', { recursive: true });
try {
  await access('public');
  await cp('public', '.next/standalone/public', { recursive: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
process.env.HOSTNAME = '127.0.0.1';
process.env.PORT = '3027';
await import('../.next/standalone/server.js');
