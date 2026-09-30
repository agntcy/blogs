---
layout: post
title: "Native Directory Marketplace Plugins for Cursor and Claude Code"
date: 2026-09-22 13:15:00 +0000
author: Árpád Csepi
categories: technical
tags: [directory, mcp, cursor, claude-code, oasf]
mermaid: true
---

**TL;DR**: `dir-mcp` is now installable as a first-class plugin from the [AGNTCY Directory MCP repository](https://github.com/agntcy/dir-mcp). Add it to Cursor or Claude Code, and your assistant can discover, verify, and publish agent capabilities without leaving the editor.

<!--more-->

## From “what can this agent do?” to a useful answer

When you are building an agent, the hard part is often not writing another tool. It is finding an existing agent that already has the capability you need, understanding what it can be trusted to do, and making your own agent discoverable afterwards.

The [AGNTCY Directory](https://github.com/agntcy/dir) is designed for that workflow. It gives agents a shared catalog of capabilities, described as [OASF](https://github.com/agntcy/oasf) records. With `dir-mcp`, your AI assistant can use that catalog while you work:

- Search for agents by capability when you need to compose a solution;
- Verify an agent's authenticity and provenance before relying on it;
- Validate descriptions against the OASF schema and policies
- Publish your own agent so other builders can find it.

That turns the Directory from a separate registry you remember to visit into part of the development loop: discover, inspect, compose, and publish from the same place where you build.

## Install it where you already work

`dir-mcp` now ships native marketplace plugins for both Claude Code and Cursor. They expose the same Directory workflow and include ready-made skills for common tasks.

### Claude Code

From the terminal:

```bash
claude plugin marketplace add https://github.com/agntcy/dir-mcp
claude plugin install agntcy-dir@agntcy-dir-mcp
```

You can also add `agntcy/dir-mcp` from Claude Code's **Manage plugins** panel, then install `agntcy-dir` from the **Plugins** tab. The same marketplace is available in the Claude desktop app through its plugin browser.

### Cursor

In Cursor, open **Settings**, go to the **Plugins** marketplace, add `agntcy/dir-mcp` as a marketplace, and install `agntcy-dir`.

<figure style="margin: 1.5em 0;">
  <img src="{{ '/assets/images/2026-09-22-dir-mcp-marketplace-plugins/1-open-plugins.png' | relative_url }}" alt="Cursor command palette showing Open Plugins" style="width:100%; border-radius:6px; border:1px solid #d7dbe0;">
  <figcaption style="font-size:0.95em; margin-top:0.5em; color:#5b6470;">Open the Plugins panel from Cursor's command palette.</figcaption>
</figure>

<figure style="margin: 1.5em 0;">
  <img src="{{ '/assets/images/2026-09-22-dir-mcp-marketplace-plugins/2-browse-marketplace.png' | relative_url }}" alt="Cursor Plugins panel with the Browse Marketplace button" style="width:100%; border-radius:6px; border:1px solid #d7dbe0;">
  <figcaption style="font-size:0.95em; margin-top:0.5em; color:#5b6470;">From the Plugins panel, browse the marketplace to add a new source.</figcaption>
</figure>

<figure style="margin: 1.5em 0;">
  <img src="{{ '/assets/images/2026-09-22-dir-mcp-marketplace-plugins/3-add-from-github.png' | relative_url }}" alt="Add Marketplace menu with the Import from GitHub option" style="width:100%; border-radius:6px; border:1px solid #d7dbe0;">
  <figcaption style="font-size:0.95em; margin-top:0.5em; color:#5b6470;">Add a marketplace by importing it directly from a GitHub repository.</figcaption>
</figure>

<figure style="margin: 1.5em 0;">
  <img src="{{ '/assets/images/2026-09-22-dir-mcp-marketplace-plugins/4-import-dialog.png' | relative_url }}" alt="Import Marketplace dialog pointed at the dir-mcp repository" style="width:100%; border-radius:6px; border:1px solid #d7dbe0;">
  <figcaption style="font-size:0.95em; margin-top:0.5em; color:#5b6470;">Point the import dialog at <code>github.com/agntcy/dir-mcp</code>.</figcaption>
</figure>

<figure style="margin: 1.5em 0;">
  <img src="{{ '/assets/images/2026-09-22-dir-mcp-marketplace-plugins/5-add-plugin.png' | relative_url }}" alt="Personal marketplace listing the AGNTCY Agent Directory plugin" style="width:100%; border-radius:6px; border:1px solid #d7dbe0;">
  <figcaption style="font-size:0.95em; margin-top:0.5em; color:#5b6470;">Install the <code>agntcy-dir</code> plugin from the newly added marketplace.</figcaption>
</figure>

<figure style="margin: 1.5em 0;">
  <img src="{{ '/assets/images/2026-09-22-dir-mcp-marketplace-plugins/6-plugin-details.png' | relative_url }}" alt="AGNTCY Agent Directory plugin details page in Cursor" style="width:100%; border-radius:6px; border:1px solid #d7dbe0;">
  <figcaption style="font-size:0.95em; margin-top:0.5em; color:#5b6470;">The installed plugin bundles the <code>agntcy-dir</code> MCP server with ready-made skills and rules.</figcaption>
</figure>

After installation, the plugin connects to the Directory configured for your environment. You can switch between a local Directory server and a hosted one through the shared `dir-mcp` configuration without changing your editor workflow.

If you maintain agents that others might want to discover, or you are building something that composes existing agents, install the plugin and publish your first OASF record straight from your editor.

---

*Have questions? Join our [Slack community](https://join.slack.com/t/agntcy/shared_invite/zt-3hb4p7bo0-5H2otGjxGt9OQ1g5jzK_GQ) or check out our [GitHub](https://github.com/agntcy).*
