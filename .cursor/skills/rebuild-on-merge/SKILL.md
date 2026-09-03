---
name: rebuild-on-merge
description: >-
  Every 5 minutes, check kishanraj41/hawkxai for PRs newly merged to main.
  If one landed, rebuild the HawkxAI image from that commit and refresh
  docker run. If none, skip. Use when looping /rebuild-on-merge, watching
  PR merges, or the user asks to rebuild after merge.
---

# /rebuild-on-merge

Watch `kishanraj41/hawkxai` for **new PR merges into `main`**. Rebuild only when one landed. Idle ticks are a skip.

Repo root: HawkxAI checkout (local folder may still be named `grokhackx`).

## 1. Detect

```bash
python3 .cursor/skills/rebuild-on-merge/scripts/new_merges.py
```

Run from the HawkxAI repo root. Needs `gh` + `git` (`required_permissions: ["full_network"]` or `["all"]`).

| stdout | meaning |
|---|---|
| `NO_NEW_MERGE` | Nothing merged since last check (or last 5 minutes on first run). **Stop. Do not docker build.** |
| JSON object | One or more new merges. Continue. |

State file (gitignored): `.cursor/skills/builddocker/.last-merge.json`.

## 2. Rebuild

Only after JSON with at least one merge:

1. `git fetch origin main`
2. Follow `.cursor/skills/builddocker/SKILL.md` in full — build **`origin/main`** (worktree if this branch is dirty / not main), then replace the `hawkxai` container. Reuse the existing host port.
3. The detect script writes `.last-merge.json` before you build. **If the docker build fails, restore `sha` in that file to JSON `previous_sha`** so the next tick retries.

## 3. Report

- Skip: `No new PR merge.` plus the recorded SHA.
- Rebuild: PR number(s), title(s), image tags, URL (`http://localhost:<port>`).

## Do not

- Rebuild on an empty tick.
- `git push` or merge PRs.
- Print `GOOGLE_API_KEY`.
- Duplicate this loop (sentinel `AGENT_LOOP_TICK_rebuild_on_merge`).
