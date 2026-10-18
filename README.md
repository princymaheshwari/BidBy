# BidBy

**Your money deadlines, ranked by what they'd cost you, in the iMessage thread you already read.**

Built solo for Hack Like W@CC 2026, Finance track.

## The problem

As a college student, my phone and laptop are flooded all day. Homework deadlines, emails from my research PI, GitHub notifications, sign-in codes from a dozen AI tools, club newsletters, bank promos: everything pings, and everything looks urgent.

The messages that actually cost money get buried in that noise. A FAFSA verification request that puts $3,700 of aid on hold until I send two documents. A scholarship that closes in 44 hours. A credit card payment that turns into a late fee tomorrow night. A travel reimbursement window that quietly closes on Friday. These are the messages with real money and a hard deadline attached, and they are exactly the ones I miss.

## What BidBy does

BidBy is an agent platform, powered by OpenClaw, that reads the places where money obligations hide: your email, your Slack, your bank alerts. It pulls out every financial obligation it finds, with the dollar amount at stake and the deadline. It hands each kind of obligation to its own specialist agent: financial aid, credit cards, subscriptions, and money owed to you. Those agents **bid against each other** for your attention. BidBy scores every bid on the money at risk and how little time is left, so the one thing that would cost you most to miss rises to the top.

BidBy doesn't live in another app you'll forget to open. It lives in **iMessage**. It texts you about the one item that matters right now: what is due, how much is at stake, and when. You reply right there in the thread.

It is also not just a reminders app. Before it ever texts you, the agent has already started the work. It pulls up the documents you need from your own files and tells you which ones are still missing. It drafts the email to the financial aid office for you. It finds the campus help that applies, like a financial aid appeal or an emergency grant. If a high-stakes deadline is hours away and you still haven't answered, BidBy **calls you**. You can talk it through, snooze it, or tell it you're done, and the ledger updates while you speak.

BidBy helps you navigate the financial systems around you, from financial aid and card issuers to subscriptions, payroll and reimbursements, in one place that lives in your iMessage. It is not another finance course and not another budgeting app. It gets the money-and-deadline work done.

## Features

1. **Reads where money obligations hide.** BidBy reads incoming email, Slack posts and bank alerts and turns each money-related message into an entry in your ledger, with the amount at risk, the deadline, what happens if you miss it, and what you need to do. A second reminder about the same bill is merged into the existing entry instead of creating a duplicate. Newsletters, promos and club emails are recognized as noise and never reach the ledger. This build reads a realistic sample inbox of sixteen messages from a fictional university plus a few held-back messages that arrive live during the demo, so you can watch the whole flow without connecting a real account.

2. **Catches phishing before it costs you.** Messages that look like scams, such as a "FAFSA account locked, verify your SSN" email from a lookalike domain, are flagged as suspicious and BidBy takes no action on them. They never become obligations, and BidBy never texts you a link from them. This matters because fake financial aid and bank emails target exactly the students BidBy is built for.

3. **Agents bid for your attention.** Each kind of obligation has its own specialist agent: one for financial aid, one for credit cards, one for subscriptions, and one for money owed to you, like scholarships, reimbursements and paychecks. The agents bid on their items, arguing how much money is at stake, how much effort it takes, whether the loss can be undone, and whether it blocks other aid. BidBy then ranks everything with one fixed formula, so the order is always explainable and never decided by a language model. A coordinator agent explains the ranking in a sentence or two, such as "FAFSA verification ranks first: $3,700 at risk, due in under three hours, and it blocks other aid."

4. **Lives in your iMessage.** BidBy texts you only about the single item that costs most to miss, and only when it clears a real threshold, so your phone doesn't become one more noisy feed. The first text says what is due, how much is at risk and when, with no links. You answer in plain replies: 1 for the drafted email, 2 for the document checklist, "done", "snooze 9pm", "status", or a question in your own words, which the right agent answers. It interrupts you at most twice a day, and everything else waits for a short morning digest.

5. **Does the first step for you.** Before BidBy interrupts you, the agent has already started the task. For a FAFSA verification, it finds your tax transcript among your files, notices that the signed verification worksheet is still missing, and builds a short checklist in the right order. It drafts a clear email to the financial aid office that says what you're submitting and asks one useful question. It also points you to the campus resources that apply, like the financial aid appeal and the emergency grant. You go from "I should deal with this" to "I just need to hit send" in one text.

6. **Follows up, then closes the loop.** If you don't answer, BidBy sends at most two short follow-ups, never more, so it never turns into spam. When a confirmation arrives, such as "We have received your verification documents" or "Payment received", BidBy marks the item done on its own. It keeps a running "dollars protected this month" total, so you can see what staying on top of these deadlines saved you.

7. **Calls you when it really matters.** When an item has a lot of money at stake, its deadline is less than twelve hours away, and you have stopped answering texts, BidBy calls you. The call is a real two-way voice conversation with an agent that knows your item (see the voice agent section below). If you decline or miss the call, BidBy sends exactly one text so the deadline isn't lost.

8. **A live window for judges.** The dashboard shows what normally happens out of sight: the ledger with "money at risk this week" and "money protected this month", each agent's bid with its argument and score, and a live feed of everything BidBy does, from "aid agent bid $3,700" to "Text sent" to "Call: snooze_obligation". A demo clock lets you jump to 9 PM and watch the escalation happen in seconds. Every number on the screen comes from the live system, not from a script.

9. **Safe by design.** BidBy never moves money. It never pays, transfers, logs into a bank, or stores a card number; it sends you the step and you do it. It only acts on texts from your own phone number, and it can only call numbers you have explicitly allowed. The agents run on your own laptop, and nothing outside it can reach them.

## The BidBy voice agent (ElevenLabs)

1. **It rings like a phone call.** When BidBy escalates, your iPhone shows a full-screen incoming call from "BidBy", with Accept and Decline buttons and a ringtone, just like a normal call. Nothing about your finances appears on the screen; you hear it only once you pick up. In this build the call arrives on BidBy's call screen in Safari on your iPhone. Connecting a phone number turns it into an ordinary cellular call with the same agent.

2. **It opens with what's at stake.** The agent greets you with the exact item, deadline and amount, for example: "Hi, it's BidBy. FAFSA verification is due tonight at 11:59 PM, and 3,700 dollars is at stake. Do you have two minutes?" It speaks calmly in short sentences and asks one question at a time, so the call takes about a minute, not ten.

3. **It answers "what do I need to do?"** When you ask, the agent looks up the live details of your item while you're on the call. It tells you exactly which documents to submit, which ones you're still missing, and the next step, and it never invents financial information.

4. **It snoozes in your own words.** Say "remind me at 10 PM" or "in two hours" and the agent passes your words to BidBy, which sets the reminder on its own clock. The ledger changes while you are still on the call, and BidBy texts you again when the snooze runs out.

5. **It marks things done when you say so.** Tell it "I've already submitted it" and, once you confirm, the agent marks the item done. Follow-ups stop, and the money counts toward what you've protected this month.

6. **It never asks for anything sensitive.** The agent is instructed never to ask for passwords, card numbers or bank details, and never to start a payment or transfer. It only talks about the deadline and the steps you take yourself.

7. **It leaves a record.** When the call ends, BidBy saves a summary and the transcript of the conversation alongside the item. If you declined or missed the call, BidBy sends you exactly one text: "Couldn't reach you. FAFSA verification is still due tonight at 11:59 PM. Reply 1 for the draft."

## How it's built

1. **OpenClaw** is the engine. It runs BidBy's six agents (the message reader, the four specialist agents that bid, and the coordinator that explains the ranking) on your own laptop, each with its own playbook and only the tools it needs. The agents read your local files, and none of them can browse the web on their own.

2. **Photon Spectrum** connects BidBy to iMessage, so BidBy texts you and reads your replies in an ordinary iMessage thread, with no app to install.

3. **ElevenLabs Agents** powers the voice call: the "BidBy Voice" agent, its natural voice, and the three live tools it uses during a call (look up details, snooze, mark done). ElevenLabs sends BidBy a signed summary after each call.

4. **Cloudflare Tunnel** gives the voice agent and the iPhone call screen a secure way to reach BidBy on your laptop. Only the voice routes are reachable from outside, and each one checks a secret.

5. **Node.js and TypeScript** run BidBy's core, with **Hono** as the web server and Node's built-in **SQLite** keeping the ledger, the bids and the full event history in one local file.

6. **A plain web page** is the judge dashboard, and a second one is the iPhone call screen. Neither needs a build step or a framework.
