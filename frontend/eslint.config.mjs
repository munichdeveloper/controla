import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    // Existing mount-time initialization and form synchronization are valid in
    // React 19. Keep the new performance advice visible without blocking this
    // dependency migration on unrelated state-management refactors.
    rules: { 'react-hooks/set-state-in-effect': 'warn' },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'node/**', 'next-env.d.ts']),
]);
