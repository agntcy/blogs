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

# Cluster Customer Remediation Use Case with SLIM

---

## Use case

<div style="display:flex; justify-content:center; margin-top:15px; transform:scale(2.2); transform-origin:top center">

```mermaid
%%{init: {'flowchart': {'nodeSpacing': 15, 'rankSpacing': 30, 'padding': 3}}}%%
graph LR
    subgraph PRV["Private Datacenter"]
        S4[Svc A] <--> RP[Reverse Proxy]
    end
    subgraph PUB["Public Cloud"]
        IG[Public Ingress]
        IG <--> S1[Svc A]
        IG <--> S2[Svc B]
        IG <--> S3[Svc C]
    end
    C((Client)) --> IG
    RP <--> IG
    style IG fill:#C62828,color:#fff
    style RP fill:#E65100,color:#fff
    style PUB fill:#F5F6FA,stroke:#9E9E9E,color:#333
    style PRV fill:#F5F6FA,stroke:#9E9E9E,color:#333
    style S1 fill:#2E7D32,color:#fff
    style S2 fill:#2E7D32,color:#fff
    style S3 fill:#2E7D32,color:#fff
    style S4 fill:#2E7D32,color:#fff
```

</div>

<div style="margin-top:150px; font-size:14px; line-height:2; text-align:center">

✗ Every service needs a **dedicated public endpoint**

✗ **Custom reverse proxy** to access the cluster

✗ Data flows **in the clear** through middle boxes 

TODO: add comment on the out/in bound connection

</div>

---

## Use Case: How SLIM solves the problem

<div style="display:flex; justify-content:center; margin-top:15px; transform:scale(2.2); transform-origin:top center">

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
    style IG fill:#C62828,color:#fff
    style SN1 fill:#1565C0,color:#fff
    style SN2 fill:#1565C0,color:#fff
    style S1 fill:#2E7D32,color:#fff
    style S2 fill:#2E7D32,color:#fff
    style S3 fill:#2E7D32,color:#fff
    style S4 fill:#2E7D32,color:#fff
    style S5 fill:#2E7D32,color:#fff
    style PUB fill:#F5F6FA,stroke:#9E9E9E,color:#333
    style PRV fill:#F5F6FA,stroke:#9E9E9E,color:#333
```

</div>

<div style="margin-top:150px; font-size:14px; line-height:2; text-align:center">

✓ **Single SLIM endpoint** exposes all services — no per-service ingress

✓ Private SLIM nodes connect **outbound** — no inbound firewall exposure

✓ **E2E encryption** via MLS — data stays encrypted through all intermediate nodes **+TLS + GRPC**

</div>

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

## What is SLIM

...

---

## SLIM Architecture

<div style="font-size: 11px;">

| **Layer** | **Primary Function** | **Key Responsibilities** |
|---|---|---|
| Data Plane | Message Routing | Message forwarding, Connection management, gRPC over HTTP/2 |
| SLIM SDK | Secure Messaging | Reliable delivery, E2E encryption |
| Controller| Network Orchestration | Node configuration, Route management |

</div>

TODO: Remove the table, add text to the diagram for Key Responsibilities

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

TODO: Remove the table and do as before

| **Network Security (TLS)** | **Data Security (E2Ee / MLS)** |
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
    style A1 fill:#50C878,color:#fff
    style A2 fill:#50C878,color:#fff
```

MLS: https://www.rfc-editor.org/rfc/rfc9420.txt -> remove rfc

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

TODO: center 

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '10px'}, 'flowchart': {'nodeSpacing': 12, 'rankSpacing': 30, 'padding': 10}}}%%
graph LR
    subgraph Left[" "]
        direction TB
        subgraph Customer[Customer Cluster]
            direction LR
            AMCP[Atlassian MCP Server] --> CSN[SLIM Node]
            KMCP[k8s MCP Server] --> CSN
        end
        subgraph Laptop[IT Ops Laptop]
            Copilot[Copilot - A2A client]
        end
    end

    subgraph Cloud[Cloud Cluster]
        direction LR
        SN[SLIM Node]
        SC[Controller]
        HCJ[Health Check Job - A2A client]
        K8S[k8s TB Agent + MCP client SLIM channel 1/ SLIM channel 2 + A2A server]
        SN -. "gRPC" .-> SC
        SN ---|SLIM| K8S
        K8S ---|SLIM| HCJ
    end

    Copilot -- "SLIM" --> SN
    CSN <-- "gRPC" --> SN
    CSN -. "gRPC" .-> SC

    style Left fill:none,stroke:none
    style Customer fill:#e0e0e0,stroke:#999,color:#333
    style Cloud fill:#e0e0e0,stroke:#999,color:#333
    style Laptop fill:#e0e0e0,stroke:#999,color:#333
    style SC fill:#555,color:#fff
    style SN fill:#4A90E2,color:#fff
    style CSN fill:#4A90E2,color:#fff
    style AMCP fill:#50C878,color:#fff
    style KMCP fill:#50C878,color:#fff
    style K8S fill:#50C878,color:#fff
    style HCJ fill:#50C878,color:#fff
    style Copilot fill:#50C878,color:#fff
```
TODO: Control channel / Data channel
---

## SLIM Multicluster Demo — Full Deployment

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '11px'}, 'flowchart': {'nodeSpacing': 6, 'rankSpacing': 18, 'padding': 4}}}%%
graph LR
    subgraph Left[" "]
        direction TB
        subgraph Customer[Customer Cluster]
            direction LR
            subgraph CustServices[Services]
                direction LR
                AMCP[Atlassian MCP] --- MP1[MCP Proxy]
                KMCP[K8s MCP] --- MP1
            end
            subgraph CustSLIM[SLIM]
                direction LR
                CSN[Slim Node]
            end
            NP[Network Proxy]
            CSN --- NP
            subgraph CustIdentity[Identity]
                CSA[Spire Agent]
            end
            MP1 --- CSN
            CSA -.- CSN
            CSA -.- NP
        end
        subgraph Laptop[IT Ops Laptop]
            direction LR
            Copilot[Copilot]
            LSA[Spire Agent]
            Copilot -.- LSA
        end
    end

    subgraph Cloud[Cloud Cluster]
        direction TB
        Ingress[nginx Ingress]
        subgraph CloudSLIM[SLIM]
            direction LR
            SC[Slim Controller] --- SN[Slim Node]
        end
        subgraph CloudServices[Services]
            direction LR
            HCJ[Health Check job] --- K8S[k8s Agent]
        end
        subgraph CloudIdentity[Identity]
            direction LR
            SS[Spire Server] --- SA[Spire Agent]
        end
        Ingress --- SC
        Ingress --- SN
        Ingress --- SS
        K8S --- SN
        SA -.- SC
        SA -.- SN
        SA -.- K8S
        SA -.- HCJ
    end

    NP --> Ingress
    Copilot --- Ingress
    LSA -.- Ingress

    classDef service fill:#2E7D32,color:#fff,padding:4px 8px
    classDef slim fill:#1565C0,color:#fff,padding:4px 8px
    classDef identity fill:#6A1B9A,color:#fff,padding:4px 8px
    classDef proxy fill:#E65100,color:#fff,padding:4px 8px
    classDef ingress fill:#C62828,color:#fff,padding:4px 8px
    classDef ctrl fill:#37474F,color:#fff,padding:4px 8px

    class AMCP,KMCP,MP1,K8S,HCJ,Copilot service
    class CSN,SN slim
    class CSA,LSA,SA,SS identity
    class NP proxy
    class Ingress ingress
    class SC ctrl

    style Left fill:none,stroke:none
    style Customer fill:#F5F6FA,stroke:#9E9E9E,color:#333
    style Cloud fill:#F5F6FA,stroke:#9E9E9E,color:#333
    style Laptop fill:#F5F6FA,stroke:#9E9E9E,color:#333
    style CustServices fill:none,stroke:#ccc,stroke-dasharray: 3 3
    style CustSLIM fill:none,stroke:#ccc,stroke-dasharray: 3 3
    style CustIdentity fill:none,stroke:#ccc,stroke-dasharray: 3 3
    style CloudSLIM fill:none,stroke:#ccc,stroke-dasharray: 3 3
    style CloudServices fill:none,stroke:#ccc,stroke-dasharray: 3 3
    style CloudIdentity fill:none,stroke:#ccc,stroke-dasharray: 3 3
```

<div style="position:absolute; bottom:10px; left:16px; display:flex; gap:14px; font-size:10px; align-items:center; background:rgba(255,255,255,0.85); padding:5px 10px; border-radius:4px; border:1px solid #ddd">
  <span><span style="display:inline-block;width:11px;height:11px;background:#1565C0;border-radius:2px;margin-right:4px;vertical-align:middle"></span>SLIM Node</span>
  <span><span style="display:inline-block;width:11px;height:11px;background:#37474F;border-radius:2px;margin-right:4px;vertical-align:middle"></span>Controller</span>
  <span><span style="display:inline-block;width:11px;height:11px;background:#2E7D32;border-radius:2px;margin-right:4px;vertical-align:middle"></span>Service / Agent</span>
  <span><span style="display:inline-block;width:11px;height:11px;background:#E65100;border-radius:2px;margin-right:4px;vertical-align:middle"></span>Network Proxy</span>
  <span><span style="display:inline-block;width:11px;height:11px;background:#C62828;border-radius:2px;margin-right:4px;vertical-align:middle"></span>Ingress</span>
  <span><span style="display:inline-block;width:11px;height:11px;background:#6A1B9A;border-radius:2px;margin-right:4px;vertical-align:middle"></span>Identity (SPIRE)</span>
  <span style="color:#555; border-left:1px solid #ccc; padding-left:10px">─── data &nbsp; ╌╌╌ identity</span>
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
- An authentication token
- The public address of the controller

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

Node List: New SLIM node registered

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

- Humans can interact with the system at all times
- Authentication is handled via JWT tokens (using SPIRE in this particular case)
- The application need to know the address of the SLIM endpoint

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

## Human Interaction Demo Flow Chart

---

## Human Interaction Demo

<video controls style="max-width: 100%; max-height: 100%; object-fit: contain;">
  <source src="/videos/application.mp4" type="video/mp4">
</video>
