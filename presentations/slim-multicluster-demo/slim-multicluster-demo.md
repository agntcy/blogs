---
marp: true
theme: default
paginate: true
html: true
size: 16:9
style: |
  section { font-size: 12px; padding: 5px 10px; }
  h2 { font-size: 20px; margin: 0; }
---

# SLIM Multicluster Demo

---

## Use Case

- The customer needs to access the services (Agents) running in the Splunk cloud
- Splunk needs to access services in the customer environment (e.g. Kubectl, Jira)
- Customer IT should be able to access services running in both environments 

- Problems:
    - All the agents need to be exposed publically on the internet
    - Reverse Proxy to access customer environment (customized for each app)
    - Data flow in the clear on middle boxes
---

## How SLIM solves the problem

**SLIM** — Secure Low latency Interactive Messaging

<div style="font-size: 11px;">

| <span style="font-size: 13px; font-weight: bold;">Problem</span> | <span style="font-size: 13px; font-weight: bold;">SLIM Solution</span> |
|---|---|
| **Public cloud:** every new service requires a dedicated public endpoint | Single SLIM endpoint exposes all services — no per-service ingress |
| **Private environments:** services behind firewalls are unreachable | Private SLIM nodes connect outbound to a public SLIM endpoint — no inbound exposure needed |
| Data flows in the clear on middle boxes | E2E encryption via MLS — data stays encrypted through intermediate nodes |

</div>

<br>

<div style="transform: scale(0.75); transform-origin: top left;">

```mermaid
%%{init: {'flowchart': {'nodeSpacing': 15, 'rankSpacing': 30, 'padding': 3}}}%%
graph LR
    subgraph PRV["Private Datacenter"]
        S4[Svc D] <--> SN2[SLIM Node]
        S5[Svc E] <--> SN2
    end
    subgraph PUB["Public Cloud"]
        IG[Public Ingress] <--> SN1[SLIM Node]
        SN1 <--> S1[Svc A]
        SN1 <--> S2[Svc B]
        SN1 <--> S3[Svc C]
    end
    C((Client)) --> IG
    SN2 -- "outbound" --> IG
    style IG fill:#FF6B6B,color:#fff
    style SN1 fill:#4A90E2,color:#fff
    style SN2 fill:#4A90E2,color:#fff
    style PUB fill:#e0e0e0,stroke:#999,color:#333
    style PRV fill:#e0e0e0,stroke:#999,color:#333
```

*e.g. Svc A communicates with Svc E through: Svc A ↔ SLIM Node ↔ Public Ingress ↔ SLIM Node ↔ Svc E*

</div>

---

## Comparison with Existing Solutions

<div style="font-size: 12px;">

| **System/Protocol** | **Limitation** |
|---|---|
| Message queues (SQS, RabbitMQ, Kafka, NATS etc.) | • One-directional <br> • No e2e encryption <br> • Can't cross org boundaries |
| HTTP/gRPC | • No E2E encryption <br> • Services must be exposed on the internet |
| VPNs | • No per-service granularity <br> • No e2e encryption <br> • Hard to manage across orgs |
| Reverse proxies | • Per-service exposure and configuration <br> • No e2e encryption <br> • Does not solve cross-org trust |

</div>

---

## SLIM Architecture

<div style="font-size: 11px;">

| **Layer** | **Primary Function** | **Key Responsibilities** |
|---|---|---|
| Data Plane | Message Routing | Message forwarding, Connection management, gRPC over HTTP/2 |
| Session Layer | Secure Messaging | Reliable delivery, E2E encryption |
| Control Plane | Network Orchestration | Node configuration, Route management |

</div>

<br>

<div style="transform: scale(0.85); transform-origin: top left;">

```mermaid
%%{init: {'flowchart': {'nodeSpacing': 10, 'rankSpacing': 30, 'padding': 8}}}%%
graph LR
    subgraph ClusterA["Cluster A"]
        direction TB
        subgraph SA["Service"]
            SLA[Session Layer]
            DPA[Data Plane]
            SLA <--> DPA
        end
        subgraph SN1["SLIM Node 1"]
            DPN1[Data Plane]
        end
        DPA <-- "gRPC/TLS" --> DPN1
    end

    DPN1 <-- "gRPC/TLS" --> DPN2
    SN1 -.-> CP[Control Plane]
    SN2 -.-> CP

    subgraph ClusterB["Cluster B"]
        direction TB
        subgraph SB["Service"]
            SLB[Session Layer]
            DPB[Data Plane]
            SLB <--> DPB
        end
        subgraph SN2["SLIM Node 2"]
            DPN2[Data Plane]
        end
        DPB <-- "gRPC/TLS" --> DPN2
    end

    style CP fill:#555,color:#fff
    style SA fill:#29b6f6,color:#fff
    style SB fill:#29b6f6,color:#fff
    style SLA fill:#1976d2,color:#fff
    style SLB fill:#1976d2,color:#fff
    style DPA fill:#FF9F43,color:#fff
    style DPB fill:#FF9F43,color:#fff
    style SN1 fill:#1976d2,color:#fff
    style SN2 fill:#1976d2,color:#fff
    style DPN1 fill:#FF9F43,color:#fff
    style DPN2 fill:#FF9F43,color:#fff
    style ClusterA fill:none,stroke:#888,stroke-dasharray: 5 5,color:#333
    style ClusterB fill:none,stroke:#888,stroke-dasharray: 5 5,color:#333
```

</div>

<div style="font-size: 9px;">

Each service embeds a **Session Layer** and connects to a local **SLIM Node**, which handles cross-network delivery through the **Data Plane**.

</div>

---

## Zero Trust Data Security

**Network Security + Data Security**

| **Network Security (TLS)** | **Data Security (E2E / MLS)** |
|---|---|
| Secures the link | Secures the data |
| If a node is compromised, traffic can be read | Even if a node is compromised, content stays encrypted |
| Fine for single-hop, trusted infrastructure | Essential for multi-cloud, cross-org scenarios |

```mermaid
graph LR
    A1[Service] -- "gRPC/TLS" --> SN1[SLIM Node 1]
    SN1 -- "gRPC/TLS" --> SN2[SLIM Node 2]
    SN2 -- "gRPC/TLS" --> A2[Service]

    A1 -. "MLS (E2E encrypted)" .-> A2

    style SN1 fill:#4A90E2,color:#fff
    style SN2 fill:#4A90E2,color:#fff
```

MLS: https://www.rfc-editor.org/rfc/rfc9420.txt

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

## SLIM Multicluster Demo Deployment

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}, 'flowchart': {'nodeSpacing': 8, 'rankSpacing': 15, 'padding': 3}}}%%
graph LR
    subgraph Customer[Customer Cluster]
        direction LR
        AMCP[Atlassian MCP] ---|MCP| MP1[MCP Proxy]
        KMCP[K8s MCP] ---|MCP| MP1[MCP Proxy]
        MP1 ---|MCP/SLIM| CSN[Slim Node]
        CSA[Spire Agent] -.- CSN
        CSN ---|SLIM| NP[Network Proxy]
        CSA --- NP
    end

    NP ------ Ingress

    subgraph Laptop[IT Ops Laptop]
        Copilot[Copilot] -.- LSA[Spire Agent]
    end

    LSA ------ Ingress
    Copilot ---|A2A/SLIM| Ingress

    subgraph Cloud [Cloud Cluster]
        direction LR
        Ingress[nginx ingress]
        Ingress ---|gRPC| SC[Slim Controller]
        Ingress --- SS[Spire Server]
        Ingress ---|SLIM| SN[Slim Node]
        SC ---|gRPC| SN
        HCJ[Health Check job] ---|A2A/SLIM| K8S[k8s TBA] ---|A2A/SLIM| SN
        SA[Spire Agent] --- SS
        SA -.- SC
        SA -.- SN
        SA -.- K8S
        SA -.- HCJ
    end

    style Customer fill:#e0e0e0,stroke:#999,color:#333
    style Cloud fill:#e0e0e0,stroke:#999,color:#333
    style Laptop fill:#e0e0e0,stroke:#999,color:#333
    style NP fill:#FF9F43,color:#fff
    style Ingress fill:#FF6B6B,color:#fff
    style SC fill:#4A90E2,color:#fff
    style SN fill:#4A90E2,color:#fff
    style K8S fill:#4A90E2,color:#fff
    style HCJ fill:#4A90E2,color:#fff
    style SS fill:#50C878,color:#fff
    style SA fill:#50C878,color:#fff
    style AMCP fill:#4A90E2,color:#fff
    style KMCP fill:#4A90E2,color:#fff
    style MP1 fill:#4A90E2,color:#fff
    style CSN fill:#4A90E2,color:#fff
    style CSA fill:#50C878,color:#fff
    style Copilot fill:#4A90E2,color:#fff
    style LSA fill:#50C878,color:#fff
```

---

## Customer Zero-Touch On-Boarding

The on-boarding of a new customer in the platform is fully automated

The customer only needs:
- An authentication Token
- The public address of the Controller

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

## Customer On-Boarding: Before

Before on-boarding, the controller only knows about its own cloud-side node. No links to external environments exist yet.

<div style="display:flex; gap:10px; align-items:flex-start; margin-top:8px">
  <div style="flex:1">
    <p style="margin:0 0 4px; font-weight:bold; font-size:11px">Nodes (cloud only)</p>
    <img src="./figures/nodes-before-on-boarding.jpg" style="width:100%; border-radius:4px">
  </div>
  <div style="flex:1">
    <p style="margin:0 0 4px; font-weight:bold; font-size:11px">Links (none)</p>
    <img src="./figures/links-before-on-boarding.jpg" style="width:100%; border-radius:4px">
  </div>
</div>

---

## Customer On-Boarding: Install the Helm Chart

Show the values we see in the demo

---

## Customer On-Boarding: After

After the chart is installed, the controller automatically discovers the new node, creates a link, and populates routes to the customer's services.

<div style="display:flex; gap:10px; align-items:flex-start; margin-top:8px">
  <div style="flex:1">
    <p style="margin:0 0 4px; font-weight:bold; font-size:11px">New cross-cluster link</p>
    <img src="./figures/links-after-on-boarding.jpg" style="width:100%; border-radius:4px">
  </div>
  <div style="flex:1">
    <p style="margin:0 0 4px; font-weight:bold; font-size:11px">Routes to customer services</p>
    <img src="./figures/routes-after-on-boarding.jpg" style="width:100%; border-radius:4px">
  </div>
</div>

---

## Customer On-Boarding Demo

<video controls style="max-width: 100%; max-height: 100%; object-fit: contain;">
  <source src="/videos/routes.mp4" type="video/mp4">
</video>

---

## Human Interaction

- Humand can use an a2a CLI to interact with the cloud services
  - connecting to the SLIM endpoint and invoking A2A RPCs on the services running in the cloud cluster
- Authentication is handled via JWT tokens (using SPIRE in this particular case)
- The a2a CLI can also be used as a skill for an agent
  - enabling automated human-in-the-loop workflows — demonstrated in the video
- The CLI configuration is minimal:

```yaml
slim:
  endpoint: "https://slim-dataplane.dev.eticloud.io"
  local-name: "agntcy/cli/a2acli"
  spire:
    socket-path: "/tmp/spire-agent/public/api.sock"
    jwt-audiences:
      - "slim"
```

---

## Human Interacion Demo

<video controls style="max-width: 100%; max-height: 100%; object-fit: contain;">
  <source src="/videos/application.mp4" type="video/mp4">
</video>
