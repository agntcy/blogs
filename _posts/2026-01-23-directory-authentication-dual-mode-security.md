---
layout: post
title: "Directory v1.0.0: Dual-Mode Authentication for Secure Agent Discovery"
date: 2026-01-23 09:00:00 +0000
author: Tibor Kircsi
author_url: https://github.com/tkircsi
categories: [security, authentication, directory]
tags: [spiffe, oauth, github, envoy, mTLS, zero-trust]
mermaid: true
---

The **Agent Directory** is more than just a service registry—it's a **trusted gateway** for discovering and verifying AI agents. With the release of **v1.0.0**, we're introducing a robust dual-mode authentication system that combines the security of **SPIFFE workload identity** with the convenience of **GitHub OAuth** for human operators.

This post explores the architecture, implementation, and practical usage of Directory's new authentication system, designed for both automated workloads and interactive CLI users.

<!--more-->

## The Challenge: Two Types of Users

When building the Agent Directory, we encountered a fundamental question: **Who should be allowed to access the system?**

The answer wasn't simple. We had two distinct user personas:

1. **Automated Workloads** (services, agents, applications)
   - Need machine-to-machine authentication
   - Run continuously without human intervention
   - Must establish identity within Kubernetes clusters
   - Require automatic certificate rotation

2. **Human Operators** (developers, administrators)
   - Need interactive authentication
   - Access the system via CLI tools
   - Don't have direct cluster access
   - Want familiar OAuth flows

Traditional authentication systems force you to choose one approach. We built a system that supports both.

## The Solution: Dual-Mode Authentication

Directory v1.0.0 introduces a **dual-mode authentication architecture** that seamlessly handles both workload and human authentication:

```mermaid
flowchart TD
    classDef workload fill:#0251af,stroke:#f3f6fd,stroke-width:2px,color:#f3f6fd;
    classDef human fill:#03142b,stroke:#0251af,stroke-width:2px,color:#f3f6fd;
    classDef gateway fill:#0251af,stroke:#f3f6fd,stroke-width:3px,color:#f3f6fd;
    classDef api fill:#03142b,stroke:#0251af,stroke-width:2px,color:#f3f6fd;

    subgraph "Workload Authentication"
        W[Agent/Service<br/>Kubernetes Pod]:::workload
        SPIRE[SPIRE Agent<br/>Workload Identity]:::workload
    end

    subgraph "Human Authentication"
        H[Developer<br/>dirctl CLI]:::human
        GH[GitHub OAuth<br/>Device Flow]:::human
    end

    subgraph "Authentication Gateway"
        Envoy[Envoy Proxy<br/>ext_authz + RBAC]:::gateway
    end

    subgraph "Directory API"
        API[Directory Service<br/>Business Logic]:::api
    end

    W -->|mTLS + SPIFFE ID| SPIRE
    SPIRE -->|Authenticated| API

    H -->|OAuth Token| GH
    GH -->|Validated| Envoy
    Envoy -->|Authorized<br/>via SPIFFE| API

    API -.->|Only accepts<br/>SPIFFE IDs| SPIRE
```

**Key Insight:** The Directory API itself has **zero authentication code**. It only validates SPIFFE IDs, trusting that callers have already been authenticated upstream.

## Architecture: Two Paths, One Destination

Let's dive deeper into how each authentication mode works.

### Path 1: SPIFFE Authentication (Workloads)

**SPIFFE** (Secure Production Identity Framework For Everyone) provides workload identity through **mTLS certificates**. This is ideal for service-to-service communication within Kubernetes.

```mermaid
sequenceDiagram
    participant Service as Agent/Service
    participant Agent as SPIRE Agent
    participant API as Directory API

    Note over Service,Agent: Startup Phase
    Service->>Agent: Request SPIFFE Certificate
    Agent->>Agent: Verify Pod Identity<br/>(ServiceAccount, Labels, etc.)
    Agent->>Service: Issue X.509-SVID Certificate<br/>(spiffe://prod.ads.outshift.io/my-agent)

    Note over Service,API: API Call Phase
    Service->>API: gRPC Call + mTLS Certificate
    API->>API: Validate SPIFFE ID
    alt Authorized Workload
        API->>Service: 200 OK + Data
    else Unauthorized
        API->>Service: 403 Forbidden
    end
```

**How it works:**

1. **Workload Registration**: Services are registered in SPIRE with their intended SPIFFE ID
2. **Certificate Issuance**: SPIRE Agent validates the workload and issues a short-lived X.509 certificate
3. **mTLS Communication**: The service uses this certificate for mutual TLS with the Directory API
4. **Automatic Rotation**: Certificates rotate automatically (typically every 1 hour)

**Security Benefits:**
- ✅ **No secrets to manage** - No passwords, API keys, or tokens
- ✅ **Automatic expiration** - Certificates rotate without human intervention
- ✅ **Strong identity binding** - Identity tied to Kubernetes resources
- ✅ **Zero-trust security** - Every call is cryptographically authenticated

### Path 2: GitHub OAuth (Human Operators)

For human operators using the `dirctl` CLI, we use **GitHub OAuth 2.0 Device Flow**. This provides a familiar authentication experience without requiring a local web server.

```mermaid
sequenceDiagram
    participant User as Developer
    participant CLI as dirctl CLI
    participant GitHub as GitHub OAuth
    participant Envoy as Envoy Gateway
    participant API as Directory API

    Note over User,GitHub: Authentication Phase
    User->>CLI: dirctl auth login
    CLI->>GitHub: Request Device Code
    GitHub->>CLI: Device Code + URL
    CLI->>User: Display: Visit URL<br/>Enter Code: ABC-123

    User->>GitHub: Opens Browser<br/>Enters Device Code
    GitHub->>User: Authorize dirctl?
    User->>GitHub: Yes, Authorize

    CLI->>GitHub: Poll for Token
    GitHub->>CLI: Access Token

    Note over User,API: API Call Phase
    User->>CLI: dirctl routing list
    CLI->>Envoy: gRPC Call + Bearer Token
    Envoy->>Envoy: Validate Token<br/>Check RBAC Rules
    Envoy->>API: Forward Request<br/>(as Envoy's SPIFFE ID)
    API->>Envoy: Response
    Envoy->>CLI: Response
    CLI->>User: Display Results
```

**How it works:**

1. **Device Flow Initiation**: CLI requests a device code from GitHub
2. **User Authorization**: User visits GitHub and authorizes the application
3. **Token Issuance**: CLI receives an OAuth access token
4. **Envoy Gateway**: Token is sent to Envoy, which validates it and enforces RBAC
5. **SPIFFE Impersonation**: Envoy calls the API using its own SPIFFE ID

**Key Advantage:** The Directory API **never sees user tokens** - it only sees Envoy's trusted SPIFFE ID.

## The Envoy Gateway: Policy Enforcement Point

The Envoy gateway is the **linchpin** of the human authentication flow. It handles:

1. **Token Validation** - Verifies GitHub OAuth tokens
2. **Authorization** - Enforces role-based access control (RBAC)
3. **Protocol Translation** - Converts OAuth → SPIFFE

```mermaid
flowchart LR
    classDef input fill:#0251af,stroke:#f3f6fd,stroke-width:2px,color:#f3f6fd;
    classDef process fill:#03142b,stroke:#0251af,stroke-width:2px,color:#f3f6fd;
    classDef output fill:#0251af,stroke:#f3f6fd,stroke-width:2px,color:#f3f6fd;

    User[User Request<br/>Bearer: gho_xxx]:::input
    
    subgraph Envoy["Envoy Gateway"]
        ExtAuthz[ext_authz Filter<br/>Validate Token]:::process
        RBAC[RBAC Filter<br/>Check Permissions]:::process
        Router[Router<br/>Forward Request]:::process
    end
    
    API[Directory API<br/>Accepts: SPIFFE ID]:::output
    
    User --> ExtAuthz
    ExtAuthz -->|Valid User| RBAC
    RBAC -->|Authorized| Router
    Router -->|mTLS + Envoy SPIFFE ID| API
    
    ExtAuthz -.->|Invalid Token| Reject[401 Unauthorized]
    RBAC -.->|Forbidden| Reject2[403 Forbidden]
```

**Envoy Configuration Highlights:**

- **Custom ext_authz Service**: Validates GitHub tokens and extracts user identity
- **RBAC Rules**: Configurable allow/deny lists based on GitHub username and organization membership
- **SPIFFE Integration**: Uses its own workload identity to call the Directory API

## 🚀 Hands-On: Using Directory Authentication

Let's walk through both authentication methods with practical examples.

### Prerequisites

1. **CLI Tool**: `dirctl` installed ([Installation Guide](https://github.com/agntcy/dir#installation))
2. **Authorization**: Your GitHub username or organization must be in the production environment's allowed list
   - Contact your Directory administrator if you don't have access
   - See the [Authorization section](#authorization-who-can-access-what) for details on allow lists

### Option A: GitHub Authentication (Recommended for CLI Users)

Perfect for developers who want quick, interactive access without cluster credentials.

**Step 1: Configure Environment**

```bash
export DIRECTORY_CLIENT_SERVER_ADDRESS="prod.gateway.ads.outshift.io:443"
export DIRECTORY_CLIENT_AUTH_MODE="github"
```

**Step 2: Authenticate with GitHub**

```bash
dirctl auth login
```

You'll see:

```text
╔════════════════════════════════════════════════════════════╗
║          GitHub OAuth Authentication (Device Flow)        ║
╚════════════════════════════════════════════════════════════╝

🔐 To authenticate, please follow these steps:

  1. Visit: https://github.com/login/device
  2. Enter code: AEC4-D40B

💡 You can complete this on any device (phone, laptop, etc.)
⏱️  Code expires in 15 minutes

Waiting for authorization...
```

Open your browser, visit the URL, and enter the code. After authorizing, you'll see:

```text
✓ Authorization complete!

Fetching user information...
✓ Authenticated as: yourusername (Your Name)
Fetching organization memberships...
✓ Organizations: your-org, another-org
✓ Token cached for future use
  Cache location: ~/.config/dirctl/auth-token.json

╔════════════════════════════════════════════════════════════╗
║              Authentication Complete! ✓                    ║
╚════════════════════════════════════════════════════════════╝

You can now use 'dirctl' commands with --auth-mode=github
```

**Step 3: Use the CLI**

```bash
# List records
dirctl list

# Pull a specific record
dirctl pull baeareiesad3lyuacjirp6gxudrzheltwbodtsg7ieqpox36w5j637rchwq -o json

# Check authentication status
dirctl auth status
```

**Token Caching:** Your OAuth token is securely cached at `~/.config/dirctl/auth-token.json`. Subsequent commands automatically use the cached token until it expires (default: 8 hours).

**Step 4: Check Authorization Logs (Optional)**

To verify your requests are being authorized:

```bash
kubectl logs -n dir-prod-dir -l app=envoy-authz-authz --tail=50 | grep yourusername
```

### Option B: SPIFFE Authentication (For Workloads)

Ideal for services running within the Kubernetes cluster that need programmatic access. This method works best in environments where the **SPIRE Agent** is deployed as a DaemonSet, allowing workloads to automatically obtain their identity certificates via the Workload API.

However, if you're working from outside the cluster (e.g., your laptop, a CI/CD runner without SPIRE Agent), or need to debug/test SPIFFE authentication, you can manually export a SPIFFE certificate from the SPIRE server.

**Step 1: Mint SPIFFE Certificate (Manual Export)**

When SPIRE Agent is not available on your machine, you can manually mint a SPIFFE certificate from the SPIRE server:

```bash
kubectl exec -n dir-prod-spire spire-dir-prod-argoapp-server-0 \
  -c spire-server -- \
  /opt/spire/bin/spire-server x509 mint \
  -dns prod.api.ads.outshift.io \
  -spiffeID spiffe://prod.ads.outshift.io/demo-client \
  -ttl 1h \
  -output json > spiffe-prod.json
```

**Step 2: Configure Environment**

```bash
export DIRECTORY_CLIENT_SERVER_ADDRESS="prod.api.ads.outshift.io:443"
export DIRECTORY_CLIENT_AUTH_MODE="token"
export DIRECTORY_CLIENT_SPIFFE_TOKEN="spiffe-prod.json"
```

**Step 3: Use the CLI**

```bash
dirctl list
dirctl pull <cid> -o json
```

**Step 4: For Production Workloads (Recommended)**

The manual certificate export approach above is useful for testing and debugging, but **production workloads should use the SPIRE Workload API** to automatically obtain and rotate certificates. This requires the SPIRE Agent to be running on the same node as your workload (typically deployed as a Kubernetes DaemonSet).

With SPIRE Agent available, your services automatically get certificates without any manual steps:

```go
import (
    "github.com/spiffe/go-spiffe/v2/workloadapi"
    "github.com/agntcy/dir/client"
)

// Create SPIFFE X.509 source
source, err := workloadapi.NewX509Source(ctx)
if err != nil {
    log.Fatal(err)
}
defer source.Close()

// Create Directory client with SPIFFE authentication
dirClient, err := client.New(
    client.WithAddress("prod.api.ads.outshift.io:443"),
    client.WithSPIFFEAuth(source),
)
if err != nil {
    log.Fatal(err)
}

// Use the client
records, err := dirClient.List(ctx)
```

**Key Benefits of SPIRE Agent Integration:**
- ✅ **Zero manual steps** - Certificates are obtained automatically via the Workload API
- ✅ **Automatic rotation** - Certificates renew before expiration without restarts
- ✅ **No exported files** - No need to manage `spiffe-prod.json` files
- ✅ **Production-ready** - The recommended approach for all Kubernetes workloads
- ✅ **Just works** - Service discovers the SPIRE Agent via the standard Unix domain socket (`/run/spire/sockets/agent.sock`)

**Manual Export Use Cases:**
- 🧪 Testing/debugging from your laptop (outside the cluster)
- 🔬 CI/CD runners without SPIRE Agent deployed
- 📊 One-time administrative tasks
- 🛠️ Development environments without full SPIRE infrastructure

## Authorization: Who Can Access What?

Authentication proves **who you are**. Authorization determines **what you can do**.

### GitHub OAuth: User and Organization Allow Lists

The Envoy gateway enforces authorization rules configured in the Helm chart:

```yaml
# Helm values for Envoy gateway
authServer:
  authorization:
    # Allow users from specific GitHub organizations
    allowedOrgConstructs:
      - "agntcy"
      - "spiffe"
    
    # Explicitly allow specific users
    userAllowList:
      - "github:alexdemo2026"
      - "github:saradev2026"
      - "github:mikeprod2026"
    
    # Explicitly deny specific users (takes precedence)
    userDenyList:
      - "github:malicious-user"
```

**Authorization Logic:**
1. Check deny list (immediate rejection)
2. Check allow list (immediate approval)
3. Check organization membership (approval if in allowed org)
4. Deny by default

### SPIFFE: Workload Identity Allow Lists

The Directory API maintains an allow list of trusted SPIFFE IDs:

```go
// Directory API configuration
authorizedIDs := []spiffeid.ID{
    spiffeid.RequireFromString("spiffe://prod.ads.outshift.io/envoy"),
    spiffeid.RequireFromString("spiffe://prod.ads.outshift.io/agent-service"),
    spiffeid.RequireFromString("spiffe://prod.ads.outshift.io/indexer"),
}
```

**Why This Matters:**
- ✅ **Least Privilege** - Only explicitly authorized workloads can access the API
- ✅ **Defense in Depth** - Even if an attacker compromises a pod, they can't access the Directory without the correct SPIFFE ID
- ✅ **Audit Trail** - Every request is logged with the authenticated SPIFFE ID

## Security Considerations

### Token Security

**GitHub OAuth Tokens:**
- Tokens are stored with **0600 permissions** (owner read/write only)
- Tokens expire after **8 hours** (configurable)
- Token cache location: `~/.config/dirctl/auth-token.json`
- **Never commit tokens to version control**

**SPIFFE Certificates:**
- Certificates are **short-lived** (typically 1 hour)
- Certificates **auto-rotate** before expiration
- Certificates are **cryptographically bound** to workload identity
- **No manual rotation required**

### CI/CD Integration

For CI/CD pipelines, you can use GitHub Personal Access Tokens (PATs) or OAuth tokens:

```yaml
# GitHub Actions example
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Use dirctl
        env:
          DIRECTORY_CLIENT_SERVER_ADDRESS: "prod.gateway.ads.outshift.io:443"
          DIRECTORY_CLIENT_AUTH_MODE: "github"
          DIRECTORY_CLIENT_GITHUB_TOKEN: ${{ secrets.DIRECTORY_GITHUB_TOKEN }}
        run: |
          dirctl list
          dirctl push ./agent-card.json
```

**Best Practices:**
- ✅ Store tokens in CI/CD secrets (never in code)
- ✅ Use dedicated service accounts for automation
- ✅ Rotate tokens regularly
- ✅ Scope tokens to minimum required permissions

## Comparison: When to Use Each Method

| Criteria | SPIFFE (mTLS) | GitHub OAuth |
|----------|---------------|--------------|
| **Use Case** | Automated workloads | Human operators |
| **Environment** | Kubernetes clusters with SPIRE | CLI, laptops, CI/CD |
| **Setup Complexity** | Medium (requires SPIRE infrastructure) | Low (just GitHub account) |
| **Security Model** | Workload identity | User identity |
| **Token Lifetime** | Short (1 hour) | Medium (8 hours) |
| **Rotation** | Automatic (with SPIRE Agent) | Manual (re-login) |
| **Manual Steps** | None (with Agent) / Manual export (without) | Login once per 8 hours |
| **Cluster Access** | Required for setup | Not required |
| **Best For** | Production services | Development, debugging |

**Rule of Thumb:**
- Use **SPIFFE with SPIRE Agent** for production Kubernetes workloads (fully automated)
- Use **SPIFFE with manual export** for testing/debugging without SPIRE Agent access
- Use **GitHub OAuth** for human CLI interactions and external CI/CD

## Troubleshooting

### GitHub Authentication Issues

**Problem:** `dirctl auth login` times out

**Solution:**
1. Check your internet connection
2. Verify you can access `https://github.com/login/device`
3. Ensure you authorized the application within 15 minutes
4. Try again: `dirctl auth login`

---

**Problem:** `not authenticated with GitHub` error

**Solution:**
1. Check if token is cached: `dirctl auth status`
2. Re-authenticate: `dirctl auth login`
3. Verify environment variables:
   ```bash
   echo $DIRECTORY_CLIENT_SERVER_ADDRESS
   echo $DIRECTORY_CLIENT_AUTH_MODE
   ```

---

**Problem:** `403 Forbidden` error after authentication

**Solution:**
1. Verify you're in the allowed users or organizations list
2. Contact the Directory administrator to add your GitHub username
3. Check Envoy logs for authorization details:
   ```bash
   kubectl logs -n dir-prod-dir -l app=envoy-authz-authz --tail=100
   ```

### SPIFFE Authentication Issues

**Problem:** `connection refused` error

**Solution:**
1. Verify you're on the VPN
2. Check the server address: `prod.api.ads.outshift.io:443`
3. Verify SPIFFE certificate is valid:
   ```bash
   cat spiffe-prod.json | jq '.svids[0].x509_svid' -r | \
     base64 -d | openssl x509 -noout -dates
   ```

---

**Problem:** Certificate expired

**Solution:**
1. Mint a new certificate (see Step 1 in SPIFFE authentication)
2. For workloads, ensure SPIRE Agent is running and can communicate with SPIRE Server

## What's Next?

The dual-mode authentication system in Directory v1.0.0 is just the beginning. Future enhancements include:

- **OIDC Provider Support**: Integration with enterprise identity providers (Okta, Azure AD, Zitadel)
- **Fine-Grained RBAC**: Per-resource permissions (read vs. write access)
- **Audit Logging**: Comprehensive access logs for compliance
- **Multi-Tenancy**: Namespace-based isolation

## Conclusion

Directory v1.0.0's dual-mode authentication architecture demonstrates that **security doesn't have to compromise usability**. By supporting both SPIFFE workload identity and GitHub OAuth, we've created a system that's:

- ✅ **Secure by default** - Zero-trust, mutual TLS, automatic rotation
- ✅ **Developer-friendly** - Familiar OAuth flows, cached tokens, simple CLI
- ✅ **Production-ready** - Battle-tested in real-world environments
- ✅ **Flexible** - Supports both automated workloads and human operators

Whether you're building AI agents, deploying microservices, or managing a service mesh, the Agent Directory provides the trusted foundation for secure service discovery.

**Try it today:**
```bash
# Install dirctl
curl -sSL https://get.agntcy.dev/dir | sh

# Authenticate
dirctl auth login

# Explore
dirctl list
```

## 📚 References

- [Directory GitHub Repository](https://github.com/agntcy/dir)
- [SPIFFE/SPIRE Documentation](https://spiffe.io)
- [OAuth 2.0 Device Flow (RFC 8628)](https://datatracker.ietf.org/doc/html/rfc8628)
- [Envoy External Authorization](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/ext_authz_filter)
- [GitHub OAuth Apps](https://docs.github.com/en/developers/apps/building-oauth-apps)
