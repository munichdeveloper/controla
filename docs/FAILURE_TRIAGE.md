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
`https://api.typesafe.ai/v1/systemone`, authenticating with a Bearer header.
The prototype wire contract sends exactly these fields:

```json
{"workflowId":"wf1","nodeType":"n8n-nodes-base.httpRequest","httpStatus":429,"errorCategory":"RATE_LIMIT","retry":true,"failureCount24h":1}
```

Missing metadata is `null`; unknown categories are `UNKNOWN`. Categories are
fixed enum values and node types come from the failing node's type, never its
display name. Messages, execution payloads, workflow JSON, credentials, URLs,
instance names and instance ids are excluded from the request body. Responses
must have the shape
`{"decision":"NOISE","confidence":0.8,"reasonCode":"transient_retry"}`.
Decisions are `ALERT`, `NOISE` or `UNSURE`; confidence must be finite and within
0–1; reason codes are short identifiers. Redirects are disabled. A one-second
deadline covers the entire HTTP response. Errors, invalid responses and
timeouts yield `UNSURE`; provider logs omit response bodies and exception text.

Each forwarded failure gets one `Failure triage shadow` log with `instanceId`
(the external id), `workflowId`, `decision`, `confidence`, `reasonCode` and
`actualAction=forwarded_to_alert_handler`. Provider/history failures may also
produce a warning. Observation failures never interrupt subsequent failures.

The configuration lives under `de.atstck.controla.alerts.triage`. Editions with
an explicit component-scan list must include that package (or its `alerts`
parent) to enable the prototype; the existing `InstanceService` constructor
remains compatible.
