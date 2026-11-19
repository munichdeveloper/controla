# Shadow failure triage

Failure triage is an opt-in backend prototype. Every failed execution continues
to be forwarded to `InstanceAlertHandler.handleWorkflowError`. A decision never
suppresses, delays, adds or routes an alert. The logged actual action means the
handler was called; its own settings may still prevent a notification.

Configuration properties (environment variable equivalents in parentheses):

| Property | Default | Purpose |
| --- | --- | --- |
| `controla.triage.enabled` (`CONTROLA_TRIAGE_ENABLED`) | `false` | Enable shadow observation and its logs. |
| `controla.triage.provider` (`CONTROLA_TRIAGE_PROVIDER`) | `rules` | `rules` or `jev`. |
| `controla.triage.jev.api-key` (`CONTROLA_TRIAGE_JEV_API_KEY`) | empty | Required to activate the external adapter. |
| `controla.triage.jev.model` (`CONTROLA_TRIAGE_JEV_MODEL`) | `jev-latest` | Model sent to TypeSafe System One. |
| `controla.triage.jev.timeout-ms` (`CONTROLA_TRIAGE_JEV_TIMEOUT_MS`) | `5000` | Deadline for the entire Jev HTTP call. Triage runs after alerts are forwarded, so it never delays alerting. |

When disabled, no classifier or observer is created, no metadata is extracted,
no history requests are added, and no triage logs are emitted. A custom
`FailureTriageClassifier` bean can replace the default implementation.

The local rules label three or more failures of the same workflow in the last
24 hours `ALERT`. Otherwise, HTTP 429, 408, 504 or a timeout/rate-limit category
on a retry yields `NOISE`. Other signals yield `UNSURE`. These are experimental
heuristics, not evidence that a retry succeeded.

For a nonempty polling batch, triage fetches lightweight failed-execution
history (`includeData=false`), following cursors until the 24-hour window ends.
Counts are scoped to the monitored instance, deduplicated by execution id and
include the failed execution itself when it is in that window. Counts reflect
the executions retained by n8n; history errors leave counts unknown (`null`).
The normal polling window, batch size and alert-handler arguments are unchanged.
Shadow work starts after all failures have been forwarded and the polling
checkpoint has advanced, so failures arriving during classification remain
eligible for the next poll.

Jev is activated only with the flag, `provider=jev` and a nonblank API key.
Without its key it yields `UNSURE` with `provider_not_configured`, making no
external requests. The adapter posts JSON to the fixed endpoint
`https://api.typesafe.ai/v1/systemone`, authenticating with the API key in the
standard HTTP `Authorization` header (Bearer token scheme). The request body is
a System One call with one `choice` question named `triage` (options `ALERT`
and `NOISE`, with German/English criteria):

```json
{"model":"jev-latest","state":"Workflow id: wf1\nNode type: n8n-nodes-base.httpRequest\nHTTP status: 429\nError category: RATE_LIMIT\nRetry: true\nFailures in last 24 h: 1",
 "questions":{"triage":{"type":"choice","instructions":"...","criteria":{"ALERT":"...","NOISE":"..."}}}}
```

`state` is a short text rendering of the metadata-only signal; missing values
render as `unknown`. Messages, execution payloads, workflow JSON, credentials,
URLs, instance names and instance ids are excluded from the request body.
The response is read from `answers.triage`:
`{"model":"...","answers":{"triage":{"choice":"NOISE","confidence":0.82,"probabilities":{}}},"usage":{}}`.
`choice` `ALERT`/`NOISE` becomes the decision, `confidence` (finite, 0–1) the
confidence and `jev_choice` the reason code. A missing or invalid answer yields
`UNSURE` (`jev_invalid_answer`). Redirects are disabled. The configured
timeout covers the entire HTTP response. Errors, invalid responses and
timeouts yield `UNSURE`; provider logs omit response bodies and exception text.

Each forwarded failure gets one `Failure triage shadow` log with `instanceId`
(the external id), `workflowId`, `decision`, `confidence`, `reasonCode` and
`actualAction=forwarded_to_alert_handler`. Provider/history failures may also
produce a warning. Observation failures never interrupt subsequent failures.

The configuration lives under `de.atstck.controla.alerts.triage`. Editions with
an explicit component-scan list must include that package (or its `alerts`
parent) to enable the prototype; the existing `InstanceService` constructor
remains compatible.
