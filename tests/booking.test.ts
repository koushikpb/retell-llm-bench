import { describe, it, expect } from 'vitest';
import { BookingStore } from '../src/server/booking.js';
import { TOOLS, SYSTEM_PROMPT, BEGIN_MESSAGE } from '../src/server/tools.js';

describe('BookingStore (Retell best-practice page: key the write on the call ID plus the arguments)', () => {
  it('creates once and returns the same confirmation on a repeat with the same call id and args', () => {
    const store = new BookingStore();
    const first = store.book('call-1', { date: '2026-09-24', time: '14:00' });
    const again = store.book('call-1', { date: '2026-09-24', time: '14:00' });
    expect(first.created).toBe(true);
    expect(again.created).toBe(false);
    expect(again.confirmation).toBe(first.confirmation);
    expect(store.size).toBe(1);
  });
  it('treats a different call id or different args as a new booking', () => {
    const store = new BookingStore();
    store.book('call-1', { date: '2026-09-24', time: '14:00' });
    expect(store.book('call-2', { date: '2026-09-24', time: '14:00' }).created).toBe(true);
    expect(store.book('call-1', { date: '2026-09-24', time: '15:00' }).created).toBe(true);
    expect(store.size).toBe(3);
  });
});

describe('tools (Retell best-practice page: every tool carries a message parameter)', () => {
  it('defines book_appointment and end_call, each requiring message', () => {
    expect(TOOLS.map((t) => t.name)).toEqual(['book_appointment', 'end_call']);
    for (const t of TOOLS) {
      expect(t.input_schema.type).toBe('object');
      expect(t.input_schema.required).toContain('message');
      expect(t.input_schema.properties.message.type).toBe('string');
    }
    expect(TOOLS[0].input_schema.required).toEqual(['date', 'time', 'message']);
  });
  it('prompt carries the reference persona, the date anchor, and the voice rules', () => {
    expect(SYSTEM_PROMPT).toContain('You are Ava, the scheduling assistant for Bright Smile Dental.');
    expect(SYSTEM_PROMPT).toContain('2026-09-21');
    expect(SYSTEM_PROMPT).toContain('No markdown');
    expect(BEGIN_MESSAGE.length).toBeGreaterThan(0);
  });
});
