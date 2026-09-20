# retell-llm-bench

An offline test bench for Retell custom-LLM servers: a CLI that plays the Retell side of the custom-LLM WebSocket protocol against any server, runs a scenario suite, and prints a results table (time to first sentence, `content_complete` discipline, tool calls missing / unnecessary / duplicate, transcript diffs). It answers a gap Retell's own docs name: custom-LLM agents cannot use the playground, simulation, or batch testing, so "Web and phone calls are the only way to test" (https://docs.retellai.com/integrate-llm/overview). Ships with a small Claude reference server so the bench runs out of the box.

Built by Koushik Karthikeyan as a skills demonstration for the Forward Deployed Engineer role (https://www.workatastartup.com/jobs/109576). Every line is owned and understood by the author.

## Commands
- Install: `npm install`
- Test: `npm test` (vitest, all files); one file: `npx vitest run tests/<name>.test.ts`; one test: `npx vitest run tests/<name>.test.ts -t "<name>"`
- Typecheck: `npm run typecheck` (`tsc --noEmit`)
- Reference server (port 3217, needs `ANTHROPIC_API_KEY` in `.env.local`): `npm run server` (or `npm run server -- --port 3219`)
- Fake scripted server (port 3218, no key): `npm run fake`
- Bench: `npm run bench` (defaults to `ws://127.0.0.1:3217/llm-websocket`); flags `--url <ws-url> --scenarios <dir> --runs <n> --json <file>`, e.g. `npm run bench -- --url ws://127.0.0.1:3218/llm-websocket --runs 3 --json out.json`
- Smoke run (in-process fake, no key) → `docs/smoke.txt`: `npm run smoke`
- Results run (needs `ANTHROPIC_API_KEY` in `.env.local`; starts the reference server in-process on a free port; 3 runs per scenario) → `docs/results.json`, `docs/results.md`: `npm run results`; re-render the markdown from the JSON: `npx tsx src/bench/results-md.ts docs/results.json docs/results.md`
- Replay page for the GIF → `docs/replay.html`: `npm run replay`
- Readiness wait (no `sleep`): `npx tsx scripts/wait-ws.ts ws://127.0.0.1:3217/llm-websocket/probe`

## Stack and versions
- TypeScript 5.9.3 on Node 22.23.2 (ESM, `"type": "module"`, run with tsx 4.20.6, `module: nodenext`), ws 8.18.3 (+ @types/ws 8.18.1), zod 4.1.12, yaml 2.8.1, vitest 4.1.6, @types/node 22.18.6, @anthropic-ai/sdk 0.110.0 (reference server only: `messages.stream`, model `claude-sonnet-5`, `max_tokens: 300`, `thinking: { type: 'disabled' }`, no sampling parameters because Sonnet 5 rejects non-default ones). No diff library (hand-written `src/bench/diff.ts`). Exact pins, no `^`; Task 1 re-verifies each with `npm view` and records any substitution in TRACKER. Ports: reference 3217, fake 3218, tests 0.

## Layout
- `src/bench/`: the Retell-side protocol driver (WebSocket client, message schemas, scenario runner, scoring, results table)
- `src/server/`: the bundled reference custom-LLM server (Claude, streaming, tools) and a scripted fake server used by tests with no key
- `scenarios/`: YAML scenario files
- `tests/`: vitest unit and integration tests; `docs/smoke.txt` is the scripted smoke run
- `docs/superpowers/specs/` (spec), `docs/superpowers/plans/` (plan), `docs/plan-review.md`, `docs/api-notes.md`, `docs/results.md`
- `TRACKER.md`: task list and status; the session running the build updates it, subagents do not

## Rules for agents working in this repo
1. Read `TRACKER.md` and the task you were given before touching code. Do only that task.
2. Test first: write the failing test, make it pass, refactor, stop. No code without a test unless the task says "no test" and why.
3. Never write code against a library API or the Retell protocol from memory. Use Context7 or `docs/api-notes.md`; if the answer is not there, say so in the report instead of guessing.
4. No secrets in the repo. Read keys from env vars; keep `.env.example` current.
5. Boring, readable code. Match the conventions already in the repo. No new dependencies unless the task lists them.
6. Do not push, deploy, open PRs, or touch anything outside this directory. Never call Retell's hosted API; the bench talks only to a local WebSocket server.
7. Report at the end: files changed, test command and result, anything you could not verify, anything that surprised you.

## Scope
- In: a CLI that opens `ws://<host>/llm-websocket/<call_id>`, sends the protocol's config and call-start messages, `response_required`, `update_only` interruptions, `reminder_required`, discard-and-re-ask with a new `response_id`, and `ping_pong`; a YAML scenario suite (at least 8 scenarios); a results table with time-to-first-sentence P50/P90, `content_complete` always sent, tool calls fired vs expected (missing / unnecessary / duplicate), transcript diffs; a reference Claude server with two tools and idempotent booking; a scripted fake server so tests and the bench run with no key; README with the results table and "what I'd add next"; a 60-second GIF of a bench run.
- Out: a Retell account or any call to Retell's hosted API; a real phone or web call; LLM-judge grading; a UI; more than two tools in the reference server. Left out on purpose and said so in the README.
