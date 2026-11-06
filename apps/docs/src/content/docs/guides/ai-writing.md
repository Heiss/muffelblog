---
title: Write with an AI assistant
description: A reusable instruction file for AI-generated Muffelblog posts and glossary entries in Nextcloud.
---

Give your AI assistant the [complete authoring instructions](/muffelblog/authoring.md).
They cover the exact YAML fields, Markdown content, Nextcloud paths, links,
images, draft publication, glossary structure and comment settings, with complete
post and glossary examples.

The plain Markdown file is self-contained, so you can download it and attach it
to an AI conversation. You can also keep a copy as `AI-AUTHORING.md` in your
Nextcloud content folder. It has no publishing frontmatter and is ignored by
Muffelblog. Refresh your copy when the site's content rules change.

## Copy this prompt

```text
Read and follow https://heiss.github.io/muffelblog/authoring.md.
Help me create a Muffelblog Markdown file for my Nextcloud content folder.

Kind: [blog post or glossary term]
Topic / exact term: [...]
Audience, purpose and language: [...]
Length and tone: [...]
Facts and sources to use: [...]
Existing files and available images: [...]
Publication date: [...]
Publication: [draft or approved for publication]
Comments on the blog page: [enabled or existing comments only]
Remark42 server closure: [no change or I also want to close the discussion]

Reuse choices I already supplied. Ask about missing essential information.
If publication is not approved, keep publish: false.
Return the relative filename and complete Markdown file, with any unresolved
questions or manual Remark42 actions outside the file. Do not invent sources,
images or links, and do not claim you uploaded or published anything.
```

Replace the bracketed prompts with your brief; they are not frontmatter fields.
If your assistant cannot open links, attach the downloaded instruction file or
paste its contents before the prompt.

## Review before publishing

Check facts, sources, file paths, date, tags and the requested comment behavior.
The AI's output is a draft to review, not a guarantee of factual accuracy. Save
the `.md` file and any real images in the configured Nextcloud folder. Change
`publish: false` to `publish: true` only when you want the file on the blog.
After the builder runs, check the resulting page and build warnings.

`comments: false` keeps the existing static comments and removes the posting
widget after a build. For server-side closure, sign in as the Remark42
administrator and use **Disable comments** for that discussion. The AI should
explain that manual action rather than pretend frontmatter changes the server.

See [Writing](/muffelblog/guides/writing/) for the regular authoring reference and
[Comments](/muffelblog/guides/comments/) for the independent comment controls.
