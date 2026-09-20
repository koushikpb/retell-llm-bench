# TRACKER — retell-llm-bench
Company: Retell AI · Idea: #1 `retell-llm-bench` offline test bench for custom-LLM servers · Effort budget: M, ~14 hours
Spec: docs/superpowers/specs/2026-09-19-retell-ai-design.md · Plan: docs/superpowers/plans/2026-09-19-retell-ai.md · Review: docs/plan-review.md (round 1, REVISE; plan and spec revised 2026-09-20)
Planner: Fable 5.1 (claude-fable-5-1) · Reviewer: Fable 5.1, fresh context · Implementers: Sonnet 5 (claude-sonnet-5)

## Phases
| Phase | Status | Notes |
|---|---|---|
| 0 Workspace (git, CLAUDE.md, TRACKER.md, api-notes) | in_progress | git init and .gitignore 2026-09-18; CLAUDE.md, TRACKER.md 2026-09-19; api-notes.md pending |
| 1 Design + plan (Fable) | done | spec + plan written 2026-09-19; 16 tasks, ~14.0 h after the round-1 revision (round 1 printed 14.5 h for numbers summing to 13.5 h); parallel groups A {2,5,10}, B {6,7}, C {9,11}, one worktree per grouped task |
| 2 Plan review, fresh context (Fable) | done | round 1: REVISE (2 blockers, 6 major, 12 minor); all addressed; round 2: REVISE (2 major, 10 minor); all addressed |
| 3 Go from user (recorded by /plan-demo) | todo | |
| 4 Execute tasks (Superpowers subagent-driven-development, Sonnet 5) | todo | |
| 5 Verify (tests, e2e/smoke, GIF) | todo | |
| 6 Specialist review + fixes | todo | |
| 7 README, demo-summary.md, tracker | todo | |

## Tasks
| # | Task | Files | Test | Status | Model | Commit | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Project scaffold, pinned deps, argv parser | package.json, tsconfig.json, vitest.config.ts, .env.example, .gitignore, src/bench/args.ts | tests/args.test.ts | todo | sonnet | | verify pins with npm view before install (SDK 0.110.0); record substitutions and any SDK type-name lookups here; fileParallelism false; *.pid ignored |
| 2 | Protocol schemas + validateServerFrame | src/protocol/schemas.ts | tests/schemas.test.ts | todo | sonnet | | group A (worktree, npm ci, scoped tsc); update_agent/metadata/agent_interrupt by response_type only |
| 3 | Scripted fake server, SMOKE_SCRIPT, raw test client | src/server/fake.ts, src/server/fake-scripts.ts, tests/helpers/raw-client.ts | tests/fake.test.ts | todo | sonnet | |  |
| 4 | BenchClient (Retell side of a call) | src/bench/types.ts, src/bench/client.ts | tests/client.test.ts | todo | sonnet | |  |
| 5 | Scenario schema, loaders, 9 YAML scenarios | src/bench/scenario.ts, scenarios/*.yaml | tests/scenario.test.ts | todo | sonnet | | group A (worktree); adds expect.agent_transcript |
| 6 | Metrics (TTFS, percentiles) | src/bench/metrics.ts | tests/metrics.test.ts | todo | sonnet | | group B (worktree) |
| 7 | Scoring (findings per run) | src/bench/scoring.ts | tests/scoring.test.ts | todo | sonnet | | group B (worktree); adds silent_tool_turn and tool_args_mismatch (informational) |
| 8 | Scenario runner | src/bench/runner.ts | tests/runner.test.ts | todo | sonnet | | sends turntaking agent_turn before each response_required; keeps partial text of a superseded id |
| 9 | Report, transcript diff, CLI, entry points, results renderer | src/bench/diff.ts, src/bench/report.ts, src/bench/cli.ts, src/bench/main.ts, src/bench/results-md.ts | tests/diff.test.ts, tests/report.test.ts, tests/cli.test.ts | todo | sonnet | | group C (worktree); hand-written line diff |
| 10 | Booking store + tool definitions | src/server/booking.ts, src/server/tools.ts | tests/booking.test.ts | todo | sonnet | | group A (worktree) |
| 11 | Reference session + server (fake LLM tested) | src/server/llm.ts, src/server/session.ts, src/server/reference.ts, tests/helpers/fake-llm.ts | tests/session.test.ts | todo | sonnet | | group C (worktree) |
| 12 | Claude client, env loader, server entry | src/server/env.ts, src/server/claude.ts, src/server/main.ts | tests/env.test.ts, tests/claude.test.ts | todo | sonnet | | grep SDK .d.ts (ThinkingConfigDisabled, claude-sonnet-5) before use; thinking disabled, no sampling params; BENCH_NO_ENV_FILE=1 skips .env.local |
| 13 | Fake entry point, smoke run, in-process results script, wait-ws | src/server/fake-main.ts, scripts/smoke.ts, scripts/results.ts, scripts/wait-ws.ts, docs/smoke.txt | none (script; output checked) | todo | sonnet | | never grouped |
| 14 | Results run vs reference server (key) | docs/results.json, docs/results.md | none (measurement run) | todo | sonnet | | never grouped; background; success = `wrote docs/results.md` count 1 and last line `results run complete`; hard stop if any `server:` line matches failed:/400/401/429/529 (delete partial results, log tail here) |
| 15 | README | README.md | none (docs; grep check) | todo | sonnet | | never grouped |
| 16 | Replay page + 60 s GIF (main session, Chrome) | scripts/replay.ts, docs/replay.html, docs/demo.gif | none (recording) | todo | sonnet | | never grouped; fallback = smoke.txt link |

## Log
- 2026-09-19 composer wrote CLAUDE.md and TRACKER.md from the plan-demo templates; api-notes next.
- 2026-09-19 planner (Fable 5.1) wrote the spec and the 16-task plan; TRACKER task table and CLAUDE.md commands filled from the plan.
- 2026-09-19 reviewer (Fable 5.1, fresh context) returned round 1: REVISE, 2 blockers (temperature 0 → 400 on Sonnet 5; thinking left adaptive under max_tokens 300), 6 major, 12 minor.
- 2026-09-20 planner revised the plan, spec, CLAUDE.md and this file for every round-1 finding: SDK 0.110.0, no sampling params + thinking disabled, worktree-scoped checks for grouped tasks, transcript diffs restored (hand-written diff), silent_tool_turn finding, timing margins + fileParallelism false, in-process `npm run results` with a hard stop on provider failures, cuts (a) and (b) applied; ~14.0 h.
- 2026-09-20 reviewer 2 (Fable 5.1, fresh context) returned round 2: REVISE, 0 blockers, 2 major (results-log ordering race; expected tool name with wrong arguments unscored), 10 minor; 18/20 round-1 fixes verified, 2 partial.
- 2026-09-20 planner applied round 2: `results run complete` sentinel + deterministic Task 14 check, `tool_args_mismatch` informational finding, plan:20 reworded, Task 9 count 7, runner ping 100/400 ms, loadEnvFile and wss.address() fallbacks recorded, conditional README sentence for change-mind picked from the findings, extra `+` line noted, no-`cd` no-key check via BENCH_NO_ENV_FILE, effort 13.9 h + installs = 14.0 h (Task 12 Step 3 trimmed to two greps).
- 2026-09-20 composer verified the round-2 fixes by grep and recorded a ruling in docs/plan-review.md. Awaiting the user's go.
