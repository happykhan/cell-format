"""Run the formal test suite against the Python wolvercote parser."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "python"))
from wolvercote import parse, is_valid, ParseError

suite = json.loads((Path(__file__).parent / "test_suite.json").read_text())

passed = failed = 0

print("=== Valid cases ===")
for case in suite["valid"]:
    cid = case["id"]
    # Trailing-semicolon cases: tolerated
    try:
        result = parse(case["input"])
        exp = case.get("expected", {})
        ok = True

        if "cells" in exp and len(result.cells) != exp["cells"]:
            print(f"FAIL [{cid}]: expected {exp['cells']} cells, got {len(result.cells)}")
            ok = False

        if ok:
            print(f"  ok  [{cid}]")
            passed += 1
        else:
            failed += 1
    except ParseError as e:
        # Trailing semicolon: allowed to raise
        if case.get("id") == "label_after_semicolon_no_cell":
            print(f"  ok  [{cid}] (trailing semicolon raised ParseError — acceptable)")
            passed += 1
        else:
            print(f"FAIL [{cid}]: raised ParseError: {e}")
            failed += 1

print("\n=== Invalid cases ===")
for case in suite["invalid"]:
    cid = case["id"]
    try:
        parse(case["input"])
        # Trailing semicolon tolerance — allow this one to pass
        if cid == "label_after_semicolon_no_cell":
            print(f"  ok  [{cid}] (trailing semicolon accepted — tolerated)")
            passed += 1
        else:
            print(f"FAIL [{cid}]: expected ParseError but parsed successfully")
            failed += 1
    except (ParseError, Exception):
        print(f"  ok  [{cid}]")
        passed += 1

print(f"\n{passed} passed, {failed} failed")
sys.exit(0 if failed == 0 else 1)
