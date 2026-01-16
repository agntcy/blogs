---
layout: post
title: "Distributing C Artifacts for Go Modules: A Practical Approach"
date: 2026-01-16 10:00:00 +0000
author: Sam Betts
categories: technical
tags: [go, cgo, rust, slim, bindings, artifacts]
---

When building Go modules that depend on C/C++/Rust libraries via CGO, one of the biggest challenges is distribution. How do you ensure users can simply `go get` your module without needing complex build toolchains? This post explores our solution for distributing pre-compiled C artifacts for Go modules, using the SLIM Go bindings as a case study.

<!--more-->

## The Challenge: CGO Dependencies

The [SLIM Go bindings](https://github.com/agntcy/slim-bindings-go) wrap a Rust library that provides secure messaging capabilities. While Go's CGO makes it possible to call native libraries, it creates a distribution problem:

- **Developers need a C compiler** (gcc, clang, etc.)
- **They need the native library** already built for their platform
- **Cross-compilation becomes painful**
- **Build times increase significantly**

But there's an even bigger challenge: **end-user distribution**. We wanted to ensure that applications built using our Go library could be distributed as single, self-contained binaries—without requiring end users to install any native libraries on their systems.

This is a common pain point: you want the performance and safety of Rust/C++ with the simplicity of Go's distribution model, while maintaining Go's promise of "compile once, run anywhere" binaries.

## Our Solution: Static Linking + GitHub Releases + Setup Tool

Our approach is built on a critical architectural decision: **static linking**. We distribute static library archives (`.a` files) rather than dynamic libraries (`.so`, `.dylib`, `.dll`). This means:

- **At build time**: Developers need the `.a` file available
- **At runtime**: End users need nothing—the native code is embedded in the Go binary

This preserves Go's single-binary deployment model while leveraging native code performance.

We then developed a two-part solution for the build-time requirements:

1. **Pre-compiled static libraries hosted on GitHub Releases**
2. **A lightweight setup tool developers run once**

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  User runs: go get github.com/agntcy/slim-bindings-go  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  User runs: go run .../cmd/slim-bindings-setup          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────┴──────────────────┐
         │  Setup Tool Detects Platform         │
         │  - OS: darwin/linux/windows          │
         │  - Arch: amd64/arm64                 │
         └──────────────────┬──────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Downloads from GitHub Release:                         │
│  github.com/agntcy/slim/releases/download/              │
│    slim-bindings-libs-v0.7.2/                           │
│    slim-bindings-aarch64-apple-darwin.zip               │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Extracts to Cache Directory:                           │
│  ~/.cache/slim-bindings/                                │
│    libslim_bindings_aarch64_apple_darwin.a              │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  CGO Flags Reference Cache Location:                    │
│  #cgo darwin,arm64 LDFLAGS:                             │
│    -L${SRCDIR}/../../.cache/slim-bindings               │
│    -lslim_bindings_aarch64_darwin                       │
└─────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. Static vs Dynamic Linking

The foundation of our approach is using **static libraries** (`.a` files). This is crucial for achieving our goal:

```
┌─────────────────────────────────────────────────────────┐
│  Build Time (Developer Machine)                         │
├─────────────────────────────────────────────────────────┤
│  ✓ Needs: libslim_bindings_*.a                         │
│  ✓ Needs: Go compiler + CGO enabled                    │
│  ✓ Links native code into Go binary                    │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Deployment (End User Machine)                          │
├─────────────────────────────────────────────────────────┤
│  ✓ Only needs: myapp (single binary)                   │
│  ✗ Does NOT need: Any .so/.dylib/.dll files            │
│  ✗ Does NOT need: SLIM installed                       │
│  ✗ Does NOT need: Any native libraries                 │
└─────────────────────────────────────────────────────────┘
```

**Why Static Linking?**
- **Self-contained binaries**: All native code is embedded in the Go executable
- **No runtime dependencies**: End users don't need to install anything
- **Version consistency**: No risk of library version mismatches at runtime
- **Simplified deployment**: True "compile once, deploy anywhere" for the target platform

The trade-off is larger binary sizes, but this is acceptable for most use cases and aligns with Go's philosophy of self-contained binaries.

### 2. Platform Detection

The setup tool automatically detects the user's platform:

```go
func GetTarget(goos, arch string) string {
    if goos == "" {
        goos = runtime.GOOS
    }
    if arch == "" {
        arch = runtime.GOARCH
    }

    switch goos {
    case "darwin":
        if arch == "arm64" {
            return "aarch64-apple-darwin"
        }
        return "x86_64-apple-darwin"
    case "linux":
        if arch == "arm64" {
            return "aarch64-unknown-linux-gnu"
        }
        return "x86_64-unknown-linux-gnu"
    case "windows":
        return "x86_64-pc-windows-gnu"
    }
    return fmt.Sprintf("%s-unknown-%s", arch, goos)
}
```

### 3. Cache Directory Strategy

We use the XDG Base Directory standard for cache location:

```go
func GetCacheDir() (string, error) {
    cacheHome := os.Getenv("XDG_CACHE_HOME")
    if cacheHome == "" {
        home, err := os.UserHomeDir()
        if err != nil {
            return "", err
        }

        switch runtime.GOOS {
        case "windows":
            cacheHome = filepath.Join(home, "AppData", "Local")
        default:
            cacheHome = filepath.Join(home, ".cache")
        }
    }

    return filepath.Join(cacheHome, "slim-bindings"), nil
}
```

**Cache Locations by Platform:**
- **Linux**: `~/.cache/slim-bindings/`
- **macOS**: `~/.cache/slim-bindings/`
- **Windows**: `%LOCALAPPDATA%\slim-bindings\`

### 4. CGO Linker Flags for Static Linking

The Go source file includes platform-specific CGO directives that reference the cache directory and ensure static linking:

```go
/*
#cgo CFLAGS: -I${SRCDIR}
#cgo linux,amd64 LDFLAGS: -L${SRCDIR}/../../../../../../.cache/slim-bindings -L${SRCDIR} -lslim_bindings_x86_64_linux_gnu -lm
#cgo linux,arm64 LDFLAGS: -L${SRCDIR}/../../../../../../.cache/slim-bindings -L${SRCDIR} -lslim_bindings_aarch64_linux_gnu -lm
#cgo darwin,amd64 LDFLAGS: -L${SRCDIR}/../../../../../../.cache/slim-bindings -L${SRCDIR} -lslim_bindings_x86_64_darwin -Wl,-undefined,dynamic_lookup
#cgo darwin,arm64 LDFLAGS: -L${SRCDIR}/../../../../../../.cache/slim-bindings -L${SRCDIR} -lslim_bindings_aarch64_darwin -Wl,-undefined,dynamic_lookup
#cgo windows,amd64 LDFLAGS: -L${SRCDIR}/../../../../../../AppData/Local/slim-bindings -L${SRCDIR} -lslim_bindings_x86_64_windows_gnu -lws2_32 -lbcrypt -ladvapi32 -luserenv -lntdll -lgcc_eh -lgcc -lkernel32 -lole32
#include <slim_bindings.h>
*/
import "C"
```

**Key Points:**
- `${SRCDIR}` is a CGO variable that points to the directory containing the Go source file
- We use relative paths to traverse up to the home directory, then down to `.cache`
- Platform-specific flags ensure the correct library variant is linked
- The `-l` flag links against `.a` files (static archives), not dynamic libraries
- The linker automatically embeds the static library code into the final Go binary
- Additional system libraries (`-lm`, `-lws2_32`, etc.) are included as needed for runtime dependencies

**Static Linking in Action:**
When you run `go build`, CGO:
1. Finds `libslim_bindings_*.a` in the cache directory
2. Extracts all object files from the static archive
3. Links them directly into your Go binary
4. Results in a single executable with no external native library dependencies

### 5. Download from GitHub Releases

The setup tool downloads pre-compiled libraries from GitHub Releases:

```go
func DownloadLibrary(target string) error {
    version := Version() // Gets version from go.mod
    
    url := fmt.Sprintf(
        "https://github.com/agntcy/slim/releases/download/slim-bindings-libs-%s/slim-bindings-%s.zip",
        version, target,
    )
    
    // Download zip file
    resp, err := http.Get(url)
    // ... error handling ...
    
    // Extract .a files to cache directory
    // ... extraction logic ...
}
```

**Release Structure:**
```
slim-bindings-libs-v0.7.2/
├── slim-bindings-aarch64-apple-darwin.zip
│   └── libslim_bindings_aarch64_apple_darwin.a  (static archive)
├── slim-bindings-x86_64-apple-darwin.zip
│   └── libslim_bindings_x86_64_apple_darwin.a
├── slim-bindings-aarch64-unknown-linux-gnu.zip
│   └── libslim_bindings_aarch64_linux_gnu.a
├── slim-bindings-x86_64-unknown-linux-gnu.zip
│   └── libslim_bindings_x86_64_linux_gnu.a
├── slim-bindings-aarch64-unknown-linux-musl.zip
│   └── libslim_bindings_aarch64_linux_musl.a
├── slim-bindings-x86_64-unknown-linux-musl.zip
│   └── libslim_bindings_x86_64_linux_musl.a
└── slim-bindings-x86_64-pc-windows-gnu.zip
    └── libslim_bindings_x86_64_windows_gnu.a
```

Note that all files are `.a` (static archive) files, not `.so`, `.dylib`, or `.dll` (dynamic libraries).

### 6. User Experience

From a developer's perspective, the workflow is simple:

```bash
# 1. Install the module
go get github.com/agntcy/slim-bindings-go

# 2. Run the setup tool (one-time, downloads static library)
go run github.com/agntcy/slim-bindings-go/cmd/slim-bindings-setup

# 3. Build your application (native code gets statically linked)
go build -o myapp

# 4. Deploy the single binary (no runtime dependencies!)
./myapp
```

From an end user's perspective, it's even simpler:

```bash
# Just run the application - no installation of native libraries required!
./myapp
```

Example output:

```
╔═══════════════════════════════════════════════════════════╗
║              SLIM Bindings Setup                          ║
╚═══════════════════════════════════════════════════════════╝

Version:  v0.7.2
Platform: darwin/arm64
Target:   aarch64-apple-darwin

📦 Downloading SLIM bindings library...
   Version:  v0.7.2
   Platform: aarch64-apple-darwin
   URL:      https://github.com/agntcy/slim/releases/download/...
   Extracted: libslim_bindings_aarch64_apple_darwin.a (12.3 MB)
✅ Library installed to: /Users/username/.cache/slim-bindings

✅ Setup complete! You can now build Go projects using SLIM bindings.
```

## Supported Platforms

We support 7 platform combinations out of the box:

| OS      | Architecture | Target Triple                      | Library File                               |
|---------|--------------|------------------------------------|--------------------------------------------|
| Linux   | amd64        | x86_64-unknown-linux-gnu           | libslim_bindings_x86_64_linux_gnu.a        |
| Linux   | arm64        | aarch64-unknown-linux-gnu          | libslim_bindings_aarch64_linux_gnu.a       |
| Linux   | amd64 (musl) | x86_64-unknown-linux-musl          | libslim_bindings_x86_64_linux_musl.a       |
| Linux   | arm64 (musl) | aarch64-unknown-linux-musl         | libslim_bindings_aarch64_linux_musl.a      |
| macOS   | amd64        | x86_64-apple-darwin                | libslim_bindings_x86_64_apple_darwin.a     |
| macOS   | arm64        | aarch64-apple-darwin               | libslim_bindings_aarch64_apple_darwin.a    |
| Windows | amd64        | x86_64-pc-windows-gnu              | libslim_bindings_x86_64_windows_gnu.a      |

## Building the Release Artifacts

The artifacts are built using a CI/CD pipeline in the main SLIM repository. Here's the general process:

1. **Cross-compile Rust library** for all target platforms using `cross` or `cargo build --target`
2. **Generate C bindings** using UniFFI
3. **Create static libraries** (`.a` files)
4. **Package per platform** into zip files
5. **Upload to GitHub Release** with version tag

Example commit message from our releases:

```
Release v0.7.2

Generated from https://github.com/agntcy/slim/commit/a51521ea

Platforms:
- linux/amd64 (x86_64-unknown-linux-gnu)
- linux/arm64 (aarch64-unknown-linux-gnu)
- linux/amd64-musl (x86_64-unknown-linux-musl)
- linux/arm64-musl (aarch64-unknown-linux-musl)
- darwin/arm64 (aarch64-apple-darwin)
- darwin/amd64 (x86_64-apple-darwin)
- windows/amd64 (x86_64-pc-windows-msvc)
```

## Advantages of This Approach

1. **No Runtime Dependencies**: End users don't need any native libraries installed—binaries are self-contained
2. **No Build Toolchain Required for Developers**: Developers don't need Rust, C compilers (beyond what CGO needs), or complex build dependencies
3. **Fast Installation**: Download pre-compiled static libraries instead of compiling from source
4. **Version Pinning**: Go modules naturally version-pin the setup tool and library version together
5. **Cross-Platform**: Works consistently across Linux, macOS, and Windows
6. **Transparent**: Developers can see exactly what's being downloaded and where it's stored
7. **Cache-Friendly**: Standard cache directories integrate with system cleanup tools
8. **Single Binary Deployment**: Maintains Go's promise of simple, single-binary deployment

## Limitations and Trade-offs

1. **Manual Setup Step**: Developers must run the setup tool once (not fully automatic)
2. **Storage Overhead**: Each platform variant is ~10-15 MB in the developer's cache
3. **Binary Size**: Static linking increases final binary size (typically 10-15 MB larger)
4. **Platform Coverage**: Need to pre-build static libraries for all target platforms
5. **Musl vs GNU libc**: Linux developers need to pick the right variant (though we auto-detect this)
6. **Trust Model**: Developers trust our GitHub Release artifacts
7. **CGO Required**: Developers must have CGO enabled (which requires a C compiler at build time)

## Alternative Approaches We Considered

### 1. Dynamic Libraries (.so/.dylib/.dll)

**Pros:** Smaller binaries, can share libraries across applications
**Cons:** **End users must install native libraries**—this was unacceptable for our use case. Breaks Go's single-binary deployment model.

### 2. Embed Libraries in Git Repository

**Pros:** Fully automatic, works with `go get`
**Cons:** Bloats repository size, problematic for Git LFS, multiple platform variants

### 3. Build from Source

**Pros:** Maximum flexibility, no trust issues, smallest approach
**Cons:** Requires Rust toolchain on developer machines, very slow builds, potential compilation failures, poor developer experience

### 4. Separate Binary Distribution

**Pros:** Can use OS package managers
**Cons:** Breaks Go's module system, complex installation instructions for developers, **still requires end users to install packages**

### 5. Go Generate with Download Script

**Pros:** Can be automatic
**Cons:** Security concerns with running arbitrary scripts, harder to audit

## Future Improvements

We're considering several enhancements:

1. **Automatic Setup Check**: Add init code that verifies the library is installed and prints helpful error messages
2. **Checksums**: Include SHA256 checksums in release notes for verification
3. **Signature Verification**: Sign releases with GPG or sigstore for supply chain security
4. **Auto-Detection of Musl**: Better detection of musl-based Linux systems
5. **Vendoring Option**: Allow optional embedding of libraries for airgapped environments
6. **Module Tooling**: Investigate go:embed or go:generate approaches for automation

## Conclusion

Distributing C artifacts for Go modules requires balancing simplicity, security, and deployment models. Our approach using **static linking** with GitHub Releases and a setup tool provides:

- **Zero runtime dependencies** for end users
- **Developer-friendly** installation process  
- **Fast** download and setup
- **Transparent** and auditable
- **Cross-platform** support
- **Single-binary deployment** that preserves Go's philosophy

The key insight is choosing static over dynamic linking. While it increases binary size, it eliminates runtime dependencies entirely, ensuring that applications built with our Go library can be distributed as truly self-contained binaries.

While not perfect, it solves the core problem: developers can use CGO-based Go modules without complex build toolchains, and **end users can run the resulting applications without installing any native libraries**.

The SLIM Go bindings demonstrate this approach in production. If you're building Go modules with native dependencies and want to maintain Go's single-binary deployment promise, consider adapting this pattern for your own projects.

## References

- [SLIM Go Bindings Repository](https://github.com/agntcy/slim-bindings-go)
- [SLIM Main Repository](https://github.com/agntcy/slim)
- [UniFFI - Unified Foreign Function Interface](https://mozilla.github.io/uniffi-rs/)
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html)
- [CGO Documentation](https://pkg.go.dev/cmd/cgo)

---

*Have questions about this approach or want to discuss alternative solutions? Join our [Slack community](https://join.slack.com/t/agntcy/shared_invite/zt-3hb4p7bo0-5H2otGjxGt9OQ1g5jzK_GQ) or check out our [GitHub](https://github.com/agntcy).*
