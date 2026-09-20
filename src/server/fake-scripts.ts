import { reply, script, type FakeScript } from './fake.js';

export const SMOKE_SCRIPT: FakeScript = script({
  config: { auto_reconnect: true, call_details: true },
  begin: 'Hi, this is Ava at Bright Smile Dental. How can I help you today?',
  matchers: [
    { pattern: "don't book|check with", reply: reply({ chunks: [{ text: 'No problem, ', delayMs: 120 }, { text: 'I will hold off. ', delayMs: 80 }, { text: 'Call back whenever you are ready.', delayMs: 80 }] }) },
    {
      pattern: '\\b(2|3|10)\\s?(pm|am)\\b|september',
      reply: reply({
        chunks: [{ text: 'Sure, ', delayMs: 150 }, { text: 'let me get that booked. ', delayMs: 60 }, { text: 'You are all set.', delayMs: 200 }],
        toolCalls: [{ name: 'book_appointment', arguments: { date: '2026-09-24', time: '14:00' }, result: 'Booked 2026-09-24 14:00', afterChunk: 2 }],
      }),
    },
    {
      pattern: "bye|that's all",
      reply: reply({
        chunks: [{ text: 'Thanks for calling Bright Smile Dental, ', delayMs: 130 }, { text: 'goodbye.', delayMs: 60 }],
        toolCalls: [{ name: 'end_call', arguments: {}, result: 'ended', afterChunk: 2 }],
        endCall: true,
      }),
    },
    { pattern: 'unintelligible', reply: reply({ chunks: [{ text: 'Sorry, I did not catch that. ', delayMs: 110 }, { text: 'Could you say it again?', delayMs: 70 }] }) },
    { pattern: 'cost|price|how much', reply: reply({ chunks: [{ text: 'I do not have pricing in front of me, ', delayMs: 140 }, { text: 'but the front desk can quote you.', delayMs: 90 }] }) },
    { pattern: 'hurt|throbbing|painkiller', reply: reply({ chunks: [{ text: 'I am not able to give clinical advice, ', delayMs: 140 }, { text: 'but I can take a message for the dentist.', delayMs: 90 }] }) },
  ],
  fallback: reply({ chunks: [{ text: 'Sure. ', delayMs: 120 }, { text: 'What day and time work for you?', delayMs: 90 }] }),
});
