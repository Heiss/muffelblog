---
title: Addresses
description: All pages of the site and what they show.
---

| Address                                                                                      | Shows                                                                             |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `/`                                                                                          | The feed: posts, memos and terms, newest first, in blocks; endless scroll         |
| `/posts/`, `/memos/`, `/terms/`                                                              | The same feed filtered to _Lang_, _Kurz_, _Begriffe_                              |
| `/page/N/` (also `/posts/page/N/`, `/memos/page/N/`, `/terms/page/N/`, `/tag/<tag>/page/N/`) | Block N of a feed, for readers without JavaScript. Not indexed by search engines. |
| `/p/<slug>/`                                                                                 | A post                                                                            |
| `/m/<id>/`                                                                                   | A memo                                                                            |
| `/g/<slug>/`                                                                                 | A glossary term                                                                   |
| `/glossary/`                                                                                 | All terms by letter                                                               |
| `/tag/`, `/tag/<tag>/`                                                                       | Tag overview and the entries of one tag                                           |
| `/search/`                                                                                   | Search                                                                            |
| `/<slug>/`                                                                                   | A static page (`type: page`), for example `/impressum/`                           |
| `/feed.xml`                                                                                  | RSS (only with `SITE_URL`)                                                        |
| `/sitemap.xml`                                                                               | Sitemap (only with `SITE_URL`)                                                    |
| `/robots.txt`                                                                                | Allows crawling; names the sitemap when `SITE_URL` is set                         |
| `/404.html`                                                                                  | Page for unknown addresses                                                        |
| `/build.json`                                                                                | `{"id": ..., "builtAt": ...}` of the release that is online                       |

The addresses are English and do not depend on the interface language.
