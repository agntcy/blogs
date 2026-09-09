# AGNTCY Blogs

This repository hosts the source code for the [AGNTCY](https://agntcy.org) engineering blog.  Our
mission is to share technical insights, deep-dives, and updates about the
open-source projects and technologies developed at AGNTCY, including:

*   [Agent Directory Service](https://github.com/agntcy/dir): The trusted registry
for discovering and verifying AI agents.
*   [OASF (Open Agent Safety Framework)](https://github.com/agntcy/oasf):
Standards and tooling for responsible and safe agentic systems.
*   [Slim](https://github.com/agntcy/slim): A lightweight, efficient
framework for building production-ready AI agents.

## Local Development

This site is built with [Jekyll](https://jekyllrb.com/) and managed with
[Task](https://taskfile.dev/).

### Prerequisites

*   Ruby 3.0 or higher
*   [Task](https://taskfile.dev/installation/)
*   Bundler (`gem install bundler`)
*   [Lychee](https://github.com/lycheeverse/lychee) (for link checking)
*   [Codespell](https://github.com/codespell-project/codespell) (for spelling; `pip install codespell`)
*   [PyMarkdown](https://github.com/jackdewinter/pymarkdown) (for Markdown; `pip install pymarkdownlnt`)
*   Node.js 20.19.5 or higher (only for building slide decks under `presentations/`).
    `task run` still starts the Jekyll site if your Node version is older; the
    embedded slides are skipped.

### Usage

Use the `Taskfile` to manage common operations:

1.  Install dependencies:
    ```bash
    task deps
    ```

2.  Run the local development server:
    ```bash
    task run
    ```
    The site will be available at [http://0.0.0.0:4000/](http://0.0.0.0:4000/).

3.  Build the static site:
    ```bash
    task build
    ```
    The output will be generated in the `_site/` directory.

4.  Lint spelling, Markdown, and links:
    ```bash
    task lint
    ```
    This runs [Codespell](https://github.com/codespell-project/codespell) and
    [PyMarkdown](https://github.com/jackdewinter/pymarkdown) on the source, then
    builds the Jekyll site and checks `_site/` with
    [Lychee](https://github.com/lycheeverse/lychee). Slide decks are not required
    for local lint; CI builds them and checks their links. Link checks also run
    daily on `main`. Use `task lint:fix` to apply automatic spelling and Markdown
    fixes.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to propose posts, submit pull
requests, and work with maintainers.

Please adhere to [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for all commit messages.
Review `.github/CODEOWNERS` for repository maintainers.
