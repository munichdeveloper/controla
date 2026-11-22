"""Prove the shadow decision contract and compare the model with CE Java."""

import argparse
from itertools import product
from pathlib import Path
import subprocess
import tempfile

import z3


HERE = Path(__file__).resolve().parent
PACKAGE = "de/atstck/controla/alerts/triage"
JAVA = HERE.parents[1] / "backend/src/main/java" / PACKAGE
CATEGORIES = ["TIMEOUT", "RATE_LIMIT", "AUTHENTICATION", "OTHER", "UNKNOWN"]
ALERT, NOISE, UNSURE = range(3)
LABELS = ["ALERT", "NOISE", "UNSURE"]
MAX_COUNT = 2**31 - 1
# -1 encodes null in both integer fields, outside both normalized domains.
count, status, category = z3.Ints("count status category")
retry = z3.Bool("retry")
domain = z3.And(count >= -1, count <= MAX_COUNT,
                z3.Or(status == -1, z3.And(status >= 100, status <= 599)),
                category >= 0, category < len(CATEGORIES))


def classify(n, http, cat, again, swap):
    # Branch order of RuleBasedFailureTriageClassifier.classify.
    transient_retry = z3.And(again, z3.Or(http == 429, cat == 1, cat == 0,
                                          http == 408, http == 504))
    if swap:
        return z3.If(transient_retry, NOISE, z3.If(n >= 3, ALERT, UNSURE))
    return z3.If(n >= 3, ALERT, z3.If(transient_retry, NOISE, UNSURE))


def render(n, http, cat, again):
    return f"{n} {http} {CATEGORIES[cat]} {str(again).lower()}"


def prove(swap):
    decision = classify(count, status, category, retry, swap)
    # Disjoint contract regions from docs/FAILURE_TRIAGE.md.
    transient = z3.Or(status == 408, status == 429, status == 504,
                      category == CATEGORIES.index("RATE_LIMIT"),
                      category == CATEGORIES.index("TIMEOUT"))
    obligations = [
        ("persistent", count >= 3, ALERT),
        ("transient retry", z3.And(count < 3, retry, transient), NOISE),
        ("remaining", z3.And(count < 3, z3.Or(z3.Not(retry), z3.Not(transient))), UNSURE),
    ]
    for name, precondition, expected in obligations:
        solver = z3.Solver()
        solver.add(domain, precondition)
        if solver.check() != z3.sat:
            raise RuntimeError(f"Unreachable or undecided precondition: {name}")
        solver.add(decision != expected)
        result = solver.check()
        if result == z3.sat:
            m = solver.model()
            values = [m.eval(v, model_completion=True) for v in (count, status, category, retry)]
            case = render(*(v.as_long() for v in values[:3]), z3.is_true(values[3]))
            actual = m.eval(decision).as_long()
            raise SystemExit(f"SAT {name}: {case}; expected {LABELS[expected]}, model {LABELS[actual]}")
        if result != z3.unsat:
            raise RuntimeError(solver.reason_unknown())
        print(f"UNSAT {name} (precondition reachable)", flush=True)


def run_java(rows):
    classes = ["FailureSignal", "TriageDecision", "FailureTriageClassifier",
               "RuleBasedFailureTriageClassifier"]
    with tempfile.TemporaryDirectory() as build:
        subprocess.run(["javac", "--release", "17", "-d", build,
                        *(str(JAVA / f"{c}.java") for c in classes),
                        str(HERE / "Replay.java")], check=True)
        run = subprocess.run(["java", "-cp", build, "Replay"], check=True,
                             input="\n".join(rows), capture_output=True, text=True)
    actual = run.stdout.splitlines()
    if len(actual) != len(rows):
        raise RuntimeError(f"Java returned {len(actual)} decisions for {len(rows)} rows")
    return actual


def compare_java():
    rows = []
    expected = []
    for n, http, cat, again in product(
        [-1, 0, 2, 3, MAX_COUNT], [-1, 100, 408, 429, 504, 599],
        range(len(CATEGORIES)), [False, True]
    ):
        rows.append(render(n, http, cat, again))
        expected.append(LABELS[z3.simplify(classify(n, http, cat, again, False)).as_long()])
    actual = run_java(rows)
    for row, model, java in zip(rows, expected, actual):
        if java != model:
            raise SystemExit(f"Java mismatch: {row}; model {model}, Java {java}")
    print(f"Java agrees on {len(rows)} representative inputs")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--swap-priority", action="store_true",
                        help="mutate the model to demonstrate a counterexample")
    parser.add_argument("--replay", nargs=4, metavar=("COUNT", "HTTP", "CATEGORY", "RETRY"),
                        help="run a solver witness through the Java classifier")
    args = parser.parse_args()
    if args.replay:
        print(run_java([" ".join(args.replay)])[0])
    else:
        prove(args.swap_priority)
        compare_java()
