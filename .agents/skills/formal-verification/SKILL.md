---
name: formal-verification
description: Verify Controla CE contracts, failure handling and state transitions with executable formal models. Use for proof obligations, model checking, counterexample analysis or reviewing changes against an existing model.
---

# Formal verification in Controla CE

Start from the affected entry point on the current branch. Read the root AGENTS.md for the CE/Premium boundary. Trace the caller, data normalization, persistence boundary, failure paths and existing tests before proposing a property. Record the revision and source symbols alongside each claim.

## Choose the boundary

| Starting point | Questions to resolve in code | Suitable method |
| --- | --- | --- |
| RuleBasedFailureTriageClassifier.classify, FailureSignal and docs/FAILURE_TRIAGE.md | Which normalized inputs trigger each decision? Which guard wins when two apply? | SMT over the decision function. Use the runnable example below. |
| InstanceService polling and N8nApiClient.fetchExecutionFailureCounts | Where do checkpoint updates, forwarding, pagination and deduplication occur? Which state survives retries, overlap or restart? | TLA+/TLC over a small explicit instance, execution and worker domain. Split actions wherever another worker or failure can intervene. |
| DefaultInstanceAlertHandler and the repository methods it calls | Which tenant supplies settings? Which flags and archived state permit a send attempt? What guarantees does the mail transport actually expose? | Relational model (Alloy) for ownership, or SMT/Java contracts for individual guards. Include two distinct owners when checking isolation. |

For permission changes, follow the actual controller, feature gate, tenant context and repository query. Inspect CE defaults and separate extension-point assumptions. Treat cross-instance isolation, at-most-once effects and eventual delivery as candidate requirements pending evidence. Resolve conflicts between behavior and requirements explicitly.

## Build and check a claim

1. Write the precondition, postcondition or transition invariant in domain terms. Identify the concrete action that could violate it. For progress properties state scheduling, fairness and external recovery assumptions.
2. Map state, inputs, guards and effects to symbols in the source. Declare initial states, null handling, bounds, atomic steps and omitted effects. Separate environment assumptions from obligations. In particular, modeling a send and checkpoint as one atomic step requires evidence.
3. Encode the property separately from the transition or decision model. Show its antecedent or triggering state is reachable. Run the checker with recorded versions, bounds and settings. For SMT seek a satisfying assignment to the negated property. For TLC record reachable states and completion; for bounded tools report scope or depth. Preserve unknown, timeout and incomplete results as inconclusive.
4. Save the smallest counterexample with input or action sequence, expected and observed result, command and revision. Replay at the closest implementation boundary. Classify the cause as code, model, requirement or an unresolved environment assumption before editing. Keep the original failing command and evidence in the change description.
5. Correct the affected artifact, rerun the original witness and full model, and retain a regression at the model or implementation boundary that failed. Record before/after results and any changes to assumptions. Use a path-filtered check for maintained models. Report solver evidence separately from implementation examples, tests and review.

## Executable example

From the repository root, use Python 3.12 and a JDK 17 with java and javac on PATH. Install the dependency in an active project virtual environment.

```sh
python -m pip install -r verification/failure-triage/requirements.txt
python verification/failure-triage/check.py
```

The baseline at CE revision `d1117715` maps the ordered guards in `RuleBasedFailureTriageClassifier.classify` to Z3 integer and Boolean expressions. The independent contract regions follow `docs/FAILURE_TRIAGE.md` and the precedence case in `RuleBasedFailureTriageClassifierTest`. For every non-null, already constructed signal the model returns:

| Precondition | Required decision |
| --- | --- |
| Known 24-hour failure count ≥ 3 | ALERT |
| Otherwise, retry and (HTTP 408/429/504 or category TIMEOUT/RATE_LIMIT) | NOISE |
| All remaining signals | UNSURE |

The domain covers null and every nonnegative Java Integer count, null and HTTP 100–599, all five normalized categories and both retry values. The encoding reserves −1 for null. Workflow ID and node type are omitted because the decision guards do not read them. The proof covers the decision label alone. Input extraction, history accuracy, confidence, reason codes, external providers, persistence, delivery and concurrent polling are outside the model.

Expected output is three reachable preconditions with UNSAT for their negated postconditions. A separate regression check compiles the four actual CE Java types and compares 300 representative combinations with model decisions. This finite comparison can detect drift; full Java-to-model equivalence remains open.

To exercise a failure, invert the model's branch priority, then replay the reported four fields on Java. The first command deliberately exits nonzero. One observed witness is shown below.

```sh
python verification/failure-triage/check.py --swap-priority
python verification/failure-triage/check.py --replay 3 -1 TIMEOUT true
python verification/failure-triage/check.py
```

For that witness the mutant produces NOISE while Java returns ALERT. Restoring count-first ordering in the model discharges the original obligation. This is a model mutation demonstration. The CE implementation already satisfies the example.
