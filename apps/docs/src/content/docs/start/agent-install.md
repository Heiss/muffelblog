---
title: Install with an AI agent
description: A prompt that lets an AI agent read these docs, download the install scripts and set Muffelblog up with you, asking you for every choice.
---

If you work with an AI agent that can run commands (a coding agent in a terminal
or editor), it can do most of the installation with you. It reads this
documentation, downloads the project, writes `.env` and starts the stack, and it
**asks you** for every choice on the way.

## The prompt

Copy this into your agent. It is short on purpose: the agent loads
[`agent.md`](/muffelblog/agent.md) and then only the pages it needs.

```text
Install Muffelblog for me. First read https://heiss.github.io/muffelblog/agent.md
(if you cannot open web pages, run: curl -fsSL https://heiss.github.io/muffelblog/agent.md)
and follow it exactly. It tells you which documentation pages to load and in
what order. Ask me for every choice, one question at a time. Never ask me for a
password and never read my .env file after you have written it: I type the
passwords into .env myself. Ask before you start services, change a proxy
configuration or delete anything.
```

## What the agent does, and what it asks

1. Asks which setup you want: the **demo** on your machine, a **real blog behind
   your own reverse proxy**, or a **real blog with our Caddy and a domain**.
2. Sends you to [Prepare the sources](/muffelblog/tutorial/1-prepare/) for the
   Nextcloud folder and the memo, which only you can do, and waits.
3. Asks for the addresses, the mail settings and the language of the interface.
4. Downloads the project, creates `.env` (with its own random secrets) and writes
   all values **except two passwords**, which you type into `.env` yourself.
5. Checks the configuration, and **asks before it starts** anything or touches a
   proxy.
6. Checks with you that the first post and memo are online.

## Safety

- The agent runs commands on the machine it works on. Read what it plans to do
  before you say yes.
- Whatever you type into the chat goes to the provider of your AI service. That
  is why the agent never asks for passwords: the Nextcloud share password and the
  mail password go into `.env` by your hand.
- The agent should not print or read your secrets. It checks only that the lines
  are filled in. If your agent does not keep to that, do the `.env` step yourself
  and follow the [Tutorial](/muffelblog/tutorial/2-publish/).
- The steps inside Nextcloud, Memos and your mail provider are described from
  their documentation and were not checked against a live instance.
