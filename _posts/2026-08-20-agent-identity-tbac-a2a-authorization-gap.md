---
layout: post
title: "Agent Identity and Task-Based Access Control: Closing the Authorization Gap A2A Leaves Open"
date: 2026-08-20 08:00:00 +0000
author: Jean Diaconu
author_url: https://github.com/jdiaconu
categories: [technical, identity]
tags: [identity, a2a, tbac, authorization, verifiable-credentials, oauth, mcp, agents]
mermaid: true
---

[Agent2Agent (A2A)](https://a2a-protocol.org/v1.0.0/specification/) reached
v1.0.0 in March 2026 as a Linux Foundation project, and the
[Model Context Protocol](https://modelcontextprotocol.io/) has become a common
way for agents to reach tools. Between them they specify, in detail, how one
agent asks another agent — or a tool — to do something.

A2A v1.0.0 also added something more interesting. An agent can now stop in the
middle of a task and ask for authorization: `TASK_STATE_AUTH_REQUIRED` is a
real lifecycle state, and the request propagates up a delegation chain until it
reaches something, ultimately someone, that can decide. It is the right
primitive. What the specification then does is decline, explicitly, to define
what the resulting permission covers, how long it lasts, or how it is revoked.

That is a deliberate boundary rather than an oversight, and it is where the
interesting work now sits. Closing it takes two things the protocol does not
supply: a cryptographically verifiable identity for the agent, and permissions
scoped to the task rather than to the agent. AGNTCY Identity ships the first
half today. This post walks through what A2A standardizes, what it leaves open,
what you can build on top of it right now, and what is still being designed in
the open.

<!--more-->

### What You'll Learn

In this post, you'll learn:

- Why traditional IAM assumptions break down for ephemeral, polymorphic,
  autonomous agents.
- Exactly what A2A v1.0.0 standardizes around authorization — and the four
  places the specification says the rest is up to you.
- How AGNTCY Identity establishes who an agent is, using resolvable
  identifiers, `ResolverMetadata`, and W3C Verifiable Credential Agent Badges.
- Why OAuth client identity is the sticking point at organizational
  boundaries, and how Client ID Metadata Documents change that.
- What Tool, Transaction and Task-Based Access Control (T-BAC) covers, which
  layer enforces today, and which layers are still working-group drafts.
- What an end-to-end approval flow looks like, and precisely which two pieces
  of it do not exist yet.

## Identity Is No Longer Just for Humans

Traditional IAM rests on one stable assumption: whoever is asking for access is
a person, or a service account standing in for one. Agentic AI breaks that
assumption three ways. Agents can be ephemeral, spun up and torn down per task.
They can be polymorphic, taking different roles depending on context. And they
act on their own, with no human in the loop to vouch for each step.

The mismatch runs deeper than lifetime. Client registration establishes a
client's identity and metadata, and it can constrain which scopes that client
may ask for. But the token's real scope gets requested and granted at
authorization time, and nothing in that flow ties the resulting authority to a
task's objective or its lifecycle. Agents work in tasks: bounded, short-lived,
different every time. Issue a broad credential to something doing narrow,
variable work and you get an agent that authenticates perfectly and can reach
far past anything it needs.

So an agent has to answer three questions with cryptography, not assertion:

- Who created me, and what organization do I represent?
- What am I authorized to do, right now, for this specific piece of work?
- Can another system verify both before extending trust, without the two of us
  sharing a central authority?

## What A2A 1.0 Actually Standardizes

A2A's core abstraction is the Task. It carries a server-assigned `id`, a
`contextId` that groups related work, a `status` holding one of eight concrete
lifecycle states plus a `TASK_STATE_UNSPECIFIED` sentinel, and a `metadata` map
the spec reserves for extensions. Three parts of the specification matter if you
are designing the security model.

**Task operations are authorization-scoped.** §13.1 requires authorization
checks on every A2A operation, scoped to the caller's boundaries. `ListTasks`
returns only tasks that caller can see. `GetTask`, cancellation, and
subscription each verify access first, before any query that might leak whether
a resource exists.

**Agent Cards are discoverable and signable.** An agent can publish its
capabilities at the registered well-known location
`/.well-known/agent-card.json`, though the spec accommodates other discovery
mechanisms. The card declares `securitySchemes` and `securityRequirements`, and
per skill, `AgentSkill.securityRequirements`, so an agent can state which scopes
each individual skill needs. Cards can also carry JWS signatures over a
canonicalized payload, which lets a client confirm the card came from the domain
it claims.

**There is a first-class extension point.** An agent declares an
`AgentExtension` by URI. Clients activate it with the `A2A-Extensions` header.
Extension data rides in the `metadata` maps, keyed by that URI. The spec is
blunt that an extension must never become a way around an agent's primary
security controls.

And in v1.0, an agent can stop mid-task and ask for authorization.

```json
{
  "id": "5c2a9e10-3f42-4c8b-9d71-6f0b2a7e4c19",
  "contextId": "b31f7c58-0a6d-4e93-8c22-1d5f9e7a3b40",
  "status": {
    "state": "TASK_STATE_AUTH_REQUIRED",
    "message": {
      "messageId": "9a1c7e33-5b08-4f6e-8a12-c47d0e9b2f65",
      "role": "ROLE_AGENT",
      "parts": [
        { "text": "Restarting payments-api in production requires approval." }
      ]
    },
    "timestamp": "2026-08-11T14:22:07Z"
  }
}
```

*An A2A Task interrupted for authorization. One migration note: v1.0 serializes
lifecycle states in SCREAMING_SNAKE_CASE on the JSON wire, so
`TASK_STATE_AUTH_REQUIRED` replaces the `auth-required` of v0.3.*

## The Gap A2A Deliberately Leaves Open

`TASK_STATE_AUTH_REQUIRED` is where an agent lands when it hits a step it can't
take on its own authority. Maybe it needs a token it doesn't hold. Maybe a human
has to approve something destructive. Either way, the client picks up
responsibility for getting that authorization. And if the client is itself an
agent servicing an upstream task, §7.6.2 lets it flip its own task to
`TASK_STATE_AUTH_REQUIRED` too, so a chain of paused tasks propagates up to a
person.

Useful primitive — but §7.6.4 draws a hard line around it:

> The A2A protocol does not define the scope, representation, validity, or
> revocation semantics of the authorization decision or credential obtained in
> response to this state. Agents MUST NOT treat the
> `TASK_STATE_AUTH_REQUIRED` state transition, by itself, as authorization for
> any particular operation. The meaning and scope of any resulting
> authorization decision or credential MUST be defined by the agent's
> implementation, by the credential issuer, or by an A2A extension.

The spec says the same thing in other places. §7.5: "Authorization logic is
implementation-specific." §13.1: "Authorization boundaries are defined by each
agent's authorization model, not prescribed by the protocol."

Treat that as a work item, not a shortcoming. A2A standardized *when* to ask.
Somebody has to define what the answer means.

| Capability | Status in A2A v1.0.0 |
|---|---|
| Authenticated caller can access a specific Task | Standardized (§13.1) |
| Authorization checks on task operations | Required; the model itself is left to the implementation |
| Pause a task to request approval or credentials | Standardized (`TASK_STATE_AUTH_REQUIRED`) |
| Propagate that request up a delegation chain | Standardized (§7.6.2) |
| Declare which scopes a skill requires | Declarative only (`AgentSkill.securityRequirements`) |
| Authorization based on the action attempted within a task | Supported as implementation policy (§7.5) |
| Credential cryptographically bound to a `taskId` | Not standardized |
| Permission derived from the task's semantic intent | Not standardized |
| Automatically narrow tools and scopes to what the task needs | Not standardized |
| Task-scoped validity and revocation semantics | Not standardized (§7.6.4) |
| A sanctioned place to carry all of the above | Standardized (`metadata` + `AgentExtension`) |

## Identity First: Establishing Who the Agent Is

Before you can scope an agent's authority, you need to know whose agent it is.
[AGNTCY Identity](https://spec.identity.agntcy.org) gives every entity, whether
that's an Agent, an MCP Server, or a Multi-Agent System, an identifier with
three properties: open, so no central issuing authority is required;
collision-free; and verifiable by cryptographic proof instead of by claim.

Those identifiers root in whatever the organization already trusts. Connect Duo,
Microsoft Entra ID, Okta, Ory, or Ping, and the Identity Service derives the
agent's ID from its registration in that provider. Organizations that would
rather skip an external IdP can register a self-issued identity instead, and
there is a `did:agntcy:` method for decentralized deployments.

```mermaid
flowchart LR
    subgraph SRC["Trust roots"]
        direction TB
        IDP["Enterprise IdP<br/>Duo, Entra ID, Okta, Ory, Ping"]
        SELF["Self-issued identity"]
        DID["did:agntcy: method"]
    end

    ID["AGNTCY ID<br/>open, collision-free, verifiable"]

    RM["ResolverMetadata, 1:1<br/>keys, assertion methods, endpoints"]
    BADGE["Agent Badges, 1:many<br/>W3C VC wrapping an OASF document<br/>or an A2A Agent Card"]

    NODE["Identity Node<br/>trust anchor"]
    RP["Relying party<br/>verifies with no prior relationship"]

    IDP --> ID
    SELF --> ID
    DID --> ID
    ID --> RM
    ID --> BADGE
    BADGE --> NODE
    RM --> RP
    NODE --> RP

    style SRC fill:#eff3fc,stroke:#0251af,color:#1c1e21
    style IDP fill:#e8eefb,stroke:#0251af,color:#1c1e21
    style SELF fill:#e8eefb,stroke:#0251af,color:#1c1e21
    style DID fill:#e8eefb,stroke:#0251af,color:#1c1e21
    style ID fill:#0251af,stroke:#023a7a,color:#f3f6fd
    style RM fill:#cfe1fb,stroke:#0251af,color:#1c1e21
    style BADGE fill:#cfe1fb,stroke:#0251af,color:#1c1e21
    style NODE fill:#d4edda,stroke:#2d6a4f,color:#1c1e21
    style RP fill:#d4edda,stroke:#2d6a4f,color:#1c1e21
```

Each ID maps 1:1 to a **`ResolverMetadata`** object, a JSON-LD document holding
the key material, assertion methods, and service endpoints you need to resolve
the identifier and check anything signed under it. A relying party never has to
take an agent's self-description on faith. One caveat worth keeping straight:
verifying a badge establishes provenance. Deciding you trust its issuer is a
separate policy call.

Each ID also maps 1:many to **Agent Badges**, [W3C Verifiable
Credentials](https://www.w3.org/TR/vc-data-model-2.0/) whose
`credentialSubject.badge` holds the agent's real definition: an
[OASF](https://docs.agntcy.org/oasf/open-agentic-schema-framework/) schema document, or for A2A
agents, the Agent Card itself. Badges get published to an Identity Node acting
as a trust anchor, so any party can verify one without a prior relationship.

```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  "id": "urn:uuid:1f4b6c2e-9d31-4a75-b0e8-3c7a5d21f9b4",
  "type": ["VerifiableCredential", "AgentBadge"],
  "issuer": "https://identity.example.com/issuers/examplecorp",
  "validFrom": "2026-08-11T09:00:00Z",
  "credentialSubject": {
    "id": "OKTA-0oa9z8y7x6w5V4u3t2s1",
    "badge": { "...": "the agent's A2A Agent Card, verbatim" }
  },
  "credentialSchema": [
    {
      "id": "https://a2a-protocol.org/v1.0.0/spec/a2a.json#/definitions/Agent%20Card",
      "type": "JsonSchema"
    }
  ],
  "proof": {
    "type": "DataIntegrityProof",
    "proofPurpose": "assertionMethod",
    "proofValue": "z58DAdFfa9SkqZMVPxAQp...jQCrfFPP2oumHKtz"
  }
}
```

*An A2A Agent Badge, abridged, in the form published in the AGNTCY Verifiable
Credential specification. The shipped Identity Service currently signs badges as
JOSE-enveloped credentials, meaning a JWS over the credential, and verification
accepts either form.*

## Where the Agent's OAuth Client Identity Comes From

That works because the [Identity
Service](https://identity-docs.outshift.com) handles IdP registration for you.
Create an Agentic Service and it provisions a dedicated OAuth client in your
tenant. Microsoft's Entra ID integration notes are blunt about the reason: each
agentic service gets "its own dedicated app registration with isolated
credentials, following the principle of least privilege."

Inside one organization that model is excellent. At the organizational boundary
it runs out of road, which is unfortunate, because the boundary is where A2A is
built to operate. Calling a partner's agent means somebody pre-registers a
client at the partner's authorization server, exchanges a secret, and manages
its lifecycle. Multiply that by every partner and every agent.

The IETF is standardizing a way out. **[Client ID Metadata
Documents](https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/)**
(`draft-ietf-oauth-client-id-metadata-document`, adopted by the OAuth working
group) let a client use an HTTPS URL as its `client_id`, and the authorization
server dereferences that URL to pull the client's metadata. No prior
relationship required. In deployments that resolve those documents dynamically,
there is also no per-authorization-server registration transaction and no
registration state left behind, though the draft still permits preregistration
and expects it to stay common in enterprise environments. Shared-secret client
authentication is ruled out for these clients in favor of public-key methods
like `private_key_jwt`, with key material published through `jwks` or
`jwks_uri`, so the identity ends up key-bound and rooted in a domain someone
demonstrably controls. It is an Internet-Draft rather than a finished RFC, but
[MCP's authorization
specification](https://modelcontextprotocol.io/specification/draft/basic/authorization)
already recommends it for client onboarding where no prior registration exists,
and deprecates dynamic client registration in its favor.

The two models fit together. CIMD answers *which OAuth client is this*.
`ResolverMetadata` and the Agent Badge answer *who published it and what it was
built to do*. Both can anchor to the same key material, and AGNTCY has a working
subgroup on that seam.

## From Identity to Task-Scoped Authorization

Authentication tells you who the agent is. It says nothing about what work this
agent should be allowed to do right now. Tool, Transaction and Task-Based Access
Control (T-BAC) covers that gap in three layers, each one narrowing authority
from the agent down to the individual action.

```mermaid
flowchart TB
    AGENT["Verified agent identity<br/>Agent Badge + ResolverMetadata"]

    subgraph TOOL["Tool: enforcing today"]
        direction TB
        T1["Task catalog derived from the agent's badge"]
        T2["Policy on the calling service:<br/>permitted tasks, Allow or Deny, Needs Approval"]
        T3["Decided when the call happens,<br/>not fixed when the token was issued"]
        T1 --> T2 --> T3
    end

    subgraph TXN["Transaction: IETF draft"]
        direction TB
        X1["Immutable call-chain context:<br/>who originally asked, for what, under what conditions"]
        X2["No intermediate agent can quietly widen it"]
        X1 --> X2
    end

    subgraph TASK["Task: working-group proposal"]
        direction TB
        K1["Authority derived from the objective itself"]
        K2["Cryptographically bound to the taskId"]
        K3["Monotonic narrowing at every delegation hop"]
        K4["Expires with the task"]
        K1 --> K2 --> K3 --> K4
    end

    AGENT --> TOOL
    TOOL --> TXN
    TXN --> TASK

    style AGENT fill:#0251af,stroke:#023a7a,color:#f3f6fd
    style TOOL fill:#d4edda,stroke:#2d6a4f,color:#1c1e21
    style T1 fill:#eff3fc,stroke:#0251af,color:#1c1e21
    style T2 fill:#eff3fc,stroke:#0251af,color:#1c1e21
    style T3 fill:#eff3fc,stroke:#0251af,color:#1c1e21
    style TXN fill:#fff3cd,stroke:#856404,color:#1c1e21
    style X1 fill:#eff3fc,stroke:#0251af,color:#1c1e21
    style X2 fill:#eff3fc,stroke:#0251af,color:#1c1e21
    style TASK fill:#fff3cd,stroke:#856404,color:#1c1e21
    style K1 fill:#eff3fc,stroke:#0251af,color:#1c1e21
    style K2 fill:#eff3fc,stroke:#0251af,color:#1c1e21
    style K3 fill:#eff3fc,stroke:#0251af,color:#1c1e21
    style K4 fill:#eff3fc,stroke:#0251af,color:#1c1e21
```

**Tool** is the layer that enforces today. The Identity Service builds a task
catalog from the agent's badge, so administrators write policy against the
agent's real tools and invocations instead of abstract scopes. Policies attach
to the *calling* service and hold Rules listing permitted tasks, an Allow or
Deny action, and a "Needs Approval" flag. The design intent is that
authorization gets decided when the call happens, not fixed when the token was
issued. Which is what turns Continuous Authorization from a marketing line into
a mechanism: a policy change can bite on the next call, not the next token
refresh.

**Transaction** handles what per-hop least privilege can't. Once work fans out
across agents, the chain has to carry who originally asked, for what, and under
what conditions, immutably, so no intermediate agent quietly widens it. The
IETF's [Transaction
Tokens](https://datatracker.ietf.org/doc/draft-ietf-oauth-transaction-tokens/)
draft builds that primitive for internal service call chains.

**Task** is the layer that is not standardized or shipping in the architecture
described here: authority derived from the objective itself, cryptographically
bound to the task, expiring with it. Working-group drafts sketch it. A credential
profile carrying authorized scopes and delegation constraints. A narrowing rule
where a delegate's effective authority is the intersection of what the delegator
can pass on, what the delegate holds intrinsically, and what this specific
delegation granted. Monotonic narrowing, enforced at every hop.

So that is the target architecture. Its status deserves a straight answer: it
lives in working-group proposals, not in shipped code. The example below shows
what such a credential could carry.

```json
{
  "iss": "https://identity.example.com",
  "sub": "OKTA-0oa9z8y7x6w5V4u3t2s1",
  "exp": 1786012800,
  "cnf": { "jkt": "0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I" },
  "act": {
    "sub": "OKTA-0oa1b2c3d4e5F6g7h8i9",
    "act": { "sub": "alex@example.com" }
  },
  "a2a": {
    "taskId": "5c2a9e10-3f42-4c8b-9d71-6f0b2a7e4c19",
    "contextId": "b31f7c58-0a6d-4e93-8c22-1d5f9e7a3b40"
  },
  "authorization_details": [
    {
      "type": "agentic_task",
      "actions": ["restart"],
      "locations": ["https://mcp.example.com/infra"],
      "datatypes": ["service:payments-api"]
    }
  ]
}
```

*Illustrative only. AGNTCY Identity does not issue this task-scoped credential
today. Today, Identity establishes who the agent is and TBAC evaluates whether
it may invoke a specific tool; the proposed next step is to bind that authority
to the A2A task itself. A future AGNTCY task-authorization profile would bind
the agent's identity, `taskId`, permitted actions and resources, delegation
constraints, and a limited lifetime into one verifiable authorization object.
Existing standards can supply reusable building blocks for structured
authorization, delegation provenance, and proof of possession, but they do not
define this task-scoped model. The profile work is to specify issuance and
validation, how authority narrows through delegation, how the agent proves
possession of the authorized key, and how task-bound authority expires or is
revoked.*

## Two Names for the Same Primitive

A2A has `TASK_STATE_AUTH_REQUIRED`. An agent stops, says it needs authorization,
and the request propagates up the chain of tasks until it reaches something,
ultimately someone, that can decide. AGNTCY's TBAC has "Needs Approval": a rule
flag that halts an invocation, pushes a notification to a registered device
showing the caller, the callee, and the tool, then waits on a human.

Same primitive, built at different layers, and today they don't talk to each
other. AGNTCY's approval blocks synchronously inside a single hop, on a short
timer. A2A's is asynchronous and composes across multiple task hops, so a
sub-agent's request shows up as an interrupted state on the orchestrator's task,
and on the task above that.

Combining them is what pays off. A person sees the objective they delegated
alongside the specific action now being requested against it, several agents
down, and the credential issued in response is scoped to both. A2A §7.6.4 names
three places where the meaning of such a credential can be defined: the agent's
implementation, the credential issuer, or an A2A extension. All three are open
to the community.

## What This Looks Like End to End

Picture an infrastructure troubleshooting agent working for an on-call engineer.

1. **Delegation.** The engineer hands an orchestrator an objective: find out why
   checkout latency spiked, and fix it if that's safe. The orchestrator opens an
   A2A Task and gets back an `id` and a `contextId`.
2. **Discovery and verification.** It pulls the candidate specialist's Agent Card
   from `/.well-known/agent-card.json`, checks the card's JWS signature,
   resolves the agent's identifier to its `ResolverMetadata`, and verifies the
   Agent Badge: publisher, organization, declared capabilities. No shared
   central authority needed.
3. **Work begins.** The specialist opens its own Task. Reading logs and querying
   monitoring fall inside policy, so those calls go through, with policy
   evaluated at the MCP server each time.
4. **The sensitive step.** Restarting `payments-api` will fix the incident, but
   that task sits behind a rule marked Needs Approval. The specialist moves its
   Task to `TASK_STATE_AUTH_REQUIRED` with a status message naming the action.
5. **Propagation.** The orchestrator, servicing the engineer's task, moves its
   own Task to `TASK_STATE_AUTH_REQUIRED`. The engineer sees one specific
   action, in the context of the objective they delegated.
6. **Approval and issuance.** The engineer approves. The credential issuer mints
   authority for that action and, in the target model, binds it to the `taskId`,
   the specialist's identity, and that one named service.
7. **Enforcement.** The restart call carries that authority to the MCP server,
   which validates it independently and re-checks policy before acting.
8. **Close.** The task completes. The authority dies with it.

```mermaid
sequenceDiagram
    autonumber
    actor ENG as On-call engineer
    participant ORCH as Orchestrator agent
    participant SPEC as Specialist agent
    participant IDS as Identity Service and credential issuer
    participant MCP as MCP server for infrastructure tools

    ENG->>ORCH: Delegate objective: diagnose and safely fix checkout latency
    Note over ORCH: Task A opens, id + contextId assigned
    ORCH->>IDS: Resolve identifier, verify Agent Card JWS and Agent Badge
    IDS-->>ORCH: ResolverMetadata and verified badge
    ORCH->>SPEC: Send message
    Note over SPEC: Task B opens
    SPEC->>MCP: Read logs, query monitoring
    MCP-->>SPEC: Results, policy evaluated on every call
    SPEC->>MCP: Restart payments-api
    MCP-->>SPEC: Blocked, rule marked Needs Approval

    rect rgba(251, 175, 70, 0.12)
    Note over SPEC: Task B moves to TASK_STATE_AUTH_REQUIRED
    SPEC-->>ORCH: Authorization required to restart payments-api
    Note over ORCH: Task A moves to TASK_STATE_AUTH_REQUIRED
    ORCH-->>ENG: One specific action, in the context of the delegated objective
    ENG->>IDS: Approve this action
    IDS-->>SPEC: Task-scoped credential, proposed and not shipped today
    end

    SPEC->>MCP: Restart carrying that authority
    MCP-->>SPEC: Validated independently, policy re-checked, restart executed
    SPEC-->>ORCH: Task B complete
    ORCH-->>ENG: Task A complete
    Note over ENG,MCP: Both tasks close, the authority dies with them
```

Most of these primitives exist today. Two don't. Steps four and five assume a
bridge between a TBAC approval decision and A2A's authorization-required task
state, and that bridge is integration work, not a shipped feature. Step six
assumes a task-bound credential plus the rules a resource server uses to
validate it, which is the profile work described above.

## What You Can Build Today

Verifiable agent identity ships now: badges, resolvable identifiers, and
cryptographic verification that works across organizational boundaries. So does
tool-level authorization with continuous re-evaluation and human-in-the-loop
approval. A2A supplies the task lifecycle, the interruption state, the
propagation semantics, and a sanctioned place to carry extension data.

You supply the wiring and the binding: connecting an approval decision to A2A's
authorization-required state, and defining what a task-scoped credential holds,
how each boundary validates it, and when it dies. A2A leaves that to
implementations, issuers, and extensions. The community's job is making sure we
don't all invent a different answer.

## Why This Has to Be Open

A trust layer is only worth something if it's interoperable, and the mechanisms
deciding whether one system should trust another have to be inspectable, not
proprietary. An identity and authorization layer that only one vendor can audit
isn't a trust layer. It's a dependency. That is why AGNTCY's components are
built as open infrastructure, designed to complement existing protocols instead
of replacing them:

- **[OASF](https://docs.agntcy.org/oasf/open-agentic-schema-framework/)** (Open Agentic Schema
  Framework), a standard schema for an agent's capabilities and metadata,
  enabling discovery across a registry.
- **[Agent Directory](https://docs.agntcy.org/dir/overview/)**, a federated
  registry for publishing and discovering agents across frameworks and
  organizational boundaries.
- **[SLIM](https://docs.agntcy.org/slim/overview/)**, secure agent-to-agent
  messaging with pub/sub and MLS encryption, protecting the communication itself
  and not just the endpoints.
- **[Identity](https://spec.identity.agntcy.org)**, the identifier,
  `ResolverMetadata`, Agent Badge, and policy model described above.

A2A handles agent-to-agent messaging. MCP handles tool integration. AGNTCY
supplies the identity, discovery, and trust layer that lets those pieces work
together instead of forming silos. That work is happening in the open, with
partners including Cisco Duo, Skyfire, and Permit.io.

## Closing thoughts

Identity tells us who an agent is, backed by a verifiable credential instead of
a claim. Task-Based Access Control defines what it may do, and for how long.
Continuous Authorization decides whether it should still be allowed as the work
evolves.

Together, they're the foundation for multi-agent systems that can operate across
organizational boundaries — not because every party trusts every agent by
default, but because trust itself has become something that can be verified,
scoped, and revoked.

The future of AI won't depend solely on more capable agents. It will depend on
agents whose identity and authorization can be checked, not assumed. A2A 1.0
made that possible by defining exactly where the check belongs. Filling it in is
the work in front of us.

**Get involved:** the [AGNTCY Agent Identity Working
Group](https://github.com/agntcy/governance/blob/main/working-groups/identity/CHARTER.md)
is an open forum for developers, security architects, and researchers building
toward this model.

## References

- [A2A Protocol v1.0.0
  specification](https://a2a-protocol.org/v1.0.0/specification/) — §7.5 server
  authorization responsibilities, §7.6 in-task authorization, §7.6.4 in-task
  authorization scope, §13.1 data access and authorization scoping, §4.6
  extensions, §8.4 Agent Card signing.
- [`specification/a2a.proto` at tag
  v1.0.0](https://github.com/a2aproject/A2A/blob/v1.0.0/specification/a2a.proto)
  — the canonical, normative data model for `TaskState`, `Task`, `Message`,
  `AgentCard`, `AgentSkill`, `AgentExtension`. The JSON Schema bundle published
  at [`spec/a2a.json`](https://a2a-protocol.org/v1.0.0/spec/a2a.json) is a
  generated, non-normative artifact derived from it.
- [AGNTCY Identity specification](https://spec.identity.agntcy.org) — ID and
  `ResolverMetadata` definitions, Agent Badge and MCP Server Badge, issuance and
  verification architecture.
- [AGNTCY Identity Service
  documentation](https://identity-docs.outshift.com) — identity provider
  connection, Agentic Service creation, Policies and TBAC, development guide.
- [draft-ietf-oauth-client-id-metadata-document](https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/),
  OAuth working group.
- [draft-ietf-oauth-transaction-tokens](https://datatracker.ietf.org/doc/draft-ietf-oauth-transaction-tokens/),
  OAuth working group.
- [Model Context Protocol authorization
  specification](https://modelcontextprotocol.io/specification/draft/basic/authorization)
  — client registration and Client ID Metadata Documents.
- [RFC 9396](https://www.rfc-editor.org/rfc/rfc9396.html) (Rich Authorization
  Requests), [RFC 8693](https://www.rfc-editor.org/rfc/rfc8693.html#section-4.1)
  (Token Exchange) §4.1 on the `act` claim,
  [RFC 9449](https://www.rfc-editor.org/rfc/rfc9449.html) (DPoP),
  [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749.html) and
  [RFC 7591](https://www.rfc-editor.org/rfc/rfc7591.html) on client registration
  and scope handling.
- [W3C Verifiable Credentials Data Model
  v2.0](https://www.w3.org/TR/vc-data-model-2.0/) — issuer property
  requirements.

---

*Have questions? Join our [Slack
community](https://join.slack.com/t/agntcy/shared_invite/zt-3xozr6nzq-i6LXv2P8l2kVW4_Prnny2w)
or check out our [GitHub](https://github.com/agntcy).*
