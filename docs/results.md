# Results

Generated 2026-09-21T02:25:06.794Z against `ws://127.0.0.1:49564/llm-websocket`, 3 run(s) per scenario. Written by `npm run results` from the bench's JSON output; do not edit by hand.

| scenario | runs | ttfs p50 | ttfs p90 | complete | missing | unnecessary | duplicate | violations | text miss | must complete |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| book-appointment | 3 | 1559 ms | 2333 ms | 3/3 | 0 | 0 | 0 | 0 | 0 | ok |
| caller-goes-quiet | 3 | 1376 ms | 1394 ms | 6/6 | 0 | 0 | 0 | 0 | 0 | ok |
| caller-says-goodbye | 3 | 1331 ms | 1566 ms | 3/3 | 0 | 0 | 0 | 0 | 0 | ok |
| change-mind-before-booking | 3 | 1228 ms | 1319 ms | 3/3 | 0 | 0 | 0 | 0 | 0 | ok |
| clinical-question | 3 | 1375 ms | 1651 ms | 3/3 | 0 | 0 | 0 | 0 | 0 | ok |
| fee-not-in-kb | 3 | 1455 ms | 1675 ms | 3/3 | 0 | 0 | 0 | 0 | 0 | ok |
| interrupt-mid-sentence | 3 | 1654 ms | 1939 ms | 3/3 | 0 | 0 | 0 | 0 | 0 | ok |
| reschedule-appointment | 3 | 968 ms | 1721 ms | 6/6 | 2 | 0 | 0 | 0 | 0 | ok |
| unintelligible-audio | 3 | 1438 ms | 1445 ms | 3/3 | 0 | 0 | 0 | 0 | 0 | ok |

## Findings

- `reschedule-appointment` tool_missing: run 1: expected book_appointment {"date":"2026-09-25","time":"15:00"} was never invoked
- `reschedule-appointment` tool_missing: run 3: expected book_appointment {"date":"2026-09-25","time":"15:00"} was never invoked

## Transcript diffs

Expected lines are each scenario's `expect.agent_transcript` (the author's reference wording); actual lines are what the server said after the begin message. Informational: wording drift is shown, not scored.

### book-appointment run 1

~~~diff
--- expected
+++ actual
-One moment while I book that. You are all set for September 24th at 2pm.
+One moment while I book your cleaning for September 24th at 2pm. You're all set for a cleaning on September 24th at 2pm, confirmation number BSD-0001. Is there anything else I can help with?
~~~

### book-appointment run 2

~~~diff
--- expected
+++ actual
-One moment while I book that. You are all set for September 24th at 2pm.
+I'll book that cleaning for you now.One moment while I book your cleaning for September 24th at 2pm. You're all set for a cleaning on Thursday, September 24th at 2pm, confirmation number BSD-0002. Anything else I can help with?
~~~

### book-appointment run 3

~~~diff
--- expected
+++ actual
-One moment while I book that. You are all set for September 24th at 2pm.
+September 24th, 2026 is a Thursday, so that works well.One moment while I book your cleaning appointment. You're all set for a cleaning on Thursday, September 24th at 2pm, confirmation number BSD-0003. Anything else I can help with?
~~~

### caller-goes-quiet run 1

~~~diff
--- expected
+++ actual
-Of course, what day and time work for you?
-Are you still there? Let me know when you would like to come in.
+Sure, I'd be happy to help. What day and time works best for you, and what type of appointment are you looking to book?
+Still there? Whenever you're ready, just let me know what day and time you'd like to come in.
~~~

### caller-goes-quiet run 2

~~~diff
--- expected
+++ actual
-Of course, what day and time work for you?
-Are you still there? Let me know when you would like to come in.
+Sure, I can help with that. What day and time would you like to come in?
+Take your time — whenever you're ready, just let me know what day and time works best for you.
~~~

### caller-goes-quiet run 3

~~~diff
--- expected
+++ actual
-Of course, what day and time work for you?
-Are you still there? Let me know when you would like to come in.
+Sure, I'd be happy to help with that. What day and time work best for you, and is there a particular type of appointment you need?
+Are you still there? Just let me know what day and time you'd like to come in.
~~~

### caller-says-goodbye run 1

~~~diff
--- expected
+++ actual
-Thanks for calling Bright Smile Dental, goodbye.
+You're welcome, goodbye!
~~~

### caller-says-goodbye run 2

~~~diff
--- expected
+++ actual
-Thanks for calling Bright Smile Dental, goodbye.
+It seems I don't have any prior context of us discussing an appointment, but if that's all you needed, have a great day!Have a great day, goodbye!
~~~

### caller-says-goodbye run 3

~~~diff
--- expected
+++ actual
-Thanks for calling Bright Smile Dental, goodbye.
+It seems like we haven't actually scheduled or discussed anything yet, but if you're all set, I'll say goodbye!You're welcome, have a great day, goodbye!
~~~

### change-mind-before-booking run 1

~~~diff
--- expected
+++ actual
-No problem, I will hold off. Call back whenever you are ready.
+No problem, I won't book anything yet. Just call back whenever you're ready, or let me know if you'd like to check another time now.
~~~

### change-mind-before-booking run 2

~~~diff
--- expected
+++ actual
-No problem, I will hold off. Call back whenever you are ready.
+Sounds good, no problem. Just give me a call back whenever you and your wife have decided on a time.
~~~

### change-mind-before-booking run 3

~~~diff
--- expected
+++ actual
-No problem, I will hold off. Call back whenever you are ready.
+No problem, take your time. Just call back or let me know when you're ready to book, and I'll be happy to help.
~~~

### clinical-question run 1

~~~diff
--- expected
+++ actual
-I am not able to give clinical advice, but I can take a message for the dentist. Would you like me to do that?
+I'm sorry you're dealing with that, but I'm not able to give medical or medication advice. I can take a message for the dentist to call you back, or I can get you in for an appointment as soon as possible — which would you prefer?
~~~

### clinical-question run 2

~~~diff
--- expected
+++ actual
-I am not able to give clinical advice, but I can take a message for the dentist. Would you like me to do that?
+I'm sorry you're dealing with that, but I'm not able to give medical or medication advice. I can take a message for the dentist to call you back, or find you the soonest available appointment — would either of those help?
~~~

### clinical-question run 3

~~~diff
--- expected
+++ actual
-I am not able to give clinical advice, but I can take a message for the dentist. Would you like me to do that?
+I'm sorry to hear that, but I'm not able to give medical advice like which painkiller to take. I can take a message for the dentist to call you back, or I can get you in for an appointment as soon as possible. Would you like me to do either of those?
~~~

### fee-not-in-kb run 1

~~~diff
--- expected
+++ actual
-I do not have pricing in front of me, but the front desk can quote you. Would you like me to take a message?
+I'm sorry, I don't have pricing information for crowns. I'd be happy to take a message for the dentist or front desk to get you an exact quote — would that work?
~~~

### fee-not-in-kb run 2

~~~diff
--- expected
+++ actual
-I do not have pricing in front of me, but the front desk can quote you. Would you like me to take a message?
+I'm sorry, I don't have pricing details for crowns on hand. I can take a message for the front desk to call you back with that information, or help you schedule an appointment. Which would you prefer?
~~~

### fee-not-in-kb run 3

~~~diff
--- expected
+++ actual
-I do not have pricing in front of me, but the front desk can quote you. Would you like me to take a message?
+I'm sorry, I don't have pricing information for crowns. I can take a message for the front desk to call you back with that detail, or help you book an appointment. Which would you like?
~~~

### interrupt-mid-sentence run 1

~~~diff
--- expected
+++ actual
-One moment while I book that. You are all set for September 24th at 3pm.
+One moment while I book your 3pm appointment on September 24th. You're all set for 3pm on September 24th, confirmation number BSD-0004. Anything else I can help with?
~~~

### interrupt-mid-sentence run 2

~~~diff
--- expected
+++ actual
-One moment while I book that. You are all set for September 24th at 3pm.
+I'll get you booked for September 24th at 3pm.One moment while I book your 3pm appointment on September 24th. You're all set for Thursday, September 24th at 3pm, confirmation BSD-0005. Anything else I can help with?
~~~

### interrupt-mid-sentence run 3

~~~diff
--- expected
+++ actual
-One moment while I book that. You are all set for September 24th at 3pm.
+One moment while I book your appointment for September 24th at 3pm. You're all set for Thursday, September 24th at 3pm, confirmation number BSD-0006. Anything else I can help with?
~~~

### reschedule-appointment run 1

~~~diff
--- expected
+++ actual
-Sure, what day and time would you like instead?
-One moment while I move that. You are all set for September 25th at 3pm.
+What date and time would you like to move it to?
+September 25th is a Friday, so that works within office hours. Should I go ahead and move your appointment to September 25th at 3pm?
~~~

### reschedule-appointment run 2

~~~diff
--- expected
+++ actual
-Sure, what day and time would you like instead?
-One moment while I move that. You are all set for September 25th at 3pm.
+I can help with that. What new date and time would you like for your appointment?
+One moment while I move your appointment to September 25th at 3pm. You're all set, your appointment is now on September 25th at 3pm. Is there anything else I can help with?
~~~

### reschedule-appointment run 3

~~~diff
--- expected
+++ actual
-Sure, what day and time would you like instead?
-One moment while I move that. You are all set for September 25th at 3pm.
+What day and time would you like to move it to?
+September 25th is a Friday, so that time works fine for our office hours. Shall I go ahead and move your appointment to 3pm on September 25th?
~~~

### unintelligible-audio run 1

~~~diff
--- expected
+++ actual
-Sorry, I did not catch that. Could you say it again?
+I'm sorry, I didn't quite catch that — could you repeat what you'd like to do, like booking, moving, or canceling an appointment?
~~~

### unintelligible-audio run 2

~~~diff
--- expected
+++ actual
-Sorry, I did not catch that. Could you say it again?
+I'm sorry, I didn't catch that. Could you tell me if you'd like to book, move, or cancel an appointment?
~~~

### unintelligible-audio run 3

~~~diff
--- expected
+++ actual
-Sorry, I did not catch that. Could you say it again?
+I'm sorry, I didn't catch that. Could you please repeat what you'd like to do—book, move, or cancel an appointment?
~~~
