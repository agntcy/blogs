# Presentation Speech — SLIM Multicluster Demo

---

## Slide 1 — Cover: Cluster Customer Remediation Use Case with SLIM

Today I want to show you how SLIM — the Secure Low-latency Interactive
Messaging— can be applied to the Cluster Customer Remediation Use
Case.

---

## Slide 2 — Use Case

This diagram shows a typical setup. On the right, you have a public cloud
cluster with multiple services — A, B, and C — all sitting behind a public
ingress. On the left, you have a private datacenter with services that need to
be accessed by the cloud. This is usually complex to achieve because the
private datacenter is not exposed on the internet, and to connect to it
something like a reverse proxy needs to be deployed on the customer side.

There are three fundamental problems with this approach. First, every service
that needs to be reachable requires its own dedicated public endpoint — this is
operationally expensive and increases the attack surface. Second, the reverse
proxy is hard to configure and maintain, and it needs to be deployed in the
customer's environment, which they may not want to do. And third, all data
flows in the clear through these middle boxes — any compromised hop can read
the traffic.

---

## Slide 3 — Use Case: How SLIM Solves the Problem

Now let's look at the same architecture with SLIM. The public ingress is still
there, but instead of connecting directly to individual services, it connects
to a SLIM Node. In the private datacenter, another SLIM Node sits in front of
the local services, and it connects to the public cloud endpoint using a
standard gRPC connection over TLS. Because gRPC is a bidirectional protocol,
data can flow in both directions once the private datacenter initiates the
connection.

This gives us three important properties. First, a single SLIM endpoint in the
cloud exposes all services — no per-service ingress needed. Second, once the
private cluster establishes the gRPC connection, data can flow in both
directions without any complex configuration on the customer side. And third,
in addition to standard TLS, SLIM uses MLS — the Messaging Layer Security
protocol — to provide end-to-end encryption. The data is encrypted by the
sender and can only be decrypted by the intended recipient, even if
intermediate SLIM nodes are compromised.

---

## Slide 4 — Comparison with Existing Solutions

SLIM brings unique advantages that existing approaches cannot match, as we can
see in this table. Plain HTTP or gRPC have no end-to-end encryption and require
services to be directly exposed on the internet. VPNs provide some level of
network isolation but have no per-service granularity, no end-to-end encryption
of the payload, and are notoriously hard to manage across organizations. Reverse
proxies require complex configuration and don't solve the cross-organization
trust problem. SLIM is designed specifically to address all of these gaps
simultaneously.

---

## Slide 5 — What is SLIM

SLIM — Secure Low-latency Interactive Messaging — is a communication framework
designed to provide a secure transport layer for services that need to talk
across network boundaries. It is built on gRPC and HTTP/2, which makes it easy
to traverse NATs and firewalls. It provides end-to-end encryption through MLS
on top of standard TLS, and it supports flexible communication patterns:
point-to-point, group channels, and RPC. Services simply register with SLIM and
become reachable without exposing any server ports directly. It supports
multiple languages, with a core written in Rust and bindings for Python, Go,
C#, and others. And it is protocol-agnostic — it can carry A2A, MCP,
OpenTelemetry, or any custom protocol on top. We will go deeper into each of
these aspects in the following slides.

---

## Slide 6 — SLIM Architecture

SLIM is composed of three main components: the SLIM SDK, the Data Plane, and
the Controller. The **SLIM SDK** is what you embed in your application. As we
saw in the previous slide, it comes with bindings for multiple languages and is
responsible for reliable message delivery and end-to-end encryption. The
**Data Plane** handles message forwarding. It can run either embedded inside
the application alongside the SDK, or as a standalone SLIM Node. Connections
between Data Plane instances are carried over gRPC. Finally, the **Controller**
is the orchestrator of all SLIM Nodes: it manages configuration and route
distribution across the network.

---

## Slide 7 — Zero Trust Data Security

One of the most important aspects of SLIM is security, which operates at two
levels: network security and data security. As you can see in this diagram, all
communication between SLIM Nodes is encrypted using standard TLS. But SLIM goes
further: on top of TLS, it adds end-to-end encryption using MLS — the Messaging
Layer Security protocol, standardized in RFC 9420. Thanks to MLS, messages can
traverse middle boxes and untrusted networks — including nodes operated by third
parties — and nobody along the path can read the content. Only the intended
recipient can decrypt it.

---

## Slide 8 — Communication Patterns — P2P, Group and RPCs

SLIM is not just a point-to-point messaging system like HTTP or gRPC. It
natively supports four interaction patterns. **Point-to-Point** is the basic
pattern where two services communicate directly by name. **Group**
messaging lets multiple services subscribe to a shared channel and receive all
messages sent to it. **RPC Point-to-Point** is a request-response pattern
between a specific client and server. And **RPC Multicast** allows a client to
send a request to a channel and receive responses from multiple servers.

In SLIM, services are identified using a hierarchical naming scheme based on
Decentralized Identifiers, or DIDs. The name is formed by four components:

- the **organization** — the entity deploying the service;
- the **namespace** — used for scoping, for example to indicate the region
  where a service is deployed or the name of a cluster;
- the **service name** — identifying the service itself;
- the **hash of the public key** presented by the service. This gives each
  instance a unique identity even when replicated, and it cryptographically
  binds the name to the service — you cannot impersonate a service without
  its private key.

Group names in SLIM follow a similar structure.

---

## Slide 9 — Cover: SLIM Multicluster Demo

Let's move on to the demo we prepared to showcase the advantages SLIM brings.

---

## Slide 10 — SLIM Multicluster Demo — Functional Topology

This slide shows the functional topology of our demo. On the left we have two
components belonging to the customer: a **Customer Cluster** running
on-premises, with a Kubernetes MCP Server and an Atlassian MCP Server both
connected to a local SLIM Node; and an **IT Ops Laptop** running Copilot,
extended with an agent skill that embeds the A2A CLI — which is what makes
Copilot act as an A2A client. On the right is the **Cloud Cluster**, which
hosts four components: a **SLIM Node** for message routing; a **SLIM
Controller** that coordinates all SLIM Nodes and handles the onboarding of new
clusters; a **Kubernetes Troubleshooting Agent**, an A2A server that receives
status-check requests and embeds an MCP client to query the MCP servers on the
customer side; and a **Health Check Job** that periodically asks the Kubernetes
Agent for the cluster status and, if a problem is found, instructs it to create
a Jira issue. Solid lines represent data flows, dashed lines represent control
flows to the Controller.

---

## Slide 11 — SLIM Multicluster Demo — Full Deployment

This diagram shows the full production deployment. The key addition here is
**SPIRE**: each cluster has a SPIRE Agent that handles workload identity and is
responsible for generating the JWT tokens used for authentication. The black
links represent data connections over gRPC, while the purple links show SPIRE
authentication flows for token provisioning.

---

## Slide 12 — How to Configure Service Names

Every service in SLIM is identified by a name following the pattern
`organization/namespace/service/hash-of-did-key`, as we saw earlier. In our
demo we use the naming conventions shown in the table. For Splunk-owned
services running in the cloud, we use `splunk/<region>/<service-name>` — for
example, the Kubernetes troubleshooting agent is
`splunk/eu-central-1/k8s_troubleshooting_agent`. For customer services running
on the customer cluster, we use `<customer-id>/<cluster-id>/<service-name>`,
for example `customer-1/on-prem-cluster/k8s-mcp-proxy`. This convention lets
us identify different customers and also whether they have multiple clusters
registered to the platform. And for off-cluster clients — like the application
running on the IT Ops laptop — we use `<customer-id>/off-cluster/<service-name>`.

---

## Slide 13 — Customer Zero-Touch On-Boarding

One of the design goals of this system is that onboarding a new customer should
require as little operational work as possible. The customer only needs two
things: an authentication token and the public address of the SLIM Controller.
That's it. Once installed, the SLIM Node on the customer cluster connects
outbound to the controller, registers itself, and receives the routing
configuration automatically. No manual route setup, no VPN configuration, no
firewall rules on the customer side.

The configuration snippet here shows what the customer's SLIM config looks like
— it points to the controller endpoint and configures SPIRE-based JWT
authentication. Once running, the node self-registers and the controller
distributes the required routes.

---

## Slide 14 — Customer On-Boarding Demo

In this video we walk through a full customer onboarding. On this screen you
see all the pods running on the cloud cluster: the SLIM Node, the SLIM
Controller, and the k8s Troubleshooting Agent. Using the controller CLI we can
inspect the connected nodes: at this point only one node is registered, the one
running in the AWS cluster. We can also see its local address, the external
endpoint that clients outside the cluster use to reach it, and confirm that
mTLS is not required for this connection.

Next we look at the links list, which is empty at this stage because no
customer cluster has connected yet. And we check the routes: there are several
entries, all with an empty source, meaning they are local routes — services
connected to the local SLIM Node. The naming follows the convention we saw
earlier: organization `splunk`, namespace `eu-central-1`, and service names
such as `kubernetes_troubleshooting_agent`. The other entries are the A2A RPC
method names exposed by that agent. All these routes have no link ID because
they are local.

We now switch to Argo CD to show the onboarding of the customer cluster. The
ConfigMap that needs to be installed on the customer side is minimal: just the
external endpoint of the SLIM Controller and a JWT token — provided by SPIRE —
plus a few additional keepalive fields required by our specific setup. We
trigger a manual sync to demonstrate the installation, and a new pod appears:
the customer SLIM Node is now up and running, as confirmed by the logs.

Going back to the controller, we list the nodes again. Now we see two nodes
registered: the original AWS node and a new one, running in the GLS cluster —
the customer cluster we just onboarded. In the links view, a new link has
appeared: the source is the GLS cluster connecting outbound to the AWS cloud
cluster. The link has a unique link ID, and the destination endpoint is the
SLIM Node running in the cloud.

Finally, the routes table now contains many more entries. In addition to the
existing local routes on the AWS side, we now see local routes on the GLS side:
`customer/on-prem-cluster/k8s-mcp-proxy` and
`customer/on-prem-cluster/atlassian-mcp-proxy` — corresponding to the two MCP
servers running on the customer cluster, one for Kubernetes and one for
Atlassian/Jira. We can also see cross-cluster routes: routes from AWS to GLS
for the customer-side services, and routes from GLS to AWS for the cloud-side
services such as the Kubernetes troubleshooting agent. All cross-cluster routes
share the same link ID, because there is a single bidirectional connection
between the two clusters and all traffic flows over it.

---

## Slide 15 — Human Interaction

Using SLIM connectivity, humans can also interact with the system at any time.
Authentication is handled via JWT tokens, as for cluster onboarding, and SPIRE
is used as the token provider. The application only needs to know the address
of the SLIM endpoint, its own local service name, and the path to the SPIRE
socket for token acquisition. Everything else — routing, encryption, delivery
— is handled transparently by SLIM.

---

## Slide 16 — Human Interaction — Sequence Diagram

This diagram shows what happens during the demo I will show you in a moment. We
integrated an A2A CLI into Copilot as an agent skill, making Copilot capable of
sending requests using A2A over SLIM.

In this example, the IT operator asks Copilot "Can you show me the list of pods
running on my cluster?". Copilot, running on the laptop, invokes the A2A CLI
skill and sends an A2A request over SLIM to the cloud cluster, where the
Kubernetes Agent receives it. The agent then uses MCP to query the customer's
Kubernetes cluster: it sends an MCP request over SLIM, which is routed through
the on-prem SLIM Node, through the MCP Proxy, and finally to the k8s MCP
Server. The response comes back through the same path. The agent collects the
results, composes the A2A reply, and Copilot presents the cluster status to the
operator.

---

## Slide 17 — Automated Health Check — Sequence Diagram

During the demo we will deploy a pod on the customer cluster that fails to
start because it cannot pull its image and gets stuck in `ImagePullBackOff`. In
the cloud cluster, a Health Check Job runs periodically, sending an A2A request
to the k8s Agent asking for the cluster status and instructing it to open a
Jira issue if a problem is found. The agent queries the cluster via MCP, just
as in the previous diagram.

This time, since a failure is reported back, the agent acts on it. It sends a
second MCP call over SLIM, routed to the Atlassian MCP Server on the customer
cluster. The MCP Proxy forwards the request to the Atlassian server, which
creates the issue in the customer's Jira instance. The confirmation flows back,
and the Health Check Job receives the final A2A response indicating that the
issue has been filed.

---

## Slide 18 — Human Interaction Demo

In this video we see the two scenarios I just described in the previous
diagrams. The screen shows the Copilot UI, the pods running on the GLS cluster
— the customer cluster — and the Jira board with the existing issues.

First, the IT Ops engineer asks Copilot for the list of pods running in the
`slim-multicluster-demo` namespace, explicitly requesting that it use the A2A
CLI skill. This is the agent skill we built: it sends A2A requests over SLIM,
so you can call any SLIM-connected agent directly from Copilot. The request is
forwarded to the Kubernetes Troubleshooting Agent and the reply comes back
shortly with the list of pods currently running on the cluster.

At this point we start the faulty pod — the one that cannot pull its image —
and we can see it appear in the k9s console in the `ImagePullBackOff` state.

Now we focus on the Jira board. The latest issue at this point is number 1574.
We wait for the Health Check Job running in the AWS cluster to fire. It sends a
periodic A2A request to the Kubernetes Agent to check for problems on the
customer side and, if any are found, to open a Jira issue automatically. Issue
1575 now appears — reporting the problem with the pod that cannot pull its
image.

With the issue created, the IT Ops engineer goes back to Copilot and asks for
the root cause of the problem. The request is sent again via A2A to the
Kubernetes Troubleshooting Agent, which investigates and replies that the image
does not exist — meaning the image name or tag in the pod spec needs to be
corrected.
