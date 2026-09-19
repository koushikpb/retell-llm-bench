# API notes — retell-llm-bench (Retell custom-LLM WebSocket protocol)
Gathered 2026-09-19 in Chrome by the composer session from Retell's docs (Mintlify `.md` sources). This file is the only source for the protocol. Every section has its URL. Text in quotes is verbatim. Library versions are NOT here; the planner pins them from Context7.

## 1. What the bench replaces (the gap)
Source: https://docs.retellai.com/integrate-llm/overview
- "The LLM playground can't test a custom LLM agent, and simulation and batch testing reject them. Web and phone calls are the only way to test."
- "Retell decides when the agent speaks, so not every response you generate gets used. If the caller keeps talking, Retell discards the response it asked for and asks again with a new `response_id`."
- "One WebSocket is opened per call, to `llm_websocket_url` with the call ID appended as the last path segment."
- Example servers: Node (Express) https://github.com/RetellAI/retell-custom-llm-node-demo and Python (FastAPI) https://github.com/RetellAI/retell-custom-llm-python-demo; "These repos might be outdated already. Follow the guides in this section wherever the two differ."
- Warning: "Always set `response_type` on messages you send. Retell treats a message with no `response_type` as a `response` for backward compatibility, but that fallback is the reason a malformed event fails silently instead of erroring."

## 2. Endpoint and framing
Source: https://docs.retellai.com/api-references/llm-websocket ; https://docs.retellai.com/integrate-llm/setup-websocket-server
- Endpoint: `{your-server-websocket-endpoint}/{call_id}`. If the agent is configured with `wss://your-domain.com/llm-websocket`, Retell connects to `wss://your-domain.com/llm-websocket/{call_id}`. "Don't append the call ID" in the configured URL; Retell appends it; a trailing slash is normalized.
- "All message event types are 'text', where the `data` attribute of message event is a JSON object stringified." "Retell never sends binary frames, and it closes the connection with code `1007` if you send one."
- "Retell sends no auth headers on this WebSocket." Retell's outbound IP is `100.20.5.228`. Retell blocks localhost and private ranges as targets (irrelevant for the bench, which connects locally itself).
- Retries: "On the initial connection, Retell makes up to 3 attempts with a 7-second timeout each and 3 seconds between them. If all fail, the call ends with `error_llm_websocket_open`. Mid-call, Retell rebuilds a dropped connection instead of giving up: up to 2 reconnects when keepalives stop arriving, and up to 4 when the socket closes abnormally (code `1006`)."
- "Closing the socket with code `1000` from your side is treated as a deliberate hangup, so the call ends with `agent_hangup`." Closing "without a status code (`1005`)" mid-call yields `error_llm_websocket_open`.

## 3. Event flow (what the bench must play, in order)
Source: https://docs.retellai.com/integrate-llm/overview (sequence diagram) ; https://docs.retellai.com/api-references/llm-websocket
1. Retell opens the WebSocket at `llm_websocket_url/{call_id}`.
2. Server → Retell: optional `config` (auto_reconnect, call_details, transcript_with_tool_calls). "Send `config` first if you send it at all, since Retell acts on it as it arrives." Defaults without config: "no keepalives, no call details, no tool-call transcripts."
3. Retell → Server: `call_details` (only if enabled in config).
4. Server → Retell: `response` with `response_id: 0` = the begin message. "Set `content` to an empty string to have the agent wait for the caller to speak first." "Retell waits for a `response` event with `response_id: 0` before the agent says anything."
5. Retell → Server: `update_only` events (transcript, `turntaking`), then `response_required` with `response_id` 1, 2, ... ; `reminder_required` when the caller is quiet.
6. Server → Retell: `response` chunks for that `response_id`, "last one with content_complete true".
7. Keepalive: "Keepalives every 2s while auto_reconnect is on" (both directions, `ping_pong`).

## 4. Retell → Server events (the bench SENDS these)
Source: https://docs.retellai.com/api-references/llm-websocket
Discriminator: `interaction_type`.
- `ping_pong` (optional): `{ "interaction_type": "ping_pong", "timestamp": <integer ms since epoch> }`. Sent "every 2s" when `auto_reconnect` is true. Server must echo (see §5). "Once there's 5s without ping pong event, Retell would close the current connection and restart a new connection to your server for up to 2 times."
- `call_details` (only if config.call_details): `{ "interaction_type": "call_details", "call": { ... } }`. Sample `call`: `call_type: "phone_call"`, `from_number`, `to_number`, `direction: "inbound"`, `call_id`, `agent_id`, `call_status: "registered"`, `metadata: {}`, `retell_llm_dynamic_variables: { "customer_name": "John Doe" }`, `opt_out_sensitive_data_storage: true`. On web calls `from_number`/`to_number`/`direction` are absent.
- `update_only` (required): `{ "interaction_type": "update_only", "transcript": Utterance[], "transcript_with_tool_calls"?: object[], "turntaking"?: "agent_turn" | "user_turn" }`. "Retell would send an event when the transcript updates -- either the user speaks, or the agent speaks. Retell also sends this event when turntaking happens." `turntaking` "will be present when speaker changes to user (user turn), or right before agent is about to speak (agent turn)."
- `response_required` / `reminder_required` (required): `{ "interaction_type": "response_required" | "reminder_required", "response_id": <integer>, "transcript": Utterance[], "transcript_with_tool_calls"?: object[] }`. `response_id`: "This unique auto-incrementing id ... When a new response is needed, a new event with response id will be sent, and all previous responses will be discarded." `reminder_required`: "User has not spoken for a while, a reminder is needed from your server."
- Utterance: `{ "role": "agent" | "user", "content": string, "words"?: [{ "word": string, "start": number, "end": number }] }` (sample events show `words`; the typed guide omits it). Retell sends the utterance content `(unintelligible audio)` "When Retell detects that the caller spoke but transcribes no words" (https://docs.retellai.com/integrate-llm/troubleshooting).
- Sample `response_required` in the reference also carries `"timestamp": 3` (undocumented field; the bench may include an integer `timestamp` but must not require it).

## 5. Server → Retell events (the bench RECEIVES and validates these)
Source: https://docs.retellai.com/api-references/llm-websocket ; https://docs.retellai.com/integrate-llm/setup-websocket-server (types.ts)
Discriminator: `response_type`.
- `config`: `{ "response_type": "config", "config": { "auto_reconnect"?: boolean, "call_details"?: boolean, "transcript_with_tool_calls"?: boolean } }`.
- `ping_pong`: `{ "response_type": "ping_pong", "timestamp": <integer> }`. Required "If `auto_reconnect` is on". Guide code echoes the request's `timestamp`. "Retell would expect a ping_pong event back every 2s, and would close the connection if there's no ping_pong event for 5s."
- `response` (required): `{ "response_type": "response", "response_id": integer, "content": string, "content_complete": boolean, "no_interruption_allowed"?: boolean, "end_call"?: boolean, "transfer_number"?: string, "show_transferee_as_caller"?: boolean (default false), "digit_to_press"?: string }`.
  - "Reply with the same `response_id` Retell asked with. A response carrying any other `response_id` is discarded silently."
  - "Retell accepts content only for the `response_id` it most recently requested, and only until you mark that response complete."
  - "Set `content_complete: true` on the last event of a response. Retell keeps waiting for more content until it sees that flag, so a response that never completes leaves the turn hanging: the agent stops speaking, no error is raised, and it only recovers once the caller speaks again."
  - "Answering with an empty string plus `content_complete: true` is a valid way to say nothing."
  - Type validation: "Retell rejects a `response` event when `content_complete` isn't a boolean, `content` isn't a string, or `response_id` isn't an integer. It logs the problem and keeps the connection open, so the event just vanishes. `"content_complete": "true"` is a string, not a boolean, and is the common version of this mistake." (https://docs.retellai.com/integrate-llm/troubleshooting)
  - Actions: "Retell runs the action after the content in that response has been fully spoken." "`end_call`, `transfer_number`, and `digit_to_press` are mutually exclusive. Retell runs at most one per `response_id`, and `end_call` takes precedence, then `transfer_number`." `end_call`: "If the caller interrupts before the agent finishes speaking, the hangup is discarded." `no_interruption_allowed`: "Retell drops interruption sensitivity to 0 for the duration". (https://docs.retellai.com/integrate-llm/integrate-function-calling)
  - "You still need to respond to previous response / reminder required event if newer update_only events are received." (only a newer response/reminder request supersedes)
- `agent_interrupt` (optional): `{ "response_type": "agent_interrupt", "interrupt_id": integer, "content": string, "content_complete": boolean, "no_interruption_allowed"?: boolean, "end_call"?: boolean, "transfer_number"?: string, "digit_to_press"?: string }`. "It will stop the agent speech if the agent is speaking, or it will interrupt the user if the user is speaking." Same `interrupt_id` groups chunks; a different id discards previous interrupts. Overview: "Also cancels any response still in flight."
- `tool_call_invocation` (optional): `{ "response_type": "tool_call_invocation", "tool_call_id": string, "name": string, "arguments": string }` — `arguments` "is a stringified JSON object". "Send the invocation as the tool starts and the result when it returns, using the same `tool_call_id` for both".
- `tool_call_result` (optional): `{ "response_type": "tool_call_result", "tool_call_id": string, "content": string, "successful"?: boolean }`. "Omitting it means the outcome was not reported, not that the tool call failed".
- `update_agent` (optional): `{ "response_type": "update_agent", "agent_config": { "responsiveness"?: number [0,1], "interruption_sensitivity"?: number [0,1], "reminder_trigger_ms"?: positive number, "reminder_max_count"?: non-negative integer } }`.
- `metadata` (optional): `{ "response_type": "metadata", "metadata": <any JSON object> }` — forwarded to a web-call frontend.

## 6. Sample frames (verbatim from the reference)
Source: https://docs.retellai.com/api-references/llm-websocket
```json
{ "interaction_type": "ping_pong", "timestamp": 1703302407333 }
{ "interaction_type": "update_only", "transcript": [ { "role": "agent", "content": "Hey how can I help you?", "words": [] }, { "role": "user", "content": "Hey. How are you?", "words": [ { "word": "Hey.", "start": 4.375, "end": 4.615 } ] } ], "turntaking": "agent_turn" }
{ "interaction_type": "response_required", "timestamp": 3, "transcript": [ { "role": "agent", "content": "Hey how can I help you?", "words": [] }, { "role": "user", "content": "Hey. How are you?", "words": [] } ] }
{ "interaction_type": "reminder_required", "transcript": [ ... ] }
{ "response_type": "config", "config": { "auto_reconnect": true, "call_details": true } }
{ "response_type": "ping_pong", "timestamp": 1703302407333 }
{ "response_type": "response", "response_id": 3, "content": "I'm doing great, ", "content_complete": false }
{ "response_type": "response", "response_id": 3, "content": "thank you.", "content_complete": true }
{ "response_type": "response", "response_id": 10, "content": "Goodbye.", "content_complete": true, "end_call": true }
{ "response_type": "agent_interrupt", "interrupt_id": 1, "content": "Please stop right there, do not", "content_complete": false, "no_interruption_allowed": true }
{ "response_type": "tool_call_invocation", "tool_call_id": "some_id_here", "name": "book_appointment", "arguments": "{\"date\": \"2022-01-01\", \"time\": \"10:00\"}" }
{ "response_type": "tool_call_result", "tool_call_id": "some_id_here", "content": "Appointment booked successfully." }
{ "response_type": "update_agent", "agent_config": { "responsiveness": 0.5, "interruption_sensitivity": 0.5, "reminder_trigger_ms": 5000, "reminder_max_count": 3 } }
```
Note: the reference's `response_required` sample omits `response_id`; the field table marks it required and the guide's typed interface includes it. The bench always sends it.

## 7. Typed definitions from the setup guide (verbatim TypeScript)
Source: https://docs.retellai.com/integrate-llm/setup-websocket-server
```typescript
export interface Utterance { role: "agent" | "user"; content: string; }
export interface PingPongRequest { interaction_type: "ping_pong"; timestamp: number; }
export interface CallDetailsRequest { interaction_type: "call_details"; call: Record<string, any>; }
export interface UpdateOnlyRequest { interaction_type: "update_only"; transcript: Utterance[]; turntaking?: "agent_turn" | "user_turn"; }
export interface ResponseRequiredRequest { interaction_type: "response_required" | "reminder_required"; transcript: Utterance[]; response_id: number; }
export interface ConfigResponse { response_type: "config"; config: { auto_reconnect?: boolean; call_details?: boolean; transcript_with_tool_calls?: boolean; }; }
export interface PingPongResponse { response_type: "ping_pong"; timestamp: number; }
export interface ResponseResponse { response_type: "response"; response_id: number; content: string; content_complete: boolean; no_interruption_allowed?: boolean; end_call?: boolean; transfer_number?: string; show_transferee_as_caller?: boolean; digit_to_press?: string; }
```

## 8. Behaviors the bench measures (each is a documented trap)
Sources: https://docs.retellai.com/integrate-llm/llm-best-practice ; https://docs.retellai.com/integrate-llm/integrate-function-calling ; https://docs.retellai.com/integrate-llm/integrate-llm
- Time to first sentence: "Retell starts speaking as soon as it has your first complete sentence. So the number that matters is time to first token plus the time to finish that first sentence, not total generation time." "Stream, don't buffer."
- Unclosed response: "Never leave a response unclosed. Send `content_complete: true` in a `finally` block. If your provider errors or times out and you skip it, the turn never finishes: the agent stops speaking, nothing errors".
- Duplicate side effects: "Retell discards responses when the caller keeps talking and asks again, so a side-effecting tool routinely runs twice for one request. Key the write on the call ID plus the arguments so the repeat is a no-op." "An idempotency key is the only real fix. The `isStale()` check above helps only when the newer request has already arrived, and a fast tool commits its write a second or two before that happens."
- Stale responses: content under an older `response_id` "is dropped without an error"; a good server stops generating once superseded.
- Tools need a `message` parameter: "Most providers return either a tool call or text, not both. Without a parameter carrying something to say, the agent goes silent exactly when the caller is waiting."
- Tool accuracy: "Describe when not to call." "Constrain the tool set." `temperature: 0` with tools.
- Do work while the agent talks: send the holding line with `content_complete: false`, run the tool, send `tool_call_invocation` then `tool_call_result`, then stream the follow-up "under the same `response_id`". "While a response is open, Retell waits rather than filling the gap itself. It won't ask for a reminder or a new response until you send `content_complete: true`".
- Keepalive discipline: with `auto_reconnect`, echo every `ping_pong` within 5 s; "A blocking response handler is the usual culprit here." (troubleshooting)
- Reminder handling: on `reminder_required` the model should "nudge rather than answering a question nobody asked."
- Voice output: "No markdown, no bullet lists, no emoji, no headers." (a measurable lint on `content`)
- Wrong types: string `"true"` for `content_complete`, non-integer `response_id` → event silently dropped (troubleshooting).
- Missing `response_type` → treated as `response` (overview warning); the bench flags it.
- Retell's own reference prompt in the guide (for the bundled reference server's voice): "You are Ava, the scheduling assistant for Bright Smile Dental. You book, move, and cancel appointments. Office hours are 9am to 5pm on weekdays. If a caller asks for anything clinical, offer to take a message for the dentist." and the `book_appointment` tool with `date` (ISO), `time` (24-hour), `message` parameters; `end_call` with `message`. (https://docs.retellai.com/integrate-llm/integrate-function-calling)

## 9. Latency fields Retell reports (for naming the bench's metrics consistently)
Source: https://docs.retellai.com/integrate-llm/integrate-llm ; https://docs.retellai.com/integrate-llm/troubleshooting
- "The `llm` field covers your generation including the WebSocket round trip, and `llm_websocket_network_rtt` isolates that round trip". Call History shows P50, P90, P99 end-to-end latency (https://docs.retellai.com/reliability/check-actual-latency, not opened).

## 10. Job posting lines the demo answers
Source: https://www.workatastartup.com/jobs/109576 (recorded in companies/retell-ai/company.md, 2026-09-18)
- "Write production code in Python, JavaScript, or similar languages"; "Learn Retell's platform and become an expert in building voice AI agents"; "Build integrations with CRMs, ERPs, scheduling tools, and other systems"; "roughly 50% of your time building and 50% working directly with customers".

## Libraries to pin (planner checks each in Context7 and records the version)
- typescript, tsx (run TS directly), @types/node (Node 22)
- ws (WebSocket client for the bench and server for the reference/fake servers; `WebSocket`, `WebSocketServer`, `on('message')`, `send`, close codes)
- zod (schemas for every frame in §4–§5; `discriminatedUnion` on `interaction_type` / `response_type`; `safeParse` to report invalid frames instead of throwing)
- yaml (scenario files)
- vitest (unit + integration tests; the fake server runs in-process on a random port)
- @anthropic-ai/sdk (reference server only: `messages.stream`, tools with `input_schema`, streamed `input_json_delta`, model id `claude-sonnet-5`, key from `ANTHROPIC_API_KEY`)
- No CLI framework: parse `process.argv` by hand (`--url`, `--scenarios`, `--runs`, `--json`) to keep dependencies small. No table library: format the results table with padded strings.
