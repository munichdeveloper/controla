const crypto = require('node:crypto');
const fs = require('node:fs');

const ISSUE_TITLE = '[Quality] Repository quality status';
const LABEL = 'quality';

function actionableFindings(report) {
  const findings = [];

  for (const [name, check] of Object.entries(report.checks || {})) {
    if (check.required && check.passed !== true) {
      findings.push({
        key: `required-check:${name}`,
        kind: 'required_check',
        message: `Required check \`${name}\` is ${check.status || 'not passing'}.`,
      });
    }
  }

  for (const vulnerability of report.dependencies?.frontend?.vulnerabilities || []) {
    if (['critical', 'high'].includes(vulnerability.severity)) {
      findings.push({
        key: `npm:${vulnerability.name}:${vulnerability.severity}`,
        kind: 'dependency_vulnerability',
        message: `${vulnerability.severity.toUpperCase()} npm vulnerability in \`${vulnerability.name}\`${vulnerability.direct ? ' (direct dependency)' : ''}.`,
      });
    }
  }

  for (const regression of report.comparison?.regressions || []) {
    const todoDelta = (regression.current ?? 0) - (regression.previous ?? 0);
    const relevant =
      (regression.kind === 'coverage_drop' && regression.delta <= -2) ||
      regression.kind === 'new_large_file' ||
      (regression.kind === 'todo_increase' && todoDelta >= 5) ||
      regression.kind === 'vulnerability_increase';
    if (relevant) {
      findings.push({
        key: `regression:${regression.kind}:${regression.metric || regression.file || regression.message}`,
        kind: regression.kind,
        message: regression.message,
      });
    }
  }

  return findings.sort((left, right) => left.key.localeCompare(right.key));
}

function signature(findings) {
  return crypto.createHash('sha256').update(JSON.stringify(findings.map((finding) => finding.key))).digest('hex').slice(0, 16);
}

function reportBody(report, findings, runUrl, currentSignature) {
  const coverage = report.coverage || {};
  const counts = report.dependencies?.frontend?.vulnerabilityCounts;
  const lines = [
    `<!-- quality-signature:${currentSignature} -->`,
    '# Repository Quality Status',
    '',
    'This is the single consolidated issue maintained by the periodic quality review. Do not create separate issues for every automated finding.',
    '',
    '## Current snapshot',
    '',
    `- Commit: \`${report.commit}\``,
    `- Backend line coverage: ${coverage.lines == null ? 'unavailable' : `${coverage.lines}%`}`,
    `- Backend branch coverage: ${coverage.branches == null ? 'unavailable' : `${coverage.branches}%`}`,
    `- Large source files: ${report.staticMetrics?.largeFiles?.length ?? 'unavailable'}`,
    `- TODO/FIXME markers: ${report.staticMetrics?.todos?.count ?? 'unavailable'}`,
    `- npm vulnerabilities: ${counts ? `${counts.total} total (${counts.critical} critical, ${counts.high} high)` : 'unavailable'}`,
    `- Outdated frontend dependencies: ${report.dependencies?.frontend?.outdated?.length ?? 'unavailable'}`,
    '',
    '## Findings requiring attention',
    '',
  ];

  if (findings.length === 0) lines.push('No findings currently meet the notification policy.');
  else findings.forEach((finding) => lines.push(`- ${finding.message}`));

  lines.push(
    '',
    '## Evidence',
    '',
    `- [Quality workflow run](${runUrl})`,
    '- Download `quality-report.json` and the supporting reports from the run artifacts.',
    '',
    '_The issue body is refreshed on every run. A comment is added only when the relevant finding set changes._',
  );
  return `${lines.join('\n')}\n`;
}

async function ensureLabel(github, context) {
  try {
    await github.rest.issues.getLabel({ ...context.repo, name: LABEL });
  } catch (error) {
    if (error.status !== 404) throw error;
    await github.rest.issues.createLabel({
      ...context.repo,
      name: LABEL,
      color: 'B60205',
      description: 'Consolidated automated repository quality findings',
    });
  }
}

async function findQualityIssue(github, context) {
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    ...context.repo,
    state: 'all',
    labels: LABEL,
    per_page: 100,
  });
  return issues.find((issue) => !issue.pull_request && issue.title === ISSUE_TITLE) || null;
}

module.exports = async function updateQualityIssue({ github, context, core }) {
  const report = JSON.parse(fs.readFileSync('quality-report.json', 'utf8'));
  const findings = actionableFindings(report);
  const currentSignature = signature(findings);
  const runId = process.env.GITHUB_RUN_ID;
  const runUrl = `${process.env.GITHUB_SERVER_URL}/${context.repo.owner}/${context.repo.repo}/actions/runs/${runId}`;

  await ensureLabel(github, context);
  const existing = await findQualityIssue(github, context);
  const body = reportBody(report, findings, runUrl, currentSignature);
  let issue = existing;
  let action = 'none';

  if (findings.length > 0 && !existing) {
    const response = await github.rest.issues.create({
      ...context.repo,
      title: ISSUE_TITLE,
      body,
      labels: [LABEL],
    });
    issue = response.data;
    action = 'created';
  } else if (findings.length > 0) {
    const oldSignature = existing.body?.match(/<!-- quality-signature:([a-f0-9]+) -->/)?.[1];
    const changed = oldSignature !== currentSignature;
    const reopened = existing.state === 'closed';
    const response = await github.rest.issues.update({
      ...context.repo,
      issue_number: existing.number,
      body,
      state: 'open',
      labels: [LABEL],
    });
    issue = response.data;
    action = reopened ? 'reopened' : changed ? 'updated' : 'refreshed';
    if (reopened || changed) {
      await github.rest.issues.createComment({
        ...context.repo,
        issue_number: existing.number,
        body: `Quality status changed in [workflow run ${runId}](${runUrl}). The issue body now contains the current consolidated findings.`,
      });
    }
  } else if (existing?.state === 'open') {
    await github.rest.issues.createComment({
      ...context.repo,
      issue_number: existing.number,
      body: `No findings meet the notification policy in [workflow run ${runId}](${runUrl}). Closing the consolidated quality issue.`,
    });
    const response = await github.rest.issues.update({
      ...context.repo,
      issue_number: existing.number,
      body,
      state: 'closed',
      state_reason: 'completed',
      labels: [LABEL],
    });
    issue = response.data;
    action = 'closed';
  }

  core.setOutput('issue-action', action);
  core.setOutput('issue-url', issue?.html_url || '');
  core.setOutput('finding-count', findings.length);
  core.summary.addHeading('Quality visibility', 2);
  if (issue) core.summary.addLink(`${ISSUE_TITLE} (${action})`, issue.html_url).addRaw(` — ${findings.length} relevant finding(s)`);
  else core.summary.addRaw('No relevant findings and no consolidated quality issue exists.');
  await core.summary.write();
};

module.exports.actionableFindings = actionableFindings;
module.exports.reportBody = reportBody;
