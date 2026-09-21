# Results

Generated 2026-09-21T03:03:06.520Z against `ws://127.0.0.1:50903/llm-websocket`, 3 run(s) per scenario. Written by `npm run results` from the bench's JSON output; do not edit by hand.

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

## Findings

- `interrupt-mid-sentence` tool_args_mismatch: run 1: book_appointment {"date":"2026-09-24","time":"14:00"} invoked, but no expected book_appointment entry matches these arguments (info)
- `interrupt-mid-sentence` tool_args_mismatch: run 2: book_appointment {"date":"2026-09-24","time":"14:00"} invoked, but no expected book_appointment entry matches these arguments (info)
- `interrupt-mid-sentence` tool_args_mismatch: run 3: book_appointment {"date":"2026-09-24","time":"14:00"} invoked, but no expected book_appointment entry matches these arguments (info)
- `reschedule-appointment` tool_missing: run 1: expected book_appointment {"date":"2026-09-25","time":"15:00"} was never invoked
- `reschedule-appointment` tool_missing: run 2: expected book_appointment {"date":"2026-09-25","time":"15:00"} was never invoked

## Transcript diffs

Expected lines are each scenario's `expect.agent_transcript` (the author's reference wording); actual lines are what the server said after the begin message. Informational: wording drift is shown, not scored.

### book-appointment run 1

~~~diff
--- expected
+++ actual
-One moment while I book that. You are all set for September 24th at 2pm.
+One moment while I book your cleaning for September 24th at 2pm. You're all set for a cleaning on September 24th at 2pm, confirmation number BSD-0001. Anything else I can help with?
~~~

### book-appointment run 2

~~~diff
--- expected
+++ actual
-One moment while I book that. You are all set for September 24th at 2pm.
+One moment while I book your cleaning for September 24th at 2pm. You're all set for a cleaning on September 24th at 2pm, confirmation number BSD-0002. Is there anything else I can help with?
~~~

### book-appointment run 3

~~~diff
--- expected
+++ actual
-One moment while I book that. You are all set for September 24th at 2pm.
+Sure, let me get that booked for you. Booking your cleaning appointment now. You're all set for a cleaning on Thursday, September 24th at 2pm, confirmation number BSD-0003. Anything else I can help with?
~~~

### caller-goes-quiet run 1

~~~diff
--- expected
+++ actual
-Of course, what day and time work for you?
-Are you still there? Let me know when you would like to come in.
+Sure, I'd be happy to help. What day and time work best for you, and is this a cleaning, check-up, or something else?
+Just checking, are you still there? Let me know what day and time work for you.
~~~

### caller-goes-quiet run 2

~~~diff
--- expected
+++ actual
-Of course, what day and time work for you?
-Are you still there? Let me know when you would like to come in.
+I'd be happy to help. What date and time works best for you?
+Take your time — whenever you're ready, just let me know what day and time you'd like to come in.
~~~

### caller-goes-quiet run 3

~~~diff
--- expected
+++ actual
-Of course, what day and time work for you?
-Are you still there? Let me know when you would like to come in.
+I'd be happy to help. What day and time would work best for you?
+Still there? Just let me know what day and time you'd like to come in.
~~~

### caller-says-goodbye run 1

~~~diff
--- expected
+++ actual
-Thanks for calling Bright Smile Dental, goodbye.
+You're welcome, goodbye and have a great day!
~~~

### caller-says-goodbye run 2

~~~diff
--- expected
+++ actual
-Thanks for calling Bright Smile Dental, goodbye.
+It looks like we haven't actually gotten anything set up yet, but if that's all you needed, that's totally fine! Have a great day, bye. Have a great day, goodbye!
~~~

### caller-says-goodbye run 3

~~~diff
--- expected
+++ actual
-Thanks for calling Bright Smile Dental, goodbye.
+It seems like there was no prior interaction, but I'll go ahead and say goodbye warmly! You're welcome, have a great day, goodbye!
~~~

### change-mind-before-booking run 1

~~~diff
--- expected
+++ actual
-No problem, I will hold off. Call back whenever you are ready.
+No problem at all. Take your time, and just call back or let me know when you're ready to book.
~~~

### change-mind-before-booking run 2

~~~diff
--- expected
+++ actual
-No problem, I will hold off. Call back whenever you are ready.
+No problem, take your time. Just call back or let me know whenever you're ready to book.
~~~

### change-mind-before-booking run 3

~~~diff
--- expected
+++ actual
-No problem, I will hold off. Call back whenever you are ready.
+No problem, take your time. Just call back or let me know here whenever you're ready to book, and I'll be happy to help.
~~~

### clinical-question run 1

~~~diff
--- expected
+++ actual
-I am not able to give clinical advice, but I can take a message for the dentist. Would you like me to do that?
+I'm sorry to hear that, but I can't give advice on medication since that's a clinical question. I can pass a message along to the dentist about your pain, or I can get you in for an appointment as soon as possible — would either of those help?
~~~

### clinical-question run 2

~~~diff
--- expected
+++ actual
-I am not able to give clinical advice, but I can take a message for the dentist. Would you like me to do that?
+I'm sorry to hear that, but I'm not able to give medical or medication advice. I can take a message for the dentist to call you back, and I'd also recommend getting you in for an appointment as soon as possible — would you like me to check for the soonest available slot?
~~~

### clinical-question run 3

~~~diff
--- expected
+++ actual
-I am not able to give clinical advice, but I can take a message for the dentist. Would you like me to do that?
+I'm sorry you're dealing with that, but I'm not able to give medical or medication advice. I can take a message for the dentist to call you back, or I can get you in for an appointment as soon as possible — which would you prefer?
~~~

### fee-not-in-kb run 1

~~~diff
--- expected
+++ actual
-I do not have pricing in front of me, but the front desk can quote you. Would you like me to take a message?
+I'm sorry, I don't have pricing information for procedures like crowns. I'd be happy to have the front desk call you back with those details, or I can take a message for the dentist. Would either of those work?
~~~

### fee-not-in-kb run 2

~~~diff
--- expected
+++ actual
-I do not have pricing in front of me, but the front desk can quote you. Would you like me to take a message?
+I'm sorry, I don't have pricing information for procedures like crowns. I'd be happy to take a message for the dentist or you could call our front desk directly for exact pricing — would you like me to do that?
~~~

### fee-not-in-kb run 3

~~~diff
--- expected
+++ actual
-I do not have pricing in front of me, but the front desk can quote you. Would you like me to take a message?
+I'm sorry, I don't have pricing information for crowns. I'd be happy to take a message for the dentist or have the front desk call you back with the cost—would that work?
~~~

### interrupt-mid-sentence run 1

~~~diff
--- expected
+++ actual
-One moment while I book that. You are all set for September 24th at 3pm.
+One moment while I book your appointment for September 24th at 2pm.
+One moment while I book your appointment for September 24th at 3pm. You're all set for September 24th at 3pm, confirmation number BSD-0005. Anything else I can help with?
~~~

### interrupt-mid-sentence run 2

~~~diff
--- expected
+++ actual
-One moment while I book that. You are all set for September 24th at 3pm.
+One moment while I book your appointment for September 24th at 2pm.
+Got it, I'll book you for 3pm instead. One moment while I book your appointment for September 24th at 3pm. You're all set for Thursday, September 24th at 3pm, confirmation number BSD-0007. Is there anything else I can help with?
~~~

### interrupt-mid-sentence run 3

~~~diff
--- expected
+++ actual
-One moment while I book that. You are all set for September 24th at 3pm.
+One moment while I book that for you.
+One moment while I book you for 3pm on September 24th. You're all set for Thursday, September 24th at 3pm, confirmation number BSD-0009. Anything else I can help with?
~~~

### reschedule-appointment run 1

~~~diff
--- expected
+++ actual
-Sure, what day and time would you like instead?
-One moment while I move that. You are all set for September 25th at 3pm.
+What day and time would you like to move it to?
+September 25th falls on a Friday, which works — that's within our office hours. Just to confirm, I'll move your appointment from September 22nd at 10am to September 25th at 3pm. Shall I go ahead?
~~~

### reschedule-appointment run 2

~~~diff
--- expected
+++ actual
-Sure, what day and time would you like instead?
-One moment while I move that. You are all set for September 25th at 3pm.
+What day and time would you like to move it to?
+September 25th is a Friday, so that works within our office hours. Shall I go ahead and move your appointment to 3pm on September 25th?
~~~

### reschedule-appointment run 3

~~~diff
--- expected
+++ actual
-Sure, what day and time would you like instead?
-One moment while I move that. You are all set for September 25th at 3pm.
+What day and time would you like to move it to?
+September 25th is a Friday, so that works with our office hours. I'll move your appointment to 3pm on September 25th. One moment while I move your appointment to September 25th at 3pm. You're all set, your appointment is now on Friday, September 25th at 3pm, confirmation number BSD-0010. Anything else I can help with?
~~~

### unintelligible-audio run 1

~~~diff
--- expected
+++ actual
-Sorry, I did not catch that. Could you say it again?
+I'm sorry, I didn't quite catch that. Could you tell me if you'd like to book, move, or cancel an appointment?
~~~

### unintelligible-audio run 2

~~~diff
--- expected
+++ actual
-Sorry, I did not catch that. Could you say it again?
+I'm sorry, I didn't quite catch that — could you repeat what you said?
~~~

### unintelligible-audio run 3

~~~diff
--- expected
+++ actual
-Sorry, I did not catch that. Could you say it again?
+I'm sorry, I didn't quite catch that — could you repeat what you said?
~~~
