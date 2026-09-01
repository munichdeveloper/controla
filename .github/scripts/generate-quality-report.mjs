import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

if (args.has('--enforce-report')) {
  const existingReport = readJson(path.resolve(root, args.get('--enforce-report')));
  if (!existingReport?.checks) {
    console.error('Cannot enforce quality policy: report is missing or invalid.');
    process.exit(1);
  }
  const failed = Object.entries(existingReport.checks).filter(([, check]) => check.required && check.passed !== true);
  if (failed.length > 0) {
    console.error(`Required quality checks failed or did not run: ${failed.map(([name]) => name).join(', ')}`);
    process.exit(1);
  }
  console.log('All required quality checks passed.');
  process.exit(0);
}

function outcome(name, options = {}) {
  const value = process.env[name] || 'not_run';
  return {
    status: value,
    passed: value === 'success' ? true : value === 'failure' ? false : null,
    required: options.required ?? false,
    available: options.available ?? true,
  };
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(item) : [item];
  });
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function sourceMetrics() {
  const extensions = new Set(['.java', '.js', '.jsx', '.ts', '.tsx']);
  const files = [
    ...walk(path.join(root, 'backend', 'src')),
    ...walk(path.join(root, 'frontend', 'src')),
  ].filter((file) => extensions.has(path.extname(file)));

  const largeFiles = [];
  const todoFiles = [];
  let todoCount = 0;
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/).length;
    if (lines > 400) largeFiles.push({ path: relative(file), lines });
    const count = (content.match(/\b(?:TODO|FIXME)\b/g) || []).length;
    if (count > 0) todoFiles.push({ path: relative(file), count });
    todoCount += count;
  }
  return {
    filesScanned: files.length,
    largeFiles: largeFiles.sort((a, b) => b.lines - a.lines),
    todos: { count: todoCount, files: todoFiles.sort((a, b) => b.count - a.count) },
  };
}

function jacocoCoverage() {
  const file = path.join(root, 'backend', 'target', 'site', 'jacoco', 'jacoco.xml');
  if (!fs.existsSync(file)) return { available: false, lines: null, branches: null, source: null };
  const xml = fs.readFileSync(file, 'utf8');
  const counters = [...xml.matchAll(/<counter type="(LINE|BRANCH)" missed="(\d+)" covered="(\d+)"\/>/g)];
  const totals = {};
  for (const match of counters) totals[match[1]] = { missed: Number(match[2]), covered: Number(match[3]) };
  const percentage = (counter) => {
    if (!counter || counter.missed + counter.covered === 0) return null;
    return Number(((100 * counter.covered) / (counter.missed + counter.covered)).toFixed(2));
  };
  return {
    available: Boolean(totals.LINE),
    lines: percentage(totals.LINE),
    branches: percentage(totals.BRANCH),
    source: 'backend/target/site/jacoco/jacoco.xml',
  };
}

function frontendDependencies() {
  const audit = readJson(path.join(root, 'quality-inputs', 'npm-audit.json'), {});
  const outdated = readJson(path.join(root, 'quality-inputs', 'npm-outdated.json'), {});
  const vulnerabilities = Object.entries(audit.vulnerabilities || {}).map(([name, finding]) => ({
    name,
    severity: finding.severity || 'unknown',
    direct: Boolean(finding.isDirect),
  }));
  return {
    auditAvailable: Boolean(audit.metadata || audit.vulnerabilities),
    vulnerabilityCounts: audit.metadata?.vulnerabilities || null,
    vulnerabilities,
    outdated: Object.entries(outdated || {}).map(([name, versions]) => ({ name, ...versions })),
  };
}

function compare(report, baseline) {
  if (!baseline) return { available: false, baselineCommit: null, regressions: [] };
  const regressions = [];
  const add = (kind, message, details = {}) => regressions.push({ kind, severity: 'informational', message, ...details });

  for (const [name, check] of Object.entries(report.checks)) {
    if (check.passed === false && baseline.checks?.[name]?.passed === true) {
      add('check_failed', `${name} changed from passing to failing`, { check: name });
    }
  }
  for (const metric of ['lines', 'branches']) {
    const current = report.coverage[metric];
    const previous = baseline.coverage?.[metric];
    if (current != null && previous != null && current < previous) {
      add('coverage_drop', `Backend ${metric} coverage dropped from ${previous}% to ${current}%`, {
        metric, previous, current, delta: Number((current - previous).toFixed(2)),
      });
    }
  }
  const previousTodos = baseline.staticMetrics?.todos?.count;
  if (previousTodos != null && report.staticMetrics.todos.count > previousTodos) {
    add('todo_increase', `TODO/FIXME count increased from ${previousTodos} to ${report.staticMetrics.todos.count}`, {
      previous: previousTodos, current: report.staticMetrics.todos.count,
    });
  }
  const oldLargeFiles = new Set((baseline.staticMetrics?.largeFiles || []).map((item) => item.path));
  for (const item of report.staticMetrics.largeFiles) {
    if (!oldLargeFiles.has(item.path)) add('new_large_file', `New oversized source file: ${item.path} (${item.lines} lines)`, { file: item.path });
  }
  const previousVulnerabilities = baseline.dependencies?.frontend?.vulnerabilities?.length;
  const currentVulnerabilities = report.dependencies.frontend.vulnerabilities.length;
  if (previousVulnerabilities != null && currentVulnerabilities > previousVulnerabilities) {
    add('vulnerability_increase', `Frontend vulnerability findings increased from ${previousVulnerabilities} to ${currentVulnerabilities}`);
  }
  return { available: true, baselineCommit: baseline.commit || null, regressions };
}

function statusLabel(check) {
  if (!check.available) return 'NOT CONFIGURED';
  if (check.passed === true) return 'PASS';
  if (check.passed === false) return 'FAIL';
  return check.status.toUpperCase();
}

function markdown(report) {
  const lines = [
    '# Repository Quality Review', '',
    `Commit: \`${report.commit}\``, '',
    '## Deterministic checks', '',
    '| Check | Result | Policy |', '|---|---:|---|',
  ];
  for (const [name, check] of Object.entries(report.checks)) {
    lines.push(`| ${name} | ${statusLabel(check)} | ${check.required ? 'required' : 'informational'} |`);
  }
  lines.push('', '## Repository metrics', '');
  lines.push(`- Backend line coverage: ${report.coverage.lines == null ? 'unavailable' : `${report.coverage.lines}%`}`);
  lines.push(`- Backend branch coverage: ${report.coverage.branches == null ? 'unavailable' : `${report.coverage.branches}%`}`);
  lines.push(`- Large source files (>400 lines): ${report.staticMetrics.largeFiles.length}`);
  lines.push(`- TODO/FIXME markers: ${report.staticMetrics.todos.count}`);
  lines.push(`- Frontend vulnerability findings: ${report.dependencies.frontend.vulnerabilities.length}`);
  lines.push(`- Outdated frontend dependencies: ${report.dependencies.frontend.outdated.length}`);
  lines.push('', '## Regressions', '');
  if (!report.comparison.available) lines.push('No previous cached report was available; this run establishes the baseline.');
  else if (report.comparison.regressions.length === 0) lines.push('No measured regressions detected.');
  else report.comparison.regressions.forEach((item) => lines.push(`- ${item.message}`));
  lines.push('', '## Relevant findings', '');
  if (report.staticMetrics.largeFiles.length === 0 && report.dependencies.frontend.vulnerabilities.length === 0) {
    lines.push('No large-file or dependency-security findings.');
  } else {
    report.staticMetrics.largeFiles.forEach((item) => lines.push(`- Large file: \`${item.path}\` (${item.lines} lines)`));
    report.dependencies.frontend.vulnerabilities.forEach((item) => lines.push(`- ${item.severity} npm vulnerability: \`${item.name}\`${item.direct ? ' (direct)' : ''}`));
  }
  return `${lines.join('\n')}\n`;
}

const outputJson = path.resolve(root, args.get('--output-json') || 'quality-report.json');
const outputMarkdown = path.resolve(root, args.get('--output-md') || 'quality-report.md');
const baselinePath = args.get('--baseline') ? path.resolve(root, args.get('--baseline')) : null;
const metrics = sourceMetrics();
const report = {
  schemaVersion: 1,
  timestamp: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || process.env.QUALITY_COMMIT || 'local',
  checks: {
    backendBuildAndTests: outcome('QUALITY_BACKEND_VERIFY_OUTCOME', { required: true }),
    frontendBuild: outcome('QUALITY_FRONTEND_BUILD_OUTCOME', { required: true }),
    frontendLint: outcome('QUALITY_FRONTEND_LINT_OUTCOME', { required: true }),
    frontendTypeCheck: outcome('QUALITY_FRONTEND_TYPECHECK_OUTCOME', { required: true }),
    backendCheckstyle: outcome('QUALITY_BACKEND_LINT_OUTCOME'),
    frontendTests: { status: 'not_configured', passed: null, required: false, available: false },
  },
  build: {
    backendPassed: process.env.QUALITY_BACKEND_VERIFY_OUTCOME === 'success',
    frontendPassed: process.env.QUALITY_FRONTEND_BUILD_OUTCOME === 'success',
    passed: process.env.QUALITY_BACKEND_VERIFY_OUTCOME === 'success' && process.env.QUALITY_FRONTEND_BUILD_OUTCOME === 'success',
  },
  tests: {
    backendPassed: process.env.QUALITY_BACKEND_VERIFY_OUTCOME === 'success',
    frontend: { available: false, passed: null, reason: 'No frontend test script is configured.' },
    passed: process.env.QUALITY_BACKEND_VERIFY_OUTCOME === 'success',
  },
  linting: {
    frontendPassed: process.env.QUALITY_FRONTEND_LINT_OUTCOME === 'success',
    backendPassed: process.env.QUALITY_BACKEND_LINT_OUTCOME === 'success',
    backendRequired: false,
  },
  typeChecking: {
    frontendPassed: process.env.QUALITY_FRONTEND_TYPECHECK_OUTCOME === 'success',
    backend: 'javac compilation during backend verification',
  },
  coverage: jacocoCoverage(),
  complexity: { available: false, average: null, highComplexityItems: [], reason: 'No complexity analyzer is configured.' },
  duplication: { available: false, percentage: null, reason: 'No duplication analyzer is configured.' },
  staticMetrics: metrics,
  dependencies: {
    frontend: frontendDependencies(),
    backend: { available: false, reason: 'No backend vulnerability analyzer is configured.' },
  },
  comparison: null,
  failurePolicy: {
    requiredChecks: ['backendBuildAndTests', 'frontendBuild', 'frontendLint', 'frontendTypeCheck'],
    informational: ['backendCheckstyle', 'coverage', 'largeFiles', 'todos', 'dependencies', 'regressions'],
  },
  aiReview: {
    performed: false,
    architectureDocuments: ['doc-meta/system.yaml', 'docs/04_decisions/README.md', 'docs/04_decisions/ADR-001-single-container-deployment.md'],
    repositoryConventions: ['.github/copilot-instructions.md', 'CONTRIBUTING.md'],
    candidateFiles: [],
    instruction: 'Review only documented architecture, coupling, duplicated responsibilities, oversized modules, abstractions, dead code, and missing critical tests; ignore undocumented style preferences.',
  },
};
const baseline = baselinePath ? readJson(baselinePath) : null;
report.comparison = compare(report, baseline);
report.aiReview.candidateFiles = [...new Set([
  ...report.staticMetrics.largeFiles.map((item) => item.path),
  ...report.comparison.regressions.map((item) => item.file).filter(Boolean),
])];

fs.writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(outputMarkdown, markdown(report));

const failed = Object.entries(report.checks).filter(([, check]) => check.required && check.passed !== true);
if (args.has('--enforce') && failed.length > 0) {
  console.error(`Required quality checks failed or did not run: ${failed.map(([name]) => name).join(', ')}`);
  process.exitCode = 1;
}
