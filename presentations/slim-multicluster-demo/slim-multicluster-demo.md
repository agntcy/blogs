---
marp: true
paginate: true
html: true
size: 16:9
style: |
  section { font-size: 12px; padding: 5px 10px; }
  h2 { font-size: 20px; margin: 0; }
---

# K8s Remediation Use Case<br> Using SLIM

---

## K8s Remediation Use Case

<div style="display:flex; justify-content:center; margin-top:15px; transform:scale(2.2); transform-origin:top center">

```mermaid
%%{init: {'flowchart': {'nodeSpacing': 15, 'rankSpacing': 30, 'padding': 3}}}%%
graph LR
    subgraph PRV["Private Datacenter"]
        S4[svc D] <--> RP[Reverse Proxy]
    end
    subgraph PUB["Public Cloud"]
        IG[Public Ingress]
        IG <--> S1[svc A]
        IG <--> S2[svc B]
        IG <--> S3[svc C]
    end
    C((Client)) --> IG
    RP <--> IG
    style IG fill:#E53935,color:#fff
    style RP fill:#42A5F5,color:#fff
    style PUB fill:#e0e0e0,stroke:#999,color:#333
    style PRV fill:#e0e0e0,stroke:#999,color:#333
    style S1 fill:#90CAF9,color:#1a1a1a
    style S2 fill:#90CAF9,color:#1a1a1a
    style S3 fill:#90CAF9,color:#1a1a1a
    style S4 fill:#90CAF9,color:#1a1a1a
```

</div>

<div style="margin-top:150px; font-size:14px; line-height:2; text-align:center">

✗ Every service needs a **dedicated public endpoint**

✗ **Reverse proxy** requires configuration on the customer's cluster

✗ Data flows **in the clear** through middle boxes 

</div>

---

## How SLIM solves the problem

<div style="display:flex; justify-content:center; margin-top:15px; transform:scale(2.2); transform-origin:top center">

```mermaid
%%{init: {'flowchart': {'nodeSpacing': 15, 'rankSpacing': 30, 'padding': 3}}}%%
graph LR
    subgraph PRV["Private Datacenter"]
        S4[svc D] <--> SN2[SLIM Node]
        S5[svc E] <--> SN2
    end
    subgraph PUB["Public Cloud"]
        IG[Public Ingress] <--> SN1[SLIM Node]
        SN1 <--> S1[svc A]
        SN1 <--> S2[svc B]
        SN1 <--> S3[svc C]
    end
    C((Client)) --> IG
    SN2 <--> IG
    style IG fill:#E53935,color:#fff
    style SN1 fill:#1565C0,color:#fff
    style SN2 fill:#1565C0,color:#fff
    style S1 fill:#90CAF9,color:#1a1a1a
    style S2 fill:#90CAF9,color:#1a1a1a
    style S3 fill:#90CAF9,color:#1a1a1a
    style S4 fill:#90CAF9,color:#1a1a1a
    style S5 fill:#90CAF9,color:#1a1a1a
    style PUB fill:#e0e0e0,stroke:#999,color:#333
    style PRV fill:#e0e0e0,stroke:#999,color:#333
```

</div>

<div style="margin-top:150px; font-size:14px; line-height:2; text-align:center">

✓ **Single SLIM endpoint** exposes all services — no per-service ingress

✓ Private SLIM nodes connect **outbound** — communication is **bidirectional** once established

✓ **E2E encryption** via MLS over **gRPC/TLS** — data stays encrypted through all intermediate nodes

</div>

<!--
## Comparison with Existing Solutions

<br>

<div style="font-size: 18px;">

| **System/Protocol** | **Limitation** |
|---|---|
| HTTP/gRPC | • No E2E encryption <br> • Services must be exposed on the internet |
| VPNs | • No E2E encryption <br> • No per-service granularity <br> • Hard to manage across orgs |
| Reverse proxies | • No E2E encryption <br> • Complex configuration on customer cluster <br> |

</div>
-->


---

## What is SLIM

**Secure Low-latency Interactive Messaging** — a communication framework that provides the secure transport layer for services across network boundaries.

<div style="font-size: 13px; width: fit-content; margin: 0 auto; font-size:16px;">

| | |
|---|---|
| **gRPC / HTTP2** | Easy NAT & firewall traversal |
| **E2E Encrypted** | TLS transport + MLS data encryption |
| **Flexible Patterns** | Point-to-point, group channels, RPC |
| **Distributed** | Separate Data Plane and Controller |
| **No Direct Exposure** | Services reachable without exposed ports |
| **Multi-language** | Rust core → Python, Go, C#, JS/TS, Kotlin, Java |
| **Protocol Agnostic** | A2A, MCP, OTel, custom protocols |

</div>

---

## SLIM Architecture
<br>

<div style="transform: scale(0.85); transform-origin: top center;">

```mermaid
%%{init: {'flowchart': {'nodeSpacing': 10, 'rankSpacing': 30, 'padding': 8}}}%%
graph LR
    subgraph ClusterA["Cluster A"]
        direction TB
        subgraph SA["Service"]
            SLA[SLIM SDK]
            DPA[Data Plane]
            SLA <--> DPA
        end
        subgraph SN1["SLIM Node 1"]
            DPN1[Data Plane]
        end
        DPA <-- "gRPC/TLS" --> DPN1
    end

    DPN1 <-- "gRPC/TLS" --> DPN2
    SN1 -.-> CP[Controller]
    SN2 -.-> CP

    subgraph ClusterB["Cluster B"]
        direction TB
        subgraph SB["Service"]
            SLB[SLIM SDK]
            DPB[Data Plane]
            SLB <--> DPB
        end
        subgraph SN2["SLIM Node 2"]
            DPN2[Data Plane]
        end
        DPB <-- "gRPC/TLS" --> DPN2
    end

    style CP fill:#0D47A1,color:#fff
    style SA fill:#90CAF9,color:#1a1a1a
    style SB fill:#90CAF9,color:#1a1a1a
    style SLA fill:#1565C0,color:#fff
    style SLB fill:#1565C0,color:#fff
    style DPA fill:#42A5F5,color:#fff
    style DPB fill:#42A5F5,color:#fff
    style SN1 fill:#1565C0,color:#fff
    style SN2 fill:#1565C0,color:#fff
    style DPN1 fill:#42A5F5,color:#fff
    style DPN2 fill:#42A5F5,color:#fff
    style ClusterA fill:none,stroke:#888,stroke-dasharray: 5 5,color:#333
    style ClusterB fill:none,stroke:#888,stroke-dasharray: 5 5,color:#333
```

<div style="display:flex; justify-content:center; gap:70px; margin-top:40px; font-size:20px;">
  <div style="text-align:center;"><strong>SLIM SDK</strong><br>Reliable delivery <br> E2E encryption</div>
  <div style="text-align:center;"><strong>Data Plane</strong><br>Message forwarding <br> Connection Management (gRPC)</div>
  <div style="text-align:center;"><strong>Controller</strong><br>Node configuration <br> Route management</div>
</div>

</div>


---

## Zero Trust Data Security

<div style="transform: scale(1.1); transform-origin: top center; margin-top:30px; margin-top:60px;">

```mermaid
graph LR
    A1[Service] <-- "gRPC/TLS" --> SN1[SLIM Node 1]
    SN1 <-- "gRPC/TLS" --> SN2[SLIM Node 2]
    SN2 <-- "gRPC/TLS" --> A2[Service]

    A1 <-. "MLS (E2E encrypted)" .-> A2

    style SN1 fill:#1565C0,color:#fff
    style SN2 fill:#1565C0,color:#fff
    style A1 fill:#90CAF9,color:#1a1a1a
    style A2 fill:#90CAF9,color:#1a1a1a
```

</div>

<div style="display:flex; justify-content:center; gap:40px; margin-top:70px; font-size:16px;">
  <div style="text-align:center; padding:15px 25px;">
    <strong> Network Security</strong><br>
    <strong>gRPC/TLS</strong><br>
    Encrypts every connection<br>
    Protects data in transit between nodes
  </div>
  <div style="text-align:center; padding:15px 25px;">
    <strong> Data Security</strong><br>
    <strong>Message Layer Security (MLS) Protocol </strong><br>
    Encrypts data end-to-end<br>
    Content safe even if nodes are compromised
  </div>
</div>

---

## Communication Patterns — P2P, Group and RPCs

SLIM natively supports the following interaction patterns between services.

```mermaid
graph TB
    subgraph RPCM[RPC Multicast]
        direction TB
        rm1((Client)) -- "requests" --> rch{{o/n/rpc-channel}}
        rch -- "responses" --> rm1
        rm2((Server 1)) -- "responses" --> rch
        rm3((Server 2)) -- "responses" --> rch
    end

    subgraph RPC[RPC P2P]
        direction LR
        rc((o/n/c/did)) -- "requests" --> rs((o/n/s/did))
        rs -- "responses" --> rc
    end

    subgraph GRP[Group]
        direction TB
        g1((Service 1)) --> ch{{o/n/channel/0xffff}}
        g2((Service 2)) --> ch
        g3((Service 3)) --> ch
    end

    subgraph P2P[Point-to-Point]
        direction LR
        pp1((o/n/a1/did)) <--> pp2((o/n/a2/did))
    end
```

Services are identified using a hierarchical naming system based on Decentralized Identifiers (DIDs):
- `organization/namespace/service/h(did:key)` — the DID is the hash of the public key presented by the service

Services can join a shared channel and form groups:
- `organization/namespace/group/0xffffffff`

---
layout: cover
---

# K8s Remediation Use Case Demo

---

## Demo Functional Topology

<div style="transform:scale(1.1); transform-origin:top center; margin-top:50px;">

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '16px'}, 'flowchart': {'nodeSpacing': 24, 'rankSpacing': 30, 'padding': 10}}}%%
graph LR
    subgraph Left[" "]
        direction TB
        subgraph Customer[Customer Cluster]
            direction LR
            AMCP[Atlassian MCP Server] --> CSN[SLIM Node]
            KMCP[k8s MCP Server] --> CSN
        end
        subgraph Laptop[IT Ops Laptop]
            Copilot["Copilot [A2A client]"]
        end
    end

    subgraph Cloud[Cloud Cluster]
        direction LR
        SN[SLIM Node]
        SC[Controller]
        HCJ["Health Check Job\n[A2A Client]"]
        K8S["k8s troubleshooting agent\n[A2A Server]\n[MCP Client]"]
        SN -.-> SC
        SN --- K8S
        K8S --- HCJ
    end

    Copilot --> SN
    CSN <--> SN
    CSN -.-> SC

    style Left fill:none,stroke:none
    style Customer fill:#e0e0e0,stroke:#999,color:#333
    style Cloud fill:#e0e0e0,stroke:#999,color:#333
    style Laptop fill:#e0e0e0,stroke:#999,color:#333
    style SC fill:#0D47A1,color:#fff
    style SN fill:#1565C0,color:#fff
    style CSN fill:#1565C0,color:#fff
    style AMCP fill:#90CAF9,color:#1a1a1a
    style KMCP fill:#90CAF9,color:#1a1a1a
    style K8S fill:#90CAF9,color:#1a1a1a
    style HCJ fill:#90CAF9,color:#1a1a1a
    style Copilot fill:#90CAF9,color:#1a1a1a
```

</div>

<div style="display:flex; justify-content:center; gap:30px; margin-top:50px; font-size:18px;">
  <div>── <strong>data</strong> (gRPC)</div>
  <div>┄┄ <strong>control</strong> (gRPC)</div>
</div>

---

## Demo Full Deployment 

<div style="transform:scale(1.1); transform-origin:top center; margin-top:70px;">

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '20px'}, 'flowchart': {'nodeSpacing': 8, 'rankSpacing': 12, 'padding': 4}}}%%
graph LR
    subgraph Customer[Customer Cluster]
        direction LR
        AMCP[Atlassian MCP] --- MP1["MCP Proxy\n[MCP Server]"]
        KMCP[K8s MCP] --- MP1
        MP1 --- CSN[Slim Node]
        CSN --- NP[Network Proxy]
        CSA[Spire Agent] --- CSN
        CSA --- NP
        CSA --- MP1
    end

    subgraph Laptop[IT Ops Laptop]
        direction LR
        Copilot["Copilot\n[A2A Client]"]
        LSA[Spire Agent]
        Copilot --- LSA
    end

    subgraph Cloud[Cloud Cluster]
        direction LR
        Ingress[nginx ingress] --- SN[Slim Node]
        Ingress --- SC[Controller]
        SC --- SN
        SN --- K8S["k8s troubleshooting agent\n[A2A Server]\n[MCP Client]"]
        SN --- HCJ["Health Check job\n[A2A Client]"]
        Ingress --- SS[Spire Server]
        SS --- SA[Spire Agent]
        SA --- SC
        SA --- SN
        SA --- K8S
        SA --- HCJ
    end

    NP --> Ingress
    Copilot --- Ingress
    LSA --- Ingress

    linkStyle 4 stroke:#9C27B0
    linkStyle 5 stroke:#9C27B0
    linkStyle 6 stroke:#9C27B0
    linkStyle 7 stroke:#9C27B0
    linkStyle 13 stroke:#9C27B0
    linkStyle 14 stroke:#9C27B0
    linkStyle 15 stroke:#9C27B0
    linkStyle 16 stroke:#9C27B0
    linkStyle 17 stroke:#9C27B0
    linkStyle 18 stroke:#9C27B0
    linkStyle 21 stroke:#9C27B0

    style Customer fill:#e0e0e0,stroke:#999,color:#333
    style Cloud fill:#e0e0e0,stroke:#999,color:#333
    style Laptop fill:#e0e0e0,stroke:#999,color:#333
    style NP fill:#42A5F5,color:#fff
    style Ingress fill:#E53935,color:#fff
    style SC fill:#0D47A1,color:#fff
    style SN fill:#1565C0,color:#fff
    style K8S fill:#90CAF9,color:#1a1a1a
    style HCJ fill:#90CAF9,color:#1a1a1a
    style SS fill:#BBDEFB,color:#1a1a1a
    style SA fill:#BBDEFB,color:#1a1a1a
    style AMCP fill:#90CAF9,color:#1a1a1a
    style KMCP fill:#90CAF9,color:#1a1a1a
    style MP1 fill:#90CAF9,color:#1a1a1a
    style CSN fill:#1565C0,color:#fff
    style CSA fill:#BBDEFB,color:#1a1a1a
    style Copilot fill:#90CAF9,color:#1a1a1a
    style LSA fill:#BBDEFB,color:#1a1a1a
```

</div>

<div style="display:flex; justify-content:center; gap:30px; margin-top:70px; font-size:18px;">
  <div>── <strong>data</strong> (gRPC)</div>
  <div><span style="color:#9C27B0;">──</span> <strong>SPIRE auth</strong> (token provisioning)</div>
</div>

---

## How to Configure Service Names

In SLIM all services are identified by a name `organization/namespace/service/h(did:key)`


<table style="font-size:14px; width:100%; border-collapse:collapse">
  <thead>
    <tr>
      <th style="padding:18px 12px; text-align:left; white-space:nowrap; border-bottom:2px solid #ccc">Entity</th>
      <th style="padding:18px 12px; text-align:left; white-space:nowrap; border-bottom:2px solid #ccc">Pattern</th>
      <th style="padding:18px 12px; text-align:left; white-space:nowrap; border-bottom:2px solid #ccc">Example</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #ccc">Splunk</td>
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #ccc"><code>splunk/&lt;deployment-region&gt;/&lt;service-name&gt;</code></td>
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #ccc"><code>splunk/eu-central-1/k8s_troubleshooting_agent</code></td>
    </tr>
    <tr>
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #ccc">Customer (on-cluster)</td>
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #ccc"><code>&lt;customer-id&gt;/&lt;cluster-id&gt;/&lt;service-name&gt;</code></td>
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #ccc"><code>customer-1/on-prem-cluster/k8s-mcp-proxy</code></td>
    </tr>
    <tr>
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #ccc">Customer (off-cluster)</td>
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #ccc"><code>&lt;customer-id&gt;/off-cluster/&lt;service-name&gt;</code></td>
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #ccc"><code>customer-1/off-cluster/a2acli</code></td>
    </tr>
  </tbody>
</table>

---

## Customer Zero-Touch Onboarding

The onboarding of a new customer to the platform is fully automated. The customer only needs:

<div style="display:flex; justify-content:center; gap:40px; margin-top:30px; font-size:24px;">
  <div style="text-align:center; padding:15px 25px;">
    <strong>🔑 Authentication Token</strong>
  </div>
  <div style="text-align:center; padding:15px 25px;">
    <strong>🌐 Controller Public Address</strong>
  </div>
</div>

```yaml
slim:
  services:
    slim/0:
      controller:
        clients:
          - endpoint: "https://slim-control-plane-south.dev.eticloud.io:443"
            tls:
              insecure: false
              include_system_ca_certs_pool: true
            auth:
              type: spire
              jwt_audiences:
                - "slim"
              socket_path: /tmp/spire-agent/public/spire-agent.sock

```
---

## Customer Onboarding Demo

<div style="display:flex; justify-content:center;">
<video controls style="max-width: 88%; max-height: 78vh; object-fit: contain;">
  <source src="/videos/routes.mp4" type="video/mp4">
</video>
</div>

---

## Human Interaction

<br>

Any human operator can connect to the platform at any time with minimal configuration:

<div style="display:flex; justify-content:center; gap:40px; margin-top:15px; font-size:18px;">
  <div style="text-align:center; padding:15px 25px;">
    <strong>🔑 Authentication Token</strong>
  </div>
  <div style="text-align:center; padding:15px 25px;">
    <strong>🌐 SLIM Public Endpoint</strong>
  </div>
</div>

```yaml
slim:
  endpoint: "https://slim-dataplane.dev.eticloud.io"
  local-name: "customer-1/off-cluster/a2acli"
  spire:
    socket-path: "/tmp/spire-agent/public/api.sock"
    jwt-audiences:
      - "slim"
```

---

## Human Interaction — Sequence Diagram

<div style="transform:scale(1.05); transform-origin:top center; margin-top:15px">

```mermaid
%%{init: {'theme': 'base', 'sequence': {'mirrorActors': false}, 'themeVariables': {'fontSize': '16px', 'actorBkg': '#F5F6FA', 'actorBorder': '#9E9E9E', 'activationBkgColor': '#E3F2FD', 'signalColor': '#333', 'signalTextColor': '#333'}}}%%
sequenceDiagram
    box rgb(245,246,250) IT Ops Laptop
        actor Human as IT Ops
        participant Copilot as Copilot
    end
    box rgb(227,242,253) Cloud Cluster
        participant SNc as SLIM Node (cloud)
        participant Agent as k8s Agent
    end
    box rgb(232,245,233) Customer Cluster
        participant SNp as SLIM Node (on-prem)
        participant Proxy as MCP Proxy
        participant MCP as k8s MCP Server
    end

    Human->>Copilot: "Give me the list of pods?"
    Note over Copilot: A2A client skill invoked
    Copilot->>SNc: A2A request over SLIM
    SNc->>Agent: 
    Note over Agent: analyze request,<br/>invoke MCP tool
    Agent->>SNc: MCP request over SLIM
    SNc->>SNp: route to on-prem cluster
    SNp->>Proxy: 
    Proxy->>MCP: MCP request
    MCP-->>Proxy: MCP response
    Proxy-->>SNp: MCP response over SLIM
    SNp-->>SNc: route back to cloud
    SNc-->>Agent: 
    Note over Agent: compose A2A reply
    Agent-->>SNc: A2A response over SLIM
    SNc-->>Copilot: 
    Copilot-->>Human: cluster status report
```

</div>

---

## Automated Health Check — Sequence Diagram

<div style="transform:scale(1); transform-origin:top center; margin-top:15px">

```mermaid
%%{init: {'theme': 'base', 'sequence': {'mirrorActors': false}, 'themeVariables': {'fontSize': '16px', 'actorBkg': '#F5F6FA', 'actorBorder': '#9E9E9E', 'activationBkgColor': '#E3F2FD', 'signalColor': '#333', 'signalTextColor': '#333'}}}%%
sequenceDiagram
    box rgb(227,242,253) Cloud Cluster
        participant HCJ as Health Check Job
        participant SNc as SLIM Node (cloud)
        participant Agent as k8s Agent
    end
    box rgb(232,245,233) Customer Cluster
        participant SNp as SLIM Node (on-prem)
        participant Proxy as MCP Proxy
        participant KMCP as k8s MCP Server
        participant AMCP as Atlassian MCP Server
    end

    Note over SNp,AMCP: pod ImagePullBackOff — container fails to start
    HCJ->>SNc: "What's the status of the cluster?"<br/>A2A request over SLIM
    SNc->>Agent: 
    Note over SNc,KMCP: MCP call over SLIM → get pod status<br/>(see previous diagram)
    SNc-->>Agent: MCP response over SLIM
    Note over Agent: pod failure detected,<br/>create Jira issue
    Agent->>SNc: MCP request over SLIM
    SNc->>SNp: route to on-prem cluster
    SNp->>Proxy: 
    Proxy->>AMCP: MCP request
    Note over AMCP: create new issue on<br/>the customer's Jira
    AMCP-->>Proxy: MCP response
    Proxy-->>SNp: MCP response over SLIM
    SNp-->>SNc: route back to cloud
    SNc-->>Agent: 
    Agent-->>SNc: A2A response over SLIM
    SNc-->>HCJ: 
```

</div>

---

## Human Interaction Demo

<video controls style="max-width: 100%; max-height: 100%; object-fit: contain;">
  <source src="/videos/application.mp4" type="video/mp4">
</video>


---
layout: cover
---

# K8s Remediation Use Case<br> Using SLIM

---

## SLIM Controller Status: Before Onboarding

Node List: Only one SLIM node is available

<div style="display:flex; flex-direction:column; gap:10px; margin-top:8px">
  <div>
    <img src="./figures/nodes-before-onboarding.png" style="width:100%; border-radius:4px">
  </div>
</div>

Link List: No connections established

<div style="display:flex; flex-direction:column; gap:10px; margin-top:8px">
  <div>
    <img src="./figures/links-before-onboarding.png" style="width:100%; border-radius:4px">
  </div>
</div>

---

## SLIM Controller Status: Before Onboarding

Route List: Only Local services are available

<div style="display:flex; gap:10px; align-items:flex-start; margin-top:8px">
  <div style="flex:1">
    <img src="./figures/routes-before-onboarding.png" style="width:98%; border-radius:4px">
  </div>
</div>

---

## SLIM Controller Status: After Onboarding

Node List: New SLIM node registered

<div style="display:flex; flex-direction:column; gap:10px; margin-top:8px">
  <div>
    <img src="./figures/nodes-after-onboarding.png" style="width:100%; border-radius:4px">
  </div>
</div>


Link List: New connection established with remote cluster

<div style="display:flex; flex-direction:column; gap:10px; margin-top:8px">
  <div>
    <img src="./figures/links-after-onboarding.png" style="width:100%; border-radius:4px">
  </div>
</div>

---

## SLIM Controller Status: After Onboarding

Route List: Customer services are now reachable

<div style="display:flex; gap:10px; align-items:flex-start; margin-top:8px">
  <div style="flex:1">
    <img src="./figures/routes-after-onboarding.png" style="width:90%; border-radius:4px">
  </div>
</div>

---
