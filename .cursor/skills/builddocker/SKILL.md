---
name: builddocker
description: >-
  Builds the HawkxAI Dockerfile and updates docker run so the running
  container matches the new image. Use when the user invokes /builddocker,
  asks to docker build, rebuild the image, or refresh the running container.
  After a PR merge to main, follow the merge-watch path (see rebuild-on-merge).
disable-model-invocation: true
---

# /builddocker

build the dockerfile and update docker run

Run this from the HawkxAI repo root (`Dockerfile` lives there). Do both steps every time — never build without replacing the running container, and never restart an old image.

On a `/loop` tick, first follow [rebuild-on-merge](../rebuild-on-merge/SKILL.md). Only continue here if that skill reports a new merge.

## 1. Build the Dockerfile

Build **`origin/main` after the merge**, not a dirty feature branch.

```bash
git fetch origin main
docker build -t hawkxai:latest -t hawkxai:ci .
```

If the working tree is not on `main` (or is dirty), use a detached worktree so the image matches what just merged:

```bash
git fetch origin main
WT="/tmp/hawkxai-rebuild-$$"
git worktree add --detach "$WT" origin/main
docker build -t hawkxai:latest -t hawkxai:ci "$WT"
git worktree remove --force "$WT"
```

Use `required_permissions: ["all"]` (Docker socket). `block_until_ms` at least 600000. Fail the skill if the build fails.

Tags: `hawkxai:latest` (run) and `hawkxai:ci` (CI agent). Same image.

## 2. Update docker run

1. Reuse the host port already published by `hawkxai` (`docker port hawkxai 3000/tcp`). If none, pick the first free port in **3001–3005**. Host **:3000** is often Grafana; `:3001` is often `next dev` — skip taken ports.
2. If a container named `hawkxai` exists, `docker stop hawkxai` (and `docker rm` if it is not `--rm`).
3. Load `GOOGLE_API_KEY` from the **repo** `.env.local` (gitignored), even when the build used a worktree. Do not print the key. If missing, still run the container; Ask/Gemini will degrade.
4. Start (substitute `$PORT`):

```bash
docker run -d --name hawkxai --rm -p ${PORT}:3000 --env-file .env.local hawkxai:latest
```

If `.env.local` is absent:

```bash
docker run -d --name hawkxai --rm -p ${PORT}:3000 hawkxai:latest
```

5. Confirm `docker ps --filter name=hawkxai` is Up. Report the URL (`http://localhost:<host-port>`).

If the user's terminal already has a foreground `docker run --rm`, stopping `hawkxai` will end that process — that is expected; the detached replacement is the update.

## Do not

- Bind host `:3000` unless the user asked and Grafana is gone.
- Pass `GOOGLE_API_KEY=your-real-key` (placeholder).
- Echo secrets.
- Skip the restart after a cache-hit build — the run still needs to match `latest`.
- Rebuild on a 5-minute tick when no PR merged — that is a skip, not a build.
