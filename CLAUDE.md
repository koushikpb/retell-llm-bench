# retell-llm-bench

An offline test bench for Retell custom-LLM servers: a CLI that plays the Retell side of the custom-LLM WebSocket protocol against any server, runs a scenario suite, and prints a results table (time to first sentence, `content_complete` discipline, tool calls missing / unnecessary / duplicate, transcript diffs). It answers a gap Retell's own docs name: custom-LLM agents cannot use the playground, simulation, or batch testing, so "Web and phone calls are the only way to test" (https://docs.retellai.com/integrate-llm/overview). Ships with a small Claude reference server so the bench runs out of the box.

Built by Koushik Karthikeyan as a skills demonstration for the Forward Deployed Engineer role (https://www.workatastartup.com/jobs/109576). Every line is owned and understood by the author.

## Commands
- Install: TBD (planner fills in; expected `npm install`)
- Test: TBD (expected `npm test`)
- Run: TBD (expected `npm run bench` against the bundled reference server; `npm run bench -- --url ws://...` against any server)
- Lint / typecheck: TBD (expected `npx tsc --noEmit`)

## Stack and versions
- TypeScript on Node 22, `ws`, zod, YAML scenario files, vitest. Reference server: Anthropic SDK with streaming, two tools with `message` parameters, idempotent booking keyed on call ID + args. Exact versions come from the plan; update this line when they are pinned.

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
