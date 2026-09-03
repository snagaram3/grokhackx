#!/usr/bin/env python3
"""Print new PRs merged to main since last check. Exit 0 always.

Run from anywhere; git/gh target kishanraj41/hawkxai.

stdout:
  NO_NEW_MERGE
  or JSON {previous_sha, sha, prs:[...]}
"""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = "kishanraj41/hawkxai"
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
STATE = HERE.parent.parent / "builddocker" / ".last-merge.json"
LOOKBACK = timedelta(minutes=5)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_gh_time(value: str) -> datetime:
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    return datetime.fromisoformat(value)


def run(cmd: list[str]) -> str:
    result = subprocess.run(
        cmd,
        cwd=str(ROOT),
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        sys.stderr.write(result.stderr or f"command failed: {' '.join(cmd)}\n")
        sys.exit(result.returncode or 1)
    return (result.stdout or "").strip()


def load_state() -> dict:
    if not STATE.is_file():
        return {}
    try:
        return json.loads(STATE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def save_state(payload: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    run(["git", "fetch", "origin", "main"])
    sha = run(["git", "rev-parse", "origin/main"])
    raw = run(
        [
            "gh",
            "pr",
            "list",
            "--repo",
            REPO,
            "--state",
            "merged",
            "--base",
            "main",
            "--limit",
            "10",
            "--json",
            "number,title,mergedAt,url,mergeCommit",
        ]
    )
    prs = json.loads(raw) if raw else []
    state = load_state()
    previous_sha = state.get("sha") or ""
    checked_at = state.get("checked_at")
    if checked_at:
        try:
            since = parse_gh_time(checked_at)
        except ValueError:
            since = utc_now() - LOOKBACK
    else:
        since = utc_now() - LOOKBACK

    new = []
    for pr in prs:
        merged_at = pr.get("mergedAt") or ""
        try:
            when = parse_gh_time(merged_at)
        except ValueError:
            continue
        if when <= since:
            continue
        oid = ((pr.get("mergeCommit") or {}).get("oid")) or ""
        new.append(
            {
                "number": pr.get("number"),
                "title": pr.get("title"),
                "mergedAt": merged_at,
                "url": pr.get("url"),
                "oid": oid,
            }
        )

    main_moved = bool(previous_sha) and sha != previous_sha
    if not new and not main_moved:
        save_state({"sha": sha, "checked_at": utc_now().strftime("%Y-%m-%dT%H:%M:%SZ"), "prs": []})
        print("NO_NEW_MERGE")
        return 0

    if not new and main_moved:
        new.append(
            {
                "number": None,
                "title": "origin/main advanced",
                "mergedAt": utc_now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "url": f"https://github.com/{REPO}/commit/{sha}",
                "oid": sha,
            }
        )

    payload = {
        "previous_sha": previous_sha,
        "sha": sha,
        "checked_at": utc_now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "prs": new,
    }
    save_state(payload)
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
