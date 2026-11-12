---
publish: true
title: Unsicherer Inhalt
created: 2026-02-02
---

Text vorher.

<script>window.__pwned = 1</script>

<img src="x" onerror="window.__pwned = 1" alt="kaputt">

[Gefährlicher Link](javascript:window.__pwned=1)

<iframe src="https://evil.example/seite"></iframe>

<form action="https://evil.example/post"><input name="x"></form>

Text nachher.
