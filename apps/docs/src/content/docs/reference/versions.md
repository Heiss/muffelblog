---
title: Supported versions
description: Which versions of Memos and Nextcloud Muffelblog is tested against.
---

Muffelblog talks to the APIs of Memos and Nextcloud. Their APIs change between
versions, so the project supports **pinned versions** and tests each of them in
CI against a real instance (contract tests).

| Source    | Current         | Previous        |
| --------- | --------------- | --------------- |
| Memos     | `26.11.0`       | `26.10.0`       |
| Nextcloud | `35.0.2-apache` | `34.0.5-apache` |

The versions are the image tags of `neosmemo/memos` and `nextcloud`. Other
versions may work, but they are not tested. Remark42 and Caddy run inside the
blog's own stack and are pinned in `compose.yaml`.

## How the list moves

- The list lives in `supported-versions.json` in the repository. CI runs the
  contract tests against both lines in parallel.
- When a new version is published, Renovate opens a pull request that raises
  _Current_. The contract tests of that pull request show whether the new
  version works. In the same pull request _Previous_ becomes the old _Current_.
- A version that fails its contract test is not supported until the code is
  fixed.
