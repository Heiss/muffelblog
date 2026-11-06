# Example Nextcloud folder

A small, complete folder for the blog. It is the starting point of
[Connect Nextcloud](https://heiss.github.io/muffelblog/guides/nextcloud/) in the
documentation.

| File                     | What it is                                       |
| ------------------------ | ------------------------------------------------ |
| `hello-world.md`         | The first post, with a link, an image and tags   |
| `images/hello.jpg`       | A placeholder image (generated, not a photo)     |
| `glossary/webmention.md` | A glossary entry (`type: glossary`)              |
| `pages/legal.md`         | Legal notice, a **template with placeholders**   |
| `pages/privacy.md`       | Privacy policy, a **template with placeholders** |

This `README.md` has no frontmatter, so the blog ignores it.

**The legal pages are templates, not legal advice.** Every `[PLACEHOLDER]` must
be replaced and every `[CHECK: ...]` checked before the blog goes public.

Use it: upload the content of this folder (not the folder itself) to an empty
Nextcloud folder, share that folder by public link with a password, and point
the blog at the share. Details: the Nextcloud guide in the documentation.

## Writing with AI

Download the [AI authoring instructions](https://heiss.github.io/muffelblog/authoring.md)
and give them to your assistant along with the topic and available files. You can
keep the downloaded file as `AI-AUTHORING.md` here; it has no publishing
frontmatter, so Muffelblog ignores it. The guide includes post and glossary
examples, draft publication, exact YAML fields and the independent Markdown and
Remark42 comment controls. See the [AI writing guide](https://heiss.github.io/muffelblog/guides/ai-writing/)
for a prompt to copy.
