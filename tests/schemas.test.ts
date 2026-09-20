import { describe, it, expect } from 'vitest';
import { RetellFrameSchema, ServerFrameSchema, validateServerFrame } from '../src/protocol/schemas.js';

describe('Retell -> server frames (api-notes §4, §6)', () => {
  it('parses ping_pong, update_only, response_required, reminder_required', () => {
    expect(RetellFrameSchema.safeParse({ interaction_type: 'ping_pong', timestamp: 1703302407333 }).success).toBe(true);
    expect(
      RetellFrameSchema.safeParse({
        interaction_type: 'update_only',
        transcript: [
          { role: 'agent', content: 'Hey how can I help you?', words: [] },
          { role: 'user', content: 'Hey. How are you?', words: [{ word: 'Hey.', start: 4.375, end: 4.615 }] },
        ],
        turntaking: 'agent_turn',
      }).success,
    ).toBe(true);
    expect(
      RetellFrameSchema.safeParse({ interaction_type: 'response_required', response_id: 3, timestamp: 3, transcript: [{ role: 'user', content: 'Hi' }] }).success,
    ).toBe(true);
    expect(RetellFrameSchema.safeParse({ interaction_type: 'reminder_required', response_id: 4, transcript: [] }).success).toBe(true);
  });

  it('rejects a response_required without an integer response_id', () => {
    expect(RetellFrameSchema.safeParse({ interaction_type: 'response_required', transcript: [] }).success).toBe(false);
    expect(RetellFrameSchema.safeParse({ interaction_type: 'response_required', response_id: 1.5, transcript: [] }).success).toBe(false);
  });
});

describe('server -> Retell frames (api-notes §5, §6, §7)', () => {
  it('parses every documented response_type', () => {
    const frames = [
      { response_type: 'config', config: { auto_reconnect: true, call_details: true } },
      { response_type: 'ping_pong', timestamp: 1703302407333 },
      { response_type: 'response', response_id: 3, content: "I'm doing great, ", content_complete: false },
      { response_type: 'response', response_id: 10, content: 'Goodbye.', content_complete: true, end_call: true },
      { response_type: 'agent_interrupt', interrupt_id: 1, content: 'Please stop right there, do not', content_complete: false, no_interruption_allowed: true },
      { response_type: 'tool_call_invocation', tool_call_id: 'some_id_here', name: 'book_appointment', arguments: '{"date": "2022-01-01", "time": "10:00"}' },
      { response_type: 'tool_call_result', tool_call_id: 'some_id_here', content: 'Appointment booked successfully.' },
      { response_type: 'update_agent', agent_config: { responsiveness: 0.5, interruption_sensitivity: 0.5, reminder_trigger_ms: 5000, reminder_max_count: 3 } },
      { response_type: 'metadata', metadata: { any: 'thing' } },
    ];
    for (const f of frames) expect(ServerFrameSchema.safeParse(f).success, JSON.stringify(f)).toBe(true);
  });
});

describe('validateServerFrame', () => {
  it('returns the frame and no violations for a valid response', () => {
    const r = validateServerFrame(JSON.stringify({ response_type: 'response', response_id: 3, content: 'thank you.', content_complete: true }));
    expect(r.violations).toEqual([]);
    expect(r.frame).toMatchObject({ response_type: 'response', response_id: 3 });
  });

  it('flags a missing response_type but parses the frame as a response (api-notes §1)', () => {
    const r = validateServerFrame(JSON.stringify({ response_id: 1, content: 'hi', content_complete: false }));
    expect(r.violations.map((v) => v.code)).toEqual(['missing_response_type']);
    expect(r.frame).toMatchObject({ response_type: 'response', response_id: 1, content: 'hi' });
  });

  it('drops a response whose content_complete is the string "true" (api-notes §5 troubleshooting)', () => {
    const r = validateServerFrame(JSON.stringify({ response_type: 'response', response_id: 1, content: 'hi', content_complete: 'true' }));
    expect(r.frame).toBeNull();
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].code).toBe('schema');
    expect(r.violations[0].message).toContain('content_complete');
  });

  it('drops a response whose response_id is not an integer', () => {
    const r = validateServerFrame(JSON.stringify({ response_type: 'response', response_id: '1', content: 'hi', content_complete: true }));
    expect(r.frame).toBeNull();
    expect(r.violations[0].code).toBe('schema');
  });

  it('keeps the frame but flags mutually exclusive actions (api-notes §5)', () => {
    const r = validateServerFrame(
      JSON.stringify({ response_type: 'response', response_id: 2, content: 'bye', content_complete: true, end_call: true, transfer_number: '+14155550100' }),
    );
    expect(r.frame).not.toBeNull();
    expect(r.violations.map((v) => v.code)).toEqual(['exclusive_actions']);
  });

  it('flags invalid JSON, non-objects, and unknown response types', () => {
    expect(validateServerFrame('{not json').violations[0].code).toBe('invalid_json');
    expect(validateServerFrame('[1,2]').violations[0].code).toBe('not_an_object');
    expect(validateServerFrame(JSON.stringify({ response_type: 'bogus' })).violations[0].code).toBe('unknown_response_type');
  });
});
