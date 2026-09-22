# retell-llm-bench

An offline test bench for [Retell](https://www.retellai.com) custom-LLM servers. It plays the Retell side of the custom-LLM WebSocket protocol against a local server, runs nine scripted call scenarios (booking, rescheduling, interruptions, silence, off-script questions, goodbye), and reports time to first sentence, `content_complete` discipline, tool calls missing / unnecessary / duplicate, and protocol violations. Retell's docs say a custom-LLM agent can only be tested with web and phone calls (https://docs.retellai.com/integrate-llm/overview); this is the offline harness.

![60-second bench run](docs/demo.gif)

## Run it

```bash
npm install
npm run smoke      # no key: runs the suite against a scripted fake server (started in-process) and writes docs/smoke.txt
npm run results    # with ANTHROPIC_API_KEY in .env.local (see .env.example): starts the Claude reference server in-process, 3 runs per scenario, writes docs/results.md
```

To test your own server, start it and run `npm run bench -- --url ws://127.0.0.1:8080/llm-websocket --runs 3 --json out.json`. `npm test` runs the test suite; it needs no key.

## Results

Bundled Claude reference server (`claude-sonnet-5`), 3 runs per scenario. Full output with every finding and a transcript diff per run: `docs/results.md`.

| scenario | runs | ttfs p50 | ttfs p90 | complete | missing | unnecessary | duplicate | violations | text miss | must complete |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| book-appointment | 3 | 1876 ms | 2063 ms | 3/3 | 0 | 0 | 0 | 0 | 0 | ok |
| caller-goes-quiet | 3 | 1123 ms | 1323 ms | 6/6 | 0 | 0 | 0 | 0 | 0 | ok |
| caller-says-goodbye | 3 | 1375 ms | 2015 ms | 3/3 | 0 | 0 | 0 | 0 | 0 | ok |
| change-mind-before-booking | 3 | 1448 ms | 1777 ms | 3/3 | 0 | 0 | 0 | 0 | 0 | ok |
| clinical-question | 3 | 2889 ms | 3965 ms | 3/3 | 0 | 0 | 0 | 0 | 0 | ok |
| fee-not-in-kb | 3 | 1406 ms | 1606 ms | 3/3 | 0 | 0 | 0 | 0 | 0 | ok |
| interrupt-mid-sentence | 3 | 1633 ms | 1736 ms | 3/3 | 0 | 0 | 0 | 0 | 0 | ok |
| reschedule-appointment | 3 | 1302 ms | 1577 ms | 6/6 | 2 | 0 | 0 | 0 | 0 | ok |
| unintelligible-audio | 3 | 1732 ms | 2643 ms | 3/3 | 0 | 0 | 0 | 0 | 0 | ok |

Columns: `ttfs` is the time from `response_required` to the first complete sentence; `complete` counts turns that received `content_complete: true`; `missing`, `unnecessary`, and `duplicate` are tool calls; `violations` are protocol violations; `text miss` counts expected phrases the agent never said.

Two findings worth reading: `reschedule-appointment` missed its booking in two of three runs because the model asked the caller to confirm the new slot and never called `book_appointment`. In `interrupt-mid-sentence`, the caller corrects 2pm to 3pm 300 ms after the agent starts speaking, and in all three runs the server had already booked 2pm under the superseded `response_id` before booking 3pm; the bench lists the 2pm call as informational (`tool_args_mismatch`) and the transcript diff shows the interrupted sentence.
