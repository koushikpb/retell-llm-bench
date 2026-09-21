import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';

const ExpectedToolCallSchema = z.object({
  name: z.string(),
  args: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});
const InterruptSchema = z
  .object({ after_ms: z.int().min(0).optional(), after_first_chunk_ms: z.int().min(0).optional(), user: z.string() })
  .refine((i) => i.after_ms !== undefined || i.after_first_chunk_ms !== undefined, { message: 'interrupt needs after_ms or after_first_chunk_ms' });
const UserTurnSchema = z.object({ user: z.string(), interrupt: InterruptSchema.optional() });
const ReminderTurnSchema = z.object({ reminder: z.literal(true) });
const TurnSchema = z.union([UserTurnSchema, ReminderTurnSchema]);

export const ScenarioSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string(),
  turn_timeout_ms: z.int().positive().default(15000),
  turns: z.array(TurnSchema).min(1),
  expect: z.object({
    tool_calls: z.array(ExpectedToolCallSchema).default([]),
    forbidden_tools: z.array(z.string()).default([]),
    must_complete: z.boolean().default(true),
    agent_text_contains: z.array(z.string()).default([]),
    // Reference wording per agent turn after the begin message; diffed in the report, never scored.
    agent_transcript: z.array(z.string()).default([]),
  }),
});

export type Scenario = z.infer<typeof ScenarioSchema>;
export type Turn = Scenario['turns'][number];
export type ExpectedToolCall = Scenario['expect']['tool_calls'][number];

export function loadScenario(path: string): Scenario {
  const result = ScenarioSchema.safeParse(parse(readFileSync(path, 'utf8')));
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new Error(`invalid scenario ${basename(path)}: ${detail}`);
  }
  return result.data;
}

export function loadScenarios(dir: string): Scenario[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => loadScenario(join(dir, f)));
}
