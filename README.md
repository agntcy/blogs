# AGNTCY Blogs

This repository hosts the source code for the AGNTCY engineering blog.  Our
mission is to share technical insights, deep-dives, and updates about the
open-source projects and technologies developed at **AGNTCY**, including:

*   **[Agent Directory](https://github.com/agntcy/dir)**: The trusted registry
for discovering and verifying AI agents.
*   **[OASF (Open Agent Safety Framework)](https://github.com/oasf/oasf)**: 
Standards and tooling for responsible and safe agentic systems.
*   **[Slim](https://github.com/agntcy/slim)**: A lightweight, efficient 
framework for building production-ready AI agents.

## Local Development

This site is built with [Jekyll](https://jekyllrb.com/) and managed with
[Task](https://taskfile.dev/).

### Prerequisites

*   Ruby 3.0 or higher
*   [Task](https://taskfile.dev/installation/)
*   Bundler (`gem install bundler`)

### Usage

Use the `Taskfile` to manage common operations:

1.  **Install dependencies**:
    ```bash
    task deps
    ```

2.  **Run the local development server**:
    ```bash
    task run
    ```
    The site will be available at [http://0.0.0.0:4000/blogs/](http://0.0.0.0:4000/blogs/).

3.  **Build the static site**:
    ```bash
    task build
    ```
    The output will be generated in the `_site/` directory.

## Contributing

Please adhere to [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for all commit messages.
Review `.github/CODEOWNERS` for repository maintainers.
