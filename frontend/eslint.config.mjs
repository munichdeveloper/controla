import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    // Keep existing mount-time initialization and form synchronization visible
    // without coupling the framework upgrade to a state-management refactor.
    rules: { 'react-hooks/set-state-in-effect': 'warn' },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'node/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**']),
]);
