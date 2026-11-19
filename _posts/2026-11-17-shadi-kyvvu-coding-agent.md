---
layout: post
title: "Running a reference monitor inside SHADI"
date: 2026-11-17 07:00:00 +0000
author: Maurits Kaptein
author_url: https://github.com/MKaptein
categories: technical
tags: [shadi, kyvvu, aag, sandbox, reference-monitor, agents]
---

[SHADI](https://github.com/agntcy/shadi), as an agent sandbox, strictly controls which files, processes and network calls an agent can reach. Effectively, it controls the "reach" of the agent. On its own, however, controlling the reach does not guarantee that actions that are within reach cannot be combined in dangerous ways. For example, a coding agent might read `.env` files, it might write code, and it might push to git. Each of these actions is allowed. However, combining an `.env` read with a push to GitHub can lead to a serious egress of secrets.

For this second problem -- the combination of individually allowed actions that are jointly undesirable -- we have the traditional notion of a [reference monitor](https://en.wikipedia.org/wiki/Reference_monitor): a component that sits alongside a running process, inspects each of its steps, and is able to intervene at runtime as a function of the full history. [Kyvvu](https://docs.kyvvu.com) provides such a reference monitor for agents: a flexible and inspectable core that allows for the specification of path dependent (deterministic) rules. However, for a reference monitor to keep working it needs to be tamper proof: it should not be altered by the process it is governing. *Jointly, the Kyvvu reference monitor and the SHADI sandbox fulfil both goals: path dependent runtime control that is tamper proof.*

In this blog post we demonstrate the two in conjunction, with a small, self contained and [publicly available](https://github.com/Kyvvu/shadi-kyvvu-demo) example: a coding agent that can only run code after human approval (a path dependent policy enforced by Kyvvu), and whose code cannot alter the agent itself (a sandbox policy enforced by SHADI). After the simple example we discuss securing agents in production: how the steps of an agent can be described across agents (using the [Agent Action Grammar (AAG)](https://github.com/kyvvu/aag)), how content checks fit in, and which path dependent rules could have been used to prevent a number of documented agent incidents.

## Example: a coding agent that runs code only after approval

The example is admittedly somewhat contrived. The "agent" is simply a script with two tools, there is no model (model responses are mocked), and the "generated" code is a few fixed lines that try to rewrite the agent itself. That keeps it small enough to show every file. Each tool call is a step that the agent declares to the reference monitor before it runs, and so is the human approval step included in the scenario. Here is a short video running the demo from start to finish:

<!--more-->

<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin-bottom: 1.5em; border: 1px solid #d7dbe0; border-radius: 8px;">
  <iframe src="https://www.loom.com/embed/5014cd53836c4e9282fba88ab87327d0" title="Running a reference monitor inside SHADI: demo" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" frameborder="0" allowfullscreen></iframe>
</div>

The example effectively has three components: the agent code, the reference monitor (`kyvvu-engine` with its Kyvvu policy) and the sandbox (SHADI with its sandbox policy). The diagram follows one step of the agent as it moves through all three components:

![A step of the agent passes two checks, kyvvu-engine and then the SHADI sandbox]({{ '/assets/figures/shadi-kyvvu-components.svg' | relative_url }})

So, step by step, we have:

1. **The agent code**, `agent.py`, is about to run one of its two tools, `write_code` or `run_code`.
2. **Check 1 is `kyvvu-engine`.** Before the step runs, the engine decides whether it may run, given the steps before it and the Kyvvu policy, `demo-manifest.yaml`. If the answer is no, nothing runs.
3. **The step runs.** For `run_code`, the generated code is started as a separate process.
4. **Check 2 is the SHADI sandbox.** Whenever the agent or the generated code writes a file or opens a network connection, the kernel decides whether the sandbox policy, `sandbox.json`, allows it. Writes inside `agent-out/` succeed. Writes to `my-agent/` and all network access are refused.

Note that the directory `my-agent/` holds `agent.py`, the Kyvvu policy *and* `kyvvu-engine` (the reference monitor itself). Check 2 therefore also protects check 1: the agent and the code it generates **cannot change the engine or the rules enforced in the reference monitor**.

In this post, "Kyvvu policy" always means `demo-manifest.yaml` and "sandbox policy" always means `sandbox.json`. Let's discuss the details.

### The (mock) agent code, `agent.py`

These are the two tools and the approval step as in [`agent.py`](https://github.com/Kyvvu/shadi-kyvvu-demo/blob/main/agent.py), with the docstrings removed.

```python
# Tool: write the generated code to a file, declared as a step.resource POST.
@kv.step(ActionKind.step_resource, Verb.POST)
def write_code(path: str, code: str) -> str:
    pathlib.Path(path).write_text(code)
    return f"wrote {len(code)} bytes to {path}"

# Tool: run that file in a subprocess, declared as a step.exec.
@kv.step(ActionKind.step_exec)
def run_code(path: str) -> str:
    result = subprocess.run(
        [sys.executable, path], capture_output=True, text=True, check=False
    )
    output = (result.stdout + result.stderr).strip()
    return output or f"exit code {result.returncode}"

# The approval: a step.gate with the decision pass, added to the path of the task.
def record_approval_gate() -> None:
    kv.add_step(
        ActionKind.step_gate,
        "human_approval",
        properties={"kind": "human"},
        output={"decision": "pass"},
    )
```

To make the reference monitor work on security-meaningful semantics, we describe every step of an agent by its kind, such as `step.resource` or `step.exec`. These kinds come from the [Agent Action Grammar](#a-shared-vocabulary-for-agent-steps-aag). The `@kv.step` decorator hands each call to `kyvvu-engine` before the function body runs. If the engine refuses the step, **the body does not run**.

Two things are simulated. The "generated" code is one of two fixed snippets: one writes `42` to `agent-out/result.txt`, the other appends a line to `agent.py`. The human approval step is hardcoded in `agent.py`, so here the agent records its own gate. In production the harness records a human gate only when a person approves, and the model has no tool that records one. The harness code is in the read-only directory, so the agent cannot change when a gate is recorded.

### Check 1: kyvvu-engine and the Kyvvu policy

[`kyvvu-engine`](https://pypi.org/project/kyvvu-engine/) is a Python library that runs inside the agent process. For every declared step it evaluates, before the step runs, whether the step is permitted given the Kyvvu policy and the earlier steps of the same task ([*Policies on Paths*](https://arxiv.org/abs/2603.16586) describes this kind of control).

This is the complete Kyvvu policy, [`demo-manifest.yaml`](https://github.com/Kyvvu/shadi-kyvvu-demo/blob/main/demo-manifest.yaml):

```yaml
name: "SHADI demo: code execution requires a preceding gate"
version: "1.0.0"
policies:
  - name: "Code execution requires a preceding gate"
    description: |
      Any step.exec must be preceded by a step.gate whose decision is pass.
      Same rule as in Kyvvu's bundled OWASP baseline (ASI05).
    rule_type: step_requires_gate
    params:
      target_kinds: ["step.exec"]
    severity: critical
    enforcement_point: step_execution
```

- `rule_type: step_requires_gate` selects one of the engine's rule functions. It looks back through the steps of the task for a gate with the decision `pass`.
- `target_kinds` limits the rule to `step.exec`, so it does not apply to `write_code`, a `step.resource`.
- `enforcement_point` and `severity` mean that the rule is evaluated before each step executes, and that a violation refuses the step.

So, in simple terms: this policy checks whether, prior to running any code, human approval has been recorded.

### Check 2: the SHADI sandbox and the sandbox policy

Under SHADI, the agent is started through [`shadictl`](https://shadi.agntcy.org):

```
shadictl --policy sandbox.json -- python agent.py tamper
```

This is the complete sandbox policy, [`sandbox.json`](https://github.com/Kyvvu/shadi-kyvvu-demo/blob/main/sandbox.json), as `./run.sh setup` wrote it on our machine:

```json
{
  "read":  ["~/shadi-kyvvu-demo/my-agent", "/usr/local"],
  "write": ["~/shadi-kyvvu-demo/agent-out"],
  "net_block": true
}
```

- `read` makes `my-agent/` readable and not writable. The second entry is the Python installation, which the agent must be able to read in order to start.
- `write` names `agent-out/` as the only writable directory, and `net_block` closes the network.

`shadictl` applies these limits before it starts the agent. From then on the kernel enforces them for the agent process and for every process it starts ([Landlock](https://landlock.io/) on Linux, Seatbelt on macOS), so the code that `run_code` starts is under the same limits.

Again in simple terms (and for the purpose of this demo): SHADI shields the `my-agent/` directory from any tampering.

### Four example runs of the same agent

The replay shows four runs of the agent step by step, with the record Kyvvu wrote for each step in a real run (only the paths are shortened). Here is a little interactive widget to try out the four runs:

<div style="max-width: 100%; margin-bottom: 1.5em; border: 1px solid #d7dbe0; border-radius: 8px; overflow: hidden;">
  <iframe id="shadi-kyvvu-replay" src="{{ '/presentations/shadi-kyvvu-demo/replay/' | relative_url }}" title="SHADI and Kyvvu scenario replay" style="display: block; width: 100%; height: 900px; border: 0;" loading="lazy"></iframe>
</div>
<script>
  window.addEventListener('message', function (e) {
    var f = document.getElementById('shadi-kyvvu-replay');
    if (f && e.source === f.contentWindow && e.data && e.data.shadiKyvvuReplayHeight) {
      f.style.height = (e.data.shadiKyvvuReplayHeight + 4) + 'px';
    }
  });
</script>

The table below summarizes the various scenarios:

| Run | Sandbox | Generated code | Approval gate | Kyvvu on `run_code` | Result |
|---|---|---|---|---|---|
| 1 | off | tampering | recorded | permitted | the code modifies `agent.py` |
| 2 | off | tampering | skipped | refused | nothing executes |
| 3a | on | harmless | recorded | permitted | the code writes `agent-out/result.txt` |
| 3b | on | tampering | recorded | permitted | the kernel refuses the write to `agent.py` |

Run 1 shows what the reference monitor alone does not cover: the code execution was approved, so nothing stopped the approved code from rewriting the agent. Run 3b shows both checks in play: Kyvvu permits the code execution, because it was human-approved. The kernel, however, refuses the write, because `agent.py` is outside the writable directory. This is the `run_code` action of run 3b, as the reference monitor wrote it to `agent-out/kyvvu-trace.jsonl`:

```json
{
  "agent_id": "agent_shadi_coding_demo",
  "task_id": "7cbf6679-9976-4784-97e8-adcb5b49a133",
  "action_id": "24c918be03e6419993799906612ef691",
  "seq": 4,
  "kind": "step.exec",
  "step_name": "run_code",
  "properties": {},
  "meta": {
    "kyvvu.eval": {
      "action": "allow",
      "risk_score": 0.0,
      "policies": [
        {
          "name": "Code execution requires a preceding gate",
          "rule_type": "step_requires_gate",
          "severity": "critical",
          "violated": false,
          "manifest_name": "SHADI demo: code execution requires a preceding gate"
        }
      ]
    }
  },
  "input": {
    "path": "~/shadi-kyvvu-demo/agent-out/scratch.py"
  },
  "output": {
    "status": "success",
    "execution_time_seconds": 0.0437,
    "result": "Traceback (most recent call last):\n  File \"~/shadi-kyvvu-demo/agent-out/scratch.py\", line 2, in <module>\n    open(me, 'a').write('\\n# tampered by generated code\\n')\n    ~~~~^^^^^^^^^\nPermissionError: [Errno 13] Permission denied: '~/shadi-kyvvu-demo/my-agent/agent.py'"
  },
  "timestamp": "2026-11-18T14:50:06.551136Z"
}
```

Kyvvu's evaluation is under `meta."kyvvu.eval"`, a place the [AAG schema](https://github.com/kyvvu/aag/blob/main/spec/action.schema.json) keeps for the tool that evaluates an action. `output.status` is `success` because `run_code` itself completed: it returned the output of the subprocess, which is the kernel's `PermissionError`.

### Run it yourself

The example runs on macOS and Linux and needs Python 3.12 or newer, git and curl. On macOS it also needs [Homebrew](https://brew.sh). No Kyvvu account is needed.

```
git clone https://github.com/Kyvvu/shadi-kyvvu-demo
cd shadi-kyvvu-demo
./run.sh setup   # installs shadictl if missing, creates a Python environment with kyvvu
./run.sh demo    # runs the four scenarios, pausing between them
```

The tested versions of `kyvvu` and `shadictl` are in the [README](https://github.com/Kyvvu/shadi-kyvvu-demo#verified-on).

## Securing agents in production

In this section we discuss how to extend the simple example of "sandbox + reference monitor" above to more realistic cases. However, before digging into specific cases, we first cover some of the basics of the reference monitor itself and the action grammar used in the example.

### What has to be protected

The requirements on a reference monitor go back to Anderson's 1972 [Computer Security Technology Planning Study](https://seclab.cs.ucdavis.edu/projects/history/CD-1/ande72.pdf), which asks three things of it:

1. It sees every action before the action happens.
2. It cannot be modified by the code it controls.
3. It is small enough to be checked.

The Kyvvu reference monitor meets the first requirement for the steps the harness declares: every tool call passes through `@kv.step` before its body runs. Hence, it is important to have a complete integration (i.e., map all harness events to the reference monitor). Note that the reference monitor in this case does not see what generated code does once `run_code` has started it. However, in our example above, SHADI effectively does, by virtue of seeing any resulting changes to protected files.

A process cannot guarantee the second requirement about itself, so that guarantee comes from outside. This is exactly the role SHADI plays in this example. In the example the generated code runs in a child process, so it cannot reach the engine in the agent's memory either. A harness that executes generated code inside its own process will in practice lack that separation, and for such purposes we often run `kyvvu-engine` as a separate (governed) process.

For the third requirement, what has to be checked in the example is short: the two policies, together fewer than twenty lines, and the rule function they name. Additionally, the code of the reference monitor itself is inspectable.

### A shared vocabulary for agent steps: AAG

To check a step before it runs, the reference monitor needs a description of that step. In the Kyvvu reference monitor that description is an action in the [Agent Action Grammar (AAG)](https://github.com/kyvvu/aag), an open specification that names [twelve kinds of action](https://github.com/kyvvu/aag/blob/main/spec/vocabulary.json), such as `step.resource`, `step.model`, `step.exec` and `step.gate`. We think agents need such a shared vocabulary, for two reasons:

1. **A check before the step needs a description before the step.** [OpenTelemetry spans for generative AI](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/) report calls to a collector, which serves logging and debugging. Nothing comes back on that channel, so a span cannot stop the call it describes. The OWASP [Agent Control Standard (ACS)](https://github.com/GenAI-Security-Project/agent-control-standard) defines hooks before an action, mostly for tool calls (we keep a [mapping from ACS to AAG](https://github.com/kyvvu/aag/blob/main/docs/acs-mapping.md)). An agent also calls models, reads credentials, executes code and writes memory, and a security rule can depend on any of those.
2. **A rule should not depend on the harness.** The Kyvvu policy of the example applies to any harness that declares code execution as a `step.exec`, whether that harness is a simple Python script, a [LangChain](https://www.langchain.com/) agent or a coding assistant. The same rules can be specified for any agent.

### Content checks are gates

In our view of the reference monitor, and the tasks it should check, a PII check, a prompt-injection check and a human approval all judge content. Neither Kyvvu nor SHADI operates at the level of the content being created by the LLM. However, we incorporate such checks through a notion of a `step.gate`.

The check itself can be any tool. When it has run, the harness records the outcome as a `step.gate` action with a decision, `pass` or `deny`. A reference monitor policy can then require a passing gate before certain steps, of a particular kind (`gate_kind`) or a recent one (`max_steps_since_gate`). The reference monitor does not judge the content; it simply makes sure that the check which does was run and passed, at the right place in the path of the agent.

The approval in the example is such a gate: `record_approval_gate` above records it with the kind `human` and the decision `pass`.

### Path dependent rules for documented incidents

Below are three documented incidents and one common pattern, each with the rules that would cover it. The complete policies are in the [`examples`](https://github.com/Kyvvu/shadi-kyvvu-demo/tree/main/examples) directory of the demo, and `./run.sh examples` checks every outcome stated here. A rule obviously only works if the harness declares the steps involved, with the properties the rule names.

#### An agent that switches off its own approvals

In August 2025, Johann Rehberger [showed](https://embracethered.com/blog/posts/2025/github-copilot-remote-code-execution-via-prompt-injection) that a prompt injection in a source file could make GitHub Copilot write `"chat.tools.autoApprove": true` into `.vscode/settings.json` (CVE-2025-53773), which disables all user confirmations. This is run 3b with a different file: the agent changes what governs it. With a reference monitor, the approval requirement is not a setting in the agent's workspace but the `step_requires_gate` rule of the example, in a Kyvvu policy that the sandbox makes read-only.

#### Individually allowed steps that leak together

In May 2025, Invariant Labs [showed](https://invariantlabs.ai/blog/mcp-github-vulnerability) how an agent connected to the GitHub MCP server could be made to leak private data. An issue with a prompt injection on a public repository leads the agent to read the owner's private repositories and to write their contents into a public pull request. Invariant Labs note that this "is not a flaw in the GitHub MCP server code itself": every *single* call was allowed.

This is the `.env` read followed by a git push from the start of this post. The sandbox cannot tell these calls apart, because they all go to the same host. With the rule below, a step passes if it is not a write to an external target, or if the task has not read confidential data.

```yaml
rule_type: any_of
params:
  conditions:
    - rule_type: not
      params:
        condition:
          rule_type: current_is
          params:
            kind: step.resource
            verb: POST
            property_filter: {"target.trust": "external"}
    - rule_type: not
      params:
        condition:
          rule_type: history_contains
          params:
            kind: step.resource
            verb: GET
            count_attempts: false
            property_filter: {"data.classification": "confidential"}
```

`count_attempts: false` means that a read Kyvvu refused does not count. After a private read, a write to the private repository is permitted and the public pull request is refused, provided the harness marks a private read as `confidential` and a public repository as `external`.

#### A destructive action without approval

In July 2025, Jason Lemkin of SaaStr reported that Replit's coding agent [deleted a production database](https://www.theregister.com/2025/07/22/replit_saastr_response/), despite his instruction to freeze the code. An instruction in a prompt is a request to the model. A rule in a reference monitor policy is checked outside the model, *before* the step runs:

```yaml
rule_type: step_requires_gate
params:
  target_kinds: ["step.resource"]
  target_verb: DELETE
  gate_kind: human
  max_steps_since_gate: 1
```

A delete is then refused unless a human approval directly precedes it.

Note that in the sandbox, SHADI's [`net_allow`](https://github.com/agntcy/shadi/blob/main/docs/content/sandbox.md#network-allow-lists), with `shadictl --watch-policy`, would limit outbound connections to named hosts, so an agent whose sandbox policy does not name the production database cannot connect to it. Without `--watch-policy`, however, `net_allow` is enforced per port, which would not separate two databases on the same port.

#### A tool call scoped to an earlier result

The last case we discuss is a pattern and not a recorded incident. The pattern is simple: a support agent logs a customer in, and may then only query the records of that customer. Harnesses usually fix this in harness code: LangChain's [`InjectedToolArg`](https://reference.langchain.com/python/langchain-core/tools/base/InjectedToolArg), for example, keeps such an argument out of the schema the model sees.

With a reference monitor, the harness can stay general and the rule can live outside the agent. `kyvvu-engine` has no built-in rule that compares an argument of one step with the output of an earlier one, but rule functions themselves are ordinary Python. The one for this case, [`scoped_rule.py`](https://github.com/Kyvvu/shadi-kyvvu-demo/blob/main/examples/scoped_rule.py), is about twenty lines, registered with `PolicyRule.register`. The agent imports it before it loads the policy; in production it sits with the engine, in a directory the agent cannot write. After a login that returns customer 42, a query for customer 43 is refused, and the value compared against comes from the recorded output of the login, not from anything the model writes.

## Conclusions

We ran a mock-up of a coding agent under two checks. A reference monitor (`kyvvu-engine`) decided on each step given the steps before it, and refused to run code that was not approved. The SHADI sandbox bounded what the agent and its generated code could reach, and protected the reference monitor and its policy, which a reference monitor cannot do for itself. In production the same two checks apply, with path dependent rules for the cases a sandbox alone cannot separate.

The example is public and runs in a few minutes; the commands are under [Run it yourself](#run-it-yourself). We welcome corrections and questions as issues on the [demo repository](https://github.com/Kyvvu/shadi-kyvvu-demo). Thanks to Luca Muscariello and the SHADI team for SHADI, which made this demo easy to build.

Thanks for taking the time to read this!

### References

Code and documentation:

- [Kyvvu/shadi-kyvvu-demo](https://github.com/Kyvvu/shadi-kyvvu-demo)
- [SHADI](https://github.com/agntcy/shadi) and its [documentation](https://shadi.agntcy.org)
- [Kyvvu documentation](https://docs.kyvvu.com) and [`kyvvu-engine`](https://pypi.org/project/kyvvu-engine/) on PyPI
- [Agent Action Grammar (AAG)](https://github.com/kyvvu/aag): its [vocabulary](https://github.com/kyvvu/aag/blob/main/spec/vocabulary.json), its [action schema](https://github.com/kyvvu/aag/blob/main/spec/action.schema.json) and the [mapping from ACS to AAG](https://github.com/kyvvu/aag/blob/main/docs/acs-mapping.md)
- OWASP [Agent Control Standard (ACS)](https://github.com/GenAI-Security-Project/agent-control-standard)
- [OpenTelemetry semantic conventions for generative AI](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)
- [Landlock](https://landlock.io/)
- LangChain's [`InjectedToolArg`](https://reference.langchain.com/python/langchain-core/tools/base/InjectedToolArg)

Background:

- [Reference monitor](https://en.wikipedia.org/wiki/Reference_monitor), Wikipedia
- J. P. Anderson, [Computer Security Technology Planning Study](https://seclab.cs.ucdavis.edu/projects/history/CD-1/ande72.pdf), 1972
- M. Kaptein, V.-J. Khan and A. Podstavnychy, [Runtime Governance for AI Agents: Policies on Paths](https://arxiv.org/abs/2603.16586), 2026

Incidents:

- J. Rehberger, [GitHub Copilot: Remote Code Execution via Prompt Injection (CVE-2025-53773)](https://embracethered.com/blog/posts/2025/github-copilot-remote-code-execution-via-prompt-injection), 2025
- Invariant Labs, [GitHub MCP Exploited: Accessing private repositories via MCP](https://invariantlabs.ai/blog/mcp-github-vulnerability), 2025
- The Register, [Replit makes vibe-y promise to stop its AI agents making vibe coding disasters](https://www.theregister.com/2025/07/22/replit_saastr_response/), 2025
