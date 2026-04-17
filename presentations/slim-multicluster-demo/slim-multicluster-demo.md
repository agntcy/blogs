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

## Use case

<div style="display:flex; justify-content:center; margin-top:15px; transform:scale(2.2); transform-origin:top center">

```mermaid
%%{init: {'flowchart': {'nodeSpacing': 15, 'rankSpacing': 30, 'padding': 3}}}%%
graph LR
    subgraph PRV["Private Datacenter"]
        S4[svc A] <--> RP[Reverse Proxy]
    end
    subgraph PUB["Public Cloud"]
        IG[Public Ingress]
        IG <--> S1[svc A]
        IG <--> S2[svc B]
        IG <--> S3[svc C]
    end
    C((Client)) --> IG
    RP -- "outbound" --> IG
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

✗ **Custom reverse proxy** required per customer app

✗ Data flows **in the clear** through middle boxes

</div>

---

## Use Case: How SLIM solves the problem

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
    SN2 -- "outbound" --> IG
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

✓ Private SLIM nodes connect **outbound** — no inbound firewall exposure

✓ **E2E encryption** via MLS — data stays encrypted through all intermediate nodes

</div>

<!--

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

*e.g. svc A communicates with svc E through: svc A ↔ SLIM Node ↔ Public Ingress ↔ SLIM Node ↔ svc E*

</div>
-->
---

## Comparison with Existing Solutions

<br>

<div style="font-size: 18px;">

| **System/Protocol** | **Limitation** |
|---|---|
| HTTP/gRPC | • No E2E encryption <br> • Services must be exposed on the internet |
| VPNs | • No per-service granularity <br> • No e2e encryption <br> • Hard to manage across orgs |
| Reverse proxies | • Per-service exposure and configuration <br> • No e2e encryption <br> • Does not solve cross-org trust |

</div>

---

## SLIM Architecture

<div style="font-size: 11px;">

| **Component** | **Key Responsibilities** |
|---|---|---|
| Data Plane | Message forwarding, Connection management, gRPC over HTTP/2 |
| Slim SDK | Reliable delivery, E2E encryption |
| Controller | Node configuration, Route management |

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
    SN1 -.-> CP[SLIM Controller]
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

</div>

<div style="font-size: 9px;">

Each service embeds a **Session Layer** and connects to a local **SLIM Node**, which handles cross-network delivery through the **Data Plane**.

</div>

---

## Zero Trust Data Security

**Network Security + Data Security**

| **Network Security (TLS)** | **Data Security (E2EE / MLS)** |
|---|---|
| Secures the link | Secures the data |
| If a node is compromised, traffic can be read | Even if a node is compromised, content stays encrypted |
| Fine for single-hop, trusted infrastructure | Essential for multi-cloud, cross-org scenarios |

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
layout: cover
---

# SLIM Multicluster Demo

---

## SLIM Multicluster Demo — Functional Topology

<div style="font-size: 9px; margin-bottom: 4px;">

── data channel &nbsp;&nbsp;&nbsp; ┄┄ control channel

</div>

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}, 'flowchart': {'nodeSpacing': 12, 'rankSpacing': 30, 'padding': 10}}}%%
graph LR
    subgraph Left[" "]
        direction TB
        subgraph Customer[Customer Cluster]
            direction LR
            AMCP[Atlassian MCP] --> CSN[SLIM Node]
            KMCP[K8s MCP] --> CSN
        end
        subgraph Laptop[IT Ops Laptop]
            Copilot[Copilot]
        end
    end

    subgraph Cloud[Cloud Cluster]
        direction LR
        SN[SLIM Node]
        SC[SLIM Controller]
        HCJ[Health Check Job]
        K8S["k8s TBA\n(A2A, MCP)"]
        SN -. "gRPC" .-> SC
        SN --- K8S
        K8S --- HCJ
    end

    Copilot -- "A2A/SLIM" --> SN
    CSN <-- "gRPC" --> SN
    CSN -. "gRPC" .-> SC

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

---

## SLIM Multicluster Demo — Full Deployment

<div style="font-size: 9px; margin-bottom: 4px;">

── data channel &nbsp;&nbsp;&nbsp; ┄┄ control channel

</div>

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}, 'flowchart': {'nodeSpacing': 12, 'rankSpacing': 25, 'padding': 8}}}%%
graph LR
    subgraph Left[" "]
        direction TB
        subgraph Laptop[IT Ops Laptop]
            direction LR
            Copilot[Copilot]
            LSA[Spire Agent]
            Copilot -.- LSA
        end
        subgraph Customer[Customer Cluster]
            direction LR
            subgraph CustServices[Services]
                direction LR
                AMCP[Atlassian MCP] ---|MCP| MP1[MCP Proxy]
                KMCP[K8s MCP] ---|MCP| MP1
            end
            subgraph CustSLIM[SLIM]
                direction LR
                CSN[Slim Node]
            end
            NP[Network Proxy]
            CSN ---|SLIM| NP
            subgraph CustIdentity[Identity]
                CSA[Spire Agent]
            end
            MP1 ---|MCP/SLIM| CSN
            CSA -.- CSN
            CSA -.- NP
        end
    end

    subgraph Cloud[Cloud Cluster]
        direction TB
        Ingress[nginx ingress]
        subgraph CloudSLIM[SLIM]
            direction LR
            SC[Slim Controller] ---|gRPC| SN[Slim Node]
        end
        subgraph CloudServices[Services]
            direction LR
            HCJ[Health Check job] --- K8S["k8s TBA\n(A2A, MCP)"]
        end
        subgraph CloudIdentity[Identity]
            direction LR
            SS[Spire Server] --- SA[Spire Agent]
        end
        Ingress ---|gRPC| SC
        Ingress ---|SLIM| SN
        Ingress --- SS
        K8S --- SN
        SA -.- SC
        SA -.- SN
        SA -.- K8S
        SA -.- HCJ
    end

    NP -- "outbound" --> Ingress
    Copilot ---|A2A/SLIM| Ingress
    LSA --- Ingress

    style Left fill:none,stroke:none
    style Customer fill:#e0e0e0,stroke:#999,color:#333
    style Cloud fill:#e0e0e0,stroke:#999,color:#333
    style Laptop fill:#e0e0e0,stroke:#999,color:#333
    style CustServices fill:none,stroke:#ccc,stroke-dasharray: 3 3
    style CustSLIM fill:none,stroke:#ccc,stroke-dasharray: 3 3
    style CustIdentity fill:none,stroke:#ccc,stroke-dasharray: 3 3
    style CloudSLIM fill:none,stroke:#ccc,stroke-dasharray: 3 3
    style CloudServices fill:none,stroke:#ccc,stroke-dasharray: 3 3
    style CloudIdentity fill:none,stroke:#ccc,stroke-dasharray: 3 3
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

---

## How to Configure SLIM Names

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
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #cc">Splunk</td>
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #cc"><code>splunk/&lt;deployment-region&gt;/&lt;service-name&gt;</code></td>
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #cc"><code>splunk/eu-central-1/k8s_troubleshooting_agent</code></td>
    </tr>
    <tr>
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #cc">Customer (on-cluster)</td>
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #cc"><code>&lt;customer-id&gt;/&lt;cluster-id&gt;/&lt;service-name&gt;</code></td>
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #cc"><code>customer-1/on-prem-cluster/k8s-mcp-proxy</code></td>
    </tr>
    <tr>
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #cc">Customer (off-cluster)</td>
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #cc"><code>&lt;customer-id&gt;/off-cluster/&lt;service-name&gt;</code></td>
      <td style="padding:18px 12px; white-space:nowrap; border-bottom:1px solid #cc"><code>customer-1/off-cluster/a2acli</code></td>
    </tr>
  </tbody>
</table>

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

## SLIM Controller Status: Before On-Boarding

Node List: Only one SLIM node available

<div style="display:flex; flex-direction:column; gap:10px; margin-top:8px">
  <div>
    <img src="./figures/nodes-before-on-boarding.png" style="width:100%; border-radius:4px">
  </div>
</div>

Link List: No connection set

<div style="display:flex; flex-direction:column; gap:10px; margin-top:8px">
  <div>
    <img src="./figures/links-before-on-boarding.png" style="width:100%; border-radius:4px">
  </div>
</div>

---

## SLIM Controller Status: Before On-Boarding

Route List: Only Local services are available

<div style="display:flex; gap:10px; align-items:flex-start; margin-top:8px">
  <div style="flex:1">
    <img src="./figures/routes-before-on-boarding.png" style="width:98%; border-radius:4px">
  </div>
</div>

---

## SLIM Controller Status: After On-Boarding

Node List: New SLIM node registerd

<div style="display:flex; flex-direction:column; gap:10px; margin-top:8px">
  <div>
    <img src="./figures/nodes-after-on-boarding.png" style="width:100%; border-radius:4px">
  </div>
</div>


Link List: New connection established with remote cluster

<div style="display:flex; flex-direction:column; gap:10px; margin-top:8px">
  <div>
    <img src="./figures/links-after-on-boarding.png" style="width:100%; border-radius:4px">
  </div>
</div>

---

## SLIM Controller Status: After On-Boarding

Route List: Customer services are now reachable

<div style="display:flex; gap:10px; align-items:flex-start; margin-top:8px">
  <div style="flex:1">
    <img src="./figures/routes-after-on-boarding.png" style="width:90%; border-radius:4px">
  </div>
</div>

---

## Customer On-Boarding Demo

<video controls style="max-width: 100%; max-height: 100%; object-fit: contain;">
  <source src="/videos/routes.mp4" type="video/mp4">
</video>

---

## Human Interaction

<br>

- Humans can use an a2a CLI to interact with the cloud services
  - connecting to the SLIM endpoint and invoking A2A RPCs on the services running in the cloud cluster
- Authentication is handled via JWT tokens (using SPIRE in this particular case)
- The a2a CLI can also be used as a skill for an agent
  - enabling automated human-in-the-loop workflows — demonstrated in the video
- The CLI configuration is minimal:

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

## Human Interaction Demo

<video controls style="max-width: 100%; max-height: 100%; object-fit: contain;">
  <source src="/videos/application.mp4" type="video/mp4">
</video>
