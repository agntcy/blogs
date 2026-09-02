# How to Contribute

Thanks for your interest in contributing to the [AGNTCY](https://agntcy.org)
engineering blog. This guide covers how to propose posts, submit changes, and
work with the project maintainers.

Following these guidelines helps to communicate that you respect the time of the
contributors managing this project. In return, they should reciprocate that
respect in addressing your issue, assessing changes, and helping you finalize
your pull requests. In that spirit of mutual respect, we endeavor to review
incoming issues and pull requests within 10 days, and will close any lingering
issues or pull requests after 60 days of inactivity.

Please note that all of your interactions in the project are subject to our
[Code of Conduct](CODE_OF_CONDUCT.md). This includes creation of issues or pull
requests, commenting on issues or pull requests, and extends to all interactions
in any real-time space, for example Slack.

## Community

Join the [AGNTCY Slack workspace](https://join.slack.com/t/agntcy/shared_invite/zt-3xozr6nzq-i6LXv2P8l2kVW4_Prnny2w)
to ask questions, get help, and connect with other contributors.

Repository maintainers are listed in [`.github/CODEOWNERS`](.github/CODEOWNERS).
Open a GitHub issue or pull request to start a discussion in the open; use Slack
when you need a quicker, informal conversation.

## Reporting Issues

Before reporting a new issue, please ensure that the issue was not already
reported or fixed by searching through our
[issues list](https://github.com/agntcy/blogs/issues).

When creating a new issue, include a **title and clear description**, and as
much relevant information as possible. For proposed posts, describe the topic,
intended audience, and how it relates to AGNTCY projects.

Typical issues include:

- Pitching a new blog post
- Reporting a factual error, broken link, or rendering bug
- Suggesting a site or workflow improvement

## Writing a Blog Post

New posts are the most common contribution to this repository.

1. Open an issue describing the post (recommended for new topics) so maintainers
   can confirm fit and scope before you write.
2. Copy [`_post_template.md`](_post_template.md) into `_posts/` and rename it.
   The filename must be `YYYY-MM-DD-title-in-kebab-case.md`. For example, a post
   titled "My First Post" dated 12 January 2026 becomes
   `2026-01-12-my-first-post.md`.
3. Fill in the YAML front matter and write the post in Markdown.
4. Preview locally (see [Local development](#local-development)).
5. Open a pull request against `main`.

### Front matter

Use the fields from the template. Existing posts typically look like this:

```yaml
---
layout: post
title: "Your Post Title Here"
date: 2026-01-12 08:00:00 +0000
author: Your Name
author_url: https://github.com/your-handle
categories: [technical]
tags: [dir, slim, agents]
---
```

- `layout` must be `post`.
- `date` should match the filename date. The site deploys on a schedule, so set
  a future `date` if you want the post to appear at a specific publish time.
- `categories` commonly include `technical`, `architecture`, `security`,
  `operations`, `announcements`, or `vision`.
- Set `mermaid: true` in the front matter if the post contains Mermaid diagrams.

### Content

- Put an excerpt separator (`<!--more-->`) after the introduction. Text before
  it appears on the home page.
- Write original technical content about AGNTCY projects, related open-source
  work, or the Internet of Agents. Do not paste substantial copyrighted text
  from other sources.
- Do not include secrets, credentials, private keys, or unpublished internal
  information.
- Store figures in `assets/figures/` and reference them with a descriptive `alt`
  attribute, for example:

  ```html
  <img src="/assets/figures/your-figure.png" alt="Short description of the figure">
  ```

## Site and Infrastructure Changes

Changes to Jekyll configuration, layouts, styles, GitHub Actions, or Taskfile
targets are welcome. Before a large change, open an issue so maintainers can
discuss the approach. Keep the change focused: a post PR should not also
redesign the site, and an infrastructure PR should not also add a blog post.

Slide decks live under `presentations/` and are built with Slidev. If you add or
update a deck, preview it with the local workflow below.

## Local Development

The site is built with [Jekyll](https://jekyllrb.com/) and managed with
[Task](https://taskfile.dev/). You need Ruby 3.0 or higher, Bundler, and Task.

```bash
task deps
task run
```

The site will be available at [http://0.0.0.0:4000/](http://0.0.0.0:4000/).
See the [README](README.md) for additional commands, including `task build`.

## Sending Pull Requests

Before sending a new pull request, look at existing pull requests and issues to
see if the proposed change has already been discussed or implemented.

1. Fork the repository and create a branch from `main`.
2. Make your changes, following the [commit message guidelines](#commit-messages).
3. Sign off every commit (see [Developer’s Certificate of Origin](#developers-certificate-of-origin)).
4. Open a pull request against `main` and fill in the description. Link any
   related issue (for example, `Fixes #6`).
5. Respond to review comments. Maintainers may request edits for accuracy,
   clarity, or site conventions.

Pull requests that change `_posts/` or `presentations/` receive a preview
deployment. The GitHub Actions bot comments on the PR with a URL under
`https://blogs.agntcy.org/drafts/`. Use that preview to check layout, excerpts,
and figures before requesting a final review.

Once merged to `main`, the site is built and published to
[blogs.agntcy.org](https://blogs.agntcy.org). Production deploys also run on a
schedule, so a post dated in the future appears after that time.

## Commit Messages

This repository uses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
Keep the subject short, in the imperative mood, and prefixed with a type such as
`feat`, `fix`, `docs`, `chore`, or `ci`.

Examples from this project:

- `docs(blog): add lazydir v0.0.1 post`
- `fix(ci): only trigger PR preview when _posts/ changes`
- `chore: update slack invite link`

## Developer’s Certificate of Origin

To improve tracking of who did what, we have introduced a “sign-off” procedure.
The sign-off is a line at the end of the explanation for the commit, which
certifies that you wrote it or otherwise have the right to pass it on as open
source work. We use the [Developer Certificate of Origin](https://developercertificate.org/)
for our sign-off procedure. You must include a sign-off in the commit message of
your pull request for it to be accepted. The format for a sign-off is:

```text
Signed-off-by: Random J Developer <random@developer.example.org>
```

You can use `-s` when you do a git commit to include a properly formatted
sign-off. If you need to add your sign-off to a commit you have already made,
you will need to amend:

```bash
git commit --amend --signoff
```

## Engaging with Maintainers

Maintainers for this repository are listed in
[`.github/CODEOWNERS`](.github/CODEOWNERS). They review pull requests, advise on
whether a topic fits the blog, and merge accepted changes.

- Tag the relevant CODEOWNERS team only when you need a review or a decision.
- Keep discussion on the GitHub issue or pull request so the history stays
  public and searchable.
- If review feedback conflicts, follow the CODEOWNERS guidance.
- After 60 days of inactivity, lingering issues and pull requests may be closed.
  Comment on the thread if you plan to continue the work.

## Other Ways to Contribute

You do not need to write a full post to help. You can also:

- Triage issues and help authors fill in missing details
- Review open pull requests for technical accuracy and clarity
- Fix typos, broken links, and outdated figures in published posts
- Improve local development, preview, or deploy workflows

## License

Content in this repository is licensed under
[CC-BY-4.0](LICENSE.md). Copyright AGNTCY Contributors
(https://github.com/agntcy).
