---
marp: true
theme: default
paginate: true
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

- No need to expose services one by one
- gRPC based streaming communication for cross network boundaries
- e2e encryption
- 

---

## Introducing SLIM

see slides 35/36/37 of agntcy-intro

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

## Customer On-Boarding

- screen shot with routes and upfront description of the demo 

---

## Video

---

## Human in the Loop

- show the a2acli.yaml file

---

## Video