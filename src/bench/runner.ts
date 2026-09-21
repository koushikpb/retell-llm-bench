import { randomBytes } from 'node:crypto';
import type { Utterance } from '../protocol/schemas.js';
import { BenchClient } from './client.js';
import type { Scenario } from './scenario.js';
import type { ScenarioRunResult } from './types.js';

export interface RunOptions {
  url: string;
  run: number;
  pingIntervalMs?: number;
  pingTimeoutMs?: number;
  beginTimeoutMs?: number;
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runScenario(scenario: Scenario, opts: RunOptions): Promise<ScenarioRunResult> {
  const callId = `bench-${scenario.name}-${opts.run}-${randomBytes(3).toString('hex')}`;
  const client = await BenchClient.connect({
    url: opts.url,
    callId,
    pingIntervalMs: opts.pingIntervalMs,
    pingTimeoutMs: opts.pingTimeoutMs,
    beginTimeoutMs: opts.beginTimeoutMs,
  });
  const transcript: Utterance[] = [];
  const agentUtterances: string[] = [];
  let nextId = 1;
  const sendUserTurn = (text: string): number => {
    transcript.push({ role: 'user', content: text });
    client.sendUpdateOnly([...transcript], 'user_turn');
    const id = nextId++;
    // api-notes §4: turntaking "agent_turn" is sent "right before agent is about to speak".
    client.sendUpdateOnly([...transcript], 'agent_turn');
    client.requestResponse('response_required', id, [...transcript]);
    return id;
  };
  try {
    const begun = await client.waitForBegin();
    if (begun && client.begin.content.length > 0) {
      transcript.push({ role: 'agent', content: client.begin.content });
      agentUtterances.push(client.begin.content);
    }
    for (const turn of scenario.turns) {
      let completedId: number;
      if ('reminder' in turn) {
        const id = nextId++;
        client.requestResponse('reminder_required', id, [...transcript]);
        await client.waitForComplete(id, scenario.turn_timeout_ms);
        completedId = id;
      } else {
        const id = sendUserTurn(turn.user);
        if (turn.interrupt) {
          const { after_ms, after_first_chunk_ms } = turn.interrupt;
          if (after_first_chunk_ms !== undefined) {
            const gotChunk = await client.waitForFirstChunk(id, scenario.turn_timeout_ms);
            if (gotChunk) await pause(after_first_chunk_ms);
            else if (after_ms !== undefined) await pause(after_ms);
            // else: the agent never spoke a word; interrupt immediately.
          } else {
            await pause(after_ms as number);
          }
          // Whatever the agent already streamed under the superseded id was spoken, so it stays in the transcript.
          const partial = client.agentTextFor(id);
          if (partial.length > 0) {
            transcript.push({ role: 'agent', content: partial });
            agentUtterances.push(partial);
          }
          const id2 = sendUserTurn(turn.interrupt.user);
          await client.waitForComplete(id2, scenario.turn_timeout_ms);
          completedId = id2;
        } else {
          await client.waitForComplete(id, scenario.turn_timeout_ms);
          completedId = id;
        }
      }
      const said = client.agentTextFor(completedId);
      if (said.length > 0) {
        transcript.push({ role: 'agent', content: said });
        agentUtterances.push(said);
        client.sendUpdateOnly([...transcript]);
      }
    }
  } finally {
    await client.close();
  }
  return {
    scenario: scenario.name,
    run: opts.run,
    callId,
    url: opts.url,
    config: client.config,
    begin: client.begin,
    turns: client.turns,
    toolCalls: client.toolCalls,
    violations: client.violations,
    keepalive: client.keepalive,
    agentUtterances,
    durationMs: performance.now() - client.startedAt,
  };
}
