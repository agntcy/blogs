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

But there's an even bigger challenge: **end-user distribution**. We wanted to ensure that applications built using our Go library could be distributed as single, self-contained binaries—without requiring end users to install additional native libraries on their systems.

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
│  Extracts to $GOPATH Cache Directory:                   │
│  $GOPATH/.cgo-cache/slim-bindings/                      │
│    libslim_bindings_aarch64_apple_darwin.a              │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  CGO Flags Reference Cache Location:                    │
│  #cgo darwin,arm64 LDFLAGS:                             │
│    -L${SRCDIR}/../../../../.cgo-cache/slim-bindings     │
│    -lslim_bindings_aarch64_darwin                       │
└─────────────────────────────────────────────────────────┘
```

## Solution Details

### 1. Pre-compiled Static Libraries

The foundation of our approach is using **static libraries** (`.a` files). This is crucial for achieving our goal:

```
┌─────────────────────────────────────────────────────────┐
│  Build Time (Developer Machine)                         │
├─────────────────────────────────────────────────────────┤
│  ✓ Needs: libslim_bindings_*.a (static library)        │
│  ✓ Needs: Go compiler + CGO enabled                    │
│  ✓ Needs: C compiler (for CGO)                         │
│  ✓ Statically links SLIM code into Go binary           │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
                    [go build -o myapp]
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Output: myapp (single binary)                          │
├─────────────────────────────────────────────────────────┤
│  Contains:                                              │
│  • Go code                                              │
│  • SLIM native code (embedded from .a file)             │
│  • Links to standard system libraries only              │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Deployment (End User Machine)                          │
├─────────────────────────────────────────────────────────┤
│  ✓ Only needs: myapp (single binary)                   │
│  ✓ Only needs: Standard OS libraries (glibc, etc.)     │
│  ✗ Does NOT need: libslim_bindings_*.a                 │
│  ✗ Does NOT need: .so/.dylib/.dll files                │
│  ✗ Does NOT need: SLIM installed separately            │
│  ✗ Does NOT need: Any project-specific libraries       │
└─────────────────────────────────────────────────────────┘
```

**Why Static Linking?**
- **Self-contained binaries**: All SLIM native code is embedded in the Go executable
- **No additional runtime dependencies**: End users don't need to install additional libraries (beyond standard system libraries like glibc)
- **Version consistency**: No risk of library version mismatches at runtime
- **Simplified deployment**: True "compile once, deploy anywhere" for the target platform

The trade-off is larger binary sizes, but this is acceptable for most use cases and aligns with Go's philosophy of self-contained binaries.

**Note on Fully Static Binaries:** On Linux, using the musl libc variant (e.g., `x86_64-unknown-linux-musl`) allows for fully statically compiled binaries with no dependency on glibc or any system libraries. This is ideal for minimal container images (like `FROM scratch`) or environments where you want absolute portability without any system library dependencies.

### 2. Library Distribution: Setup Tool Approach

Rather than embedding pre-compiled static libraries directly in the Go repository, we provide a lightweight **setup tool** that developers run once to prepare their build environment. Each static library is approximately ~150 MB in size (7 platforms × 150 MB ≈ 1 GB total), which presents several distribution challenges:

**GitHub Repository Limitations:**
- GitHub has a **100 MB file size limit** without Git LFS, but `go get` doesn't support Git LFS
- `go get` has a **hard-coded 500 MB size limit**, preventing distribution even with workarounds

These technical constraints make it impossible to distribute the static libraries through the Git repository itself. Instead, our setup tool approach offers several advantages:
- **Small repository size**: Only source code is in the repo
- **Flexible platform support**: Add new platforms without repo bloat
- **Version management**: Libraries are downloaded for the specific version being used
- **Developer control**: Explicit setup step makes the native dependency transparent
- **No Git/Go tooling limits**: GitHub Releases can host large files that `go get` cannot handle

The setup tool handles three key tasks: detecting the platform, determining where to cache libraries, and downloading the correct artifacts from GitHub Releases.

#### Platform Detection

The setup tool automatically detects the developer's platform using Go's `runtime.GOOS` and `runtime.GOARCH` values, then maps them to the appropriate Rust target triple (e.g., `darwin/arm64` → `aarch64-apple-darwin`).

Developers can override the platform detection using standard Go environment variables:
- `GOOS`: Target operating system (e.g., `linux`, `darwin`, `windows`)
- `GOARCH`: Target architecture (e.g., `amd64`, `arm64`)

This is useful for downloading libraries for a different platform than the one you're currently on.

#### Cache Directory Strategy

We store the static libraries in `$GOPATH/.cgo-cache/slim-bindings`. This keeps our artifacts separate from Go's protected module cache while still being relative to `$GOPATH`, which allows us to navigate safely from the module cache where the source is stored by `go get` when using the libraries as a downstream dependency.

**Why $GOPATH/.cgo-cache Instead of pkg/mod?**
- **Write permissions**: The `pkg/mod` directories are readonly and protected by lockfiles
- **Separation of concerns**: Our CGO artifacts are separate from Go's module cache
- **Consistency**: Go module cache is always relative to `$GOPATH`
- **Non-home installations**: `$GOPATH` can be set to any location (e.g., `/opt/go`, `/usr/local/go`)
- **Build environment isolation**: Works in Docker, CI/CD, and custom build environments
- **Standard Go tooling**: Uses `build.Default.GOPATH` which respects Go's default behavior

**Cache Location:**
- **Path**: `$GOPATH/.cgo-cache/slim-bindings/`
- **Example**: If `GOPATH=/opt/go`, libraries are in `/opt/go/.cgo-cache/slim-bindings/`

#### Download from GitHub Releases

The setup tool downloads pre-compiled libraries from GitHub Releases. Each release follows a consistent naming pattern:

- **Release tag**: `slim-bindings-libs-{version}` (e.g., `slim-bindings-libs-v0.7.2`)
- **Artifact naming**: `slim-bindings-{target}.zip` (e.g., `slim-bindings-aarch64-apple-darwin.zip`)
- **Archive contents**: Single static library file `libslim_bindings_{normalized_target}.a` (~150 MB)

The setup tool constructs the download URL based on the detected platform and version, fetches the appropriate zip file, and extracts the static library to the cache directory.

### 3. CGO Linker Flags for Static Linking

The Go source file includes platform-specific CGO directives that reference the cache directory and ensure static linking:

```go
/*
#cgo CFLAGS: -I${SRCDIR}
#cgo linux,amd64 LDFLAGS: -L${SRCDIR}/../../../../.cgo-cache/slim-bindings -L${SRCDIR} -lslim_bindings_x86_64_linux_gnu -lm
#cgo linux,arm64 LDFLAGS: -L${SRCDIR}/../../../../.cgo-cache/slim-bindings -L${SRCDIR} -lslim_bindings_aarch64_linux_gnu -lm
#cgo darwin,amd64 LDFLAGS: -L${SRCDIR}/../../../../.cgo-cache/slim-bindings -L${SRCDIR} -lslim_bindings_x86_64_darwin -Wl,-undefined,dynamic_lookup
#cgo darwin,arm64 LDFLAGS: -L${SRCDIR}/../../../../.cgo-cache/slim-bindings -L${SRCDIR} -lslim_bindings_aarch64_darwin -Wl,-undefined,dynamic_lookup
#cgo windows,amd64 LDFLAGS: -L${SRCDIR}/../../../../.cgo-cache/slim-bindings -L${SRCDIR} -lslim_bindings_x86_64_windows_gnu -lws2_32 -lbcrypt -ladvapi32 -luserenv -lntdll -lgcc_eh -lgcc -lkernel32 -lole32
#include <slim_bindings.h>
*/
import "C"
```

**Key Points:**
- `${SRCDIR}` is a CGO variable that points to the directory containing the Go source file
- We use relative paths to traverse up to `$GOPATH`, then down to `.cgo-cache/slim-bindings`
- Platform-specific flags ensure the correct library variant is linked
- The `-l` flag links against `.a` files (static archives), not dynamic libraries
- The linker automatically embeds the static library code into the final Go binary
- Additional system libraries (`-lm`, `-lws2_32`, etc.) are included as needed for runtime dependencies

**Static Linking in Action:**
When you run `go build`, CGO:
1. Finds `libslim_bindings_*.a` in the `$GOPATH/.cgo-cache/slim-bindings/` directory
2. Extracts all object files from the static archive
3. Links them directly into your Go binary
4. Results in a single executable with no external native library dependencies

## Our Implementation for SLIM

The release process is split into two phases: building the native libraries in the SLIM repository, and generating/distributing the Go bindings in the slim-bindings-go repository.

### Phase 1: Native Library Build (SLIM Repository)

The CI/CD pipeline in the [main SLIM repository](https://github.com/agntcy/slim) handles cross-compilation of the Rust library:

1. **Cross-compile Rust library** for all target platforms using `cargo zigbuild`
   - Targets: `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu`, `x86_64-apple-darwin`, etc.
   - Produces static library archives (`.a` files)
   - We use [Zig](https://andrewkelley.me/post/zig-cc-powerful-drop-in-replacement-gcc-clang.html) instead of traditional cross-compilation toolchains because Zig provides true cross-compilation capabilities for C dependencies without needing separate toolchains for every architecture

2. **Package per platform** into zip files
   - Each platform gets its own zip: `slim-bindings-{target}.zip`
   - Contains the static library: `libslim_bindings_{normalized_target}.a`

3. **Upload to GitHub Release** with version tag
   - Release tag: `slim-bindings-libs-v0.7.2`
   - All platform zips attached to the release

**Supported Platforms:**

We build static libraries for 7 platform combinations:

| OS      | Architecture | Target Triple                      | Library File                               | Notes                          |
|---------|--------------|------------------------------------|--------------------------------------------|--------------------------------|
| Linux   | amd64        | x86_64-unknown-linux-gnu           | libslim_bindings_x86_64_linux_gnu.a        | Requires glibc at runtime      |
| Linux   | arm64        | aarch64-unknown-linux-gnu          | libslim_bindings_aarch64_linux_gnu.a       | Requires glibc at runtime      |
| Linux   | amd64 (musl) | x86_64-unknown-linux-musl          | libslim_bindings_x86_64_linux_musl.a       | Fully static, no glibc needed  |
| Linux   | arm64 (musl) | aarch64-unknown-linux-musl         | libslim_bindings_aarch64_linux_musl.a      | Fully static, no glibc needed  |
| macOS   | amd64        | x86_64-apple-darwin                | libslim_bindings_x86_64_apple_darwin.a     |                                |
| macOS   | arm64        | aarch64-apple-darwin               | libslim_bindings_aarch64_apple_darwin.a    |                                |
| Windows | amd64        | x86_64-pc-windows-gnu              | libslim_bindings_x86_64_windows_gnu.a      |                                |

The **musl variants** are particularly useful for:
- **Minimal Docker images**: Deploy to `FROM scratch` or minimal base images
- **Portable binaries**: No system library dependencies beyond the kernel
- **Legacy systems**: Run on systems with different or missing glibc versions

Example release in the SLIM repository:

```
Release: slim-bindings-libs-v0.7.2

Generated from https://github.com/agntcy/slim/commit/a51521ea

Assets:
- slim-bindings-x86_64-unknown-linux-gnu.zip
- slim-bindings-aarch64-unknown-linux-gnu.zip
- slim-bindings-x86_64-unknown-linux-musl.zip
- slim-bindings-aarch64-unknown-linux-musl.zip
- slim-bindings-aarch64-apple-darwin.zip
- slim-bindings-x86_64-apple-darwin.zip
- slim-bindings-x86_64-pc-windows-gnu.zip
```

### Phase 2: Go Bindings Generation (slim-bindings-go Repository)

After the native libraries are built, the Go bindings are generated and published:

1. **Generate Go bindings** using [UniFFI](https://mozilla.github.io/uniffi-rs/)
   - UniFFI reads the Rust library and generates Go code
   - Produces: `slim_bindings.go` (Go wrapper code)
   - Produces: `slim_bindings.h` (C header file)

2. **Copy artifacts to distribution repo**
   - Generated Go code → `github.com/agntcy/slim-bindings-go/slim_bindings.go`
   - Header file → `github.com/agntcy/slim-bindings-go/slim_bindings.h`
   - Setup tool → `github.com/agntcy/slim-bindings-go/cmd/slim-bindings-setup/`

3. **Cut matching version tag**
   - Tag in slim-bindings-go: `v0.7.2` (matches the library version)
   - Go module version: `github.com/agntcy/slim-bindings-go@v0.7.2`

We use this two-repository approach because Go uses code repositories for distribution via `go get`. The main SLIM repository is a Rust project with its own structure and dependencies—it doesn't make sense to use it as a Go module distribution point. By maintaining a separate slim-bindings-go repository, we provide a clean Go module that developers can import without pulling in the entire SLIM codebase.

## Final User Experience

From a developer's perspective, the workflow is simple:

```bash
# 1. Install the module
go get github.com/agntcy/slim-bindings-go

# 2. Run the setup tool (one-time, downloads static library)
go run github.com/agntcy/slim-bindings-go/cmd/slim-bindings-setup
```

The setup tool will output:

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
   Extracted: libslim_bindings_aarch64_apple_darwin.a (685 MB)
✅ Library installed to: $GOPATH/.cgo-cache/slim-bindings

✅ Setup complete! You can now build Go projects using SLIM bindings.
```

Then continue with your build:

```bash
# 3. Build your application (native code gets statically linked)
go build -o myapp

# 4. Deploy the single binary (no additional runtime dependencies!)
./myapp
```

**Cross-Compiling CGO Applications:** If you need to cross-compile your Go application with CGO enabled for different platforms, you can use [Zig as a drop-in C compiler replacement](https://andrewkelley.me/post/zig-cc-powerful-drop-in-replacement-gcc-clang.html). This eliminates the need for platform-specific toolchains:

```bash
# Example: Cross-compile for Linux ARM64 from macOS
CGO_ENABLED=1 GOOS=linux GOARCH=arm64 CC="zig cc -target aarch64-linux-gnu" go build -o myapp
```

Zig provides true cross-compilation for CGO without maintaining separate toolchains for each target platform.

From an end user's perspective, it's even simpler:

```bash
# Just run the application - no installation of native libraries required!
./myapp
```

## Advantages of This Approach

1. **No Additional Runtime Dependencies**: End users don't need to install additional native libraries—binaries are self-contained (standard system libraries like glibc are still required)
2. **No Build Toolchain Required for Developers**: Developers don't need Rust, C compilers (beyond what CGO needs), or complex build dependencies
3. **Fast Installation**: Download pre-compiled static libraries instead of compiling from source
4. **Version Pinning**: Go modules naturally version-pin the setup tool and library version together
5. **Cross-Platform**: Works consistently across Linux, macOS, and Windows
6. **Transparent**: Developers can see exactly what's being downloaded and where it's stored
7. **Single Binary Deployment**: Maintains Go's promise of simple, single-binary deployment

## Limitations and Trade-offs

1. **Manual Setup Step**: Developers must run the setup tool once (not fully automatic)
2. **Storage Overhead**: Each platform variant is ~150 MB in the developer's cache
3. **Binary Size**: Static linking increases final binary size (typically several MB when stripped)
4. **Platform Coverage**: Need to pre-build static libraries for all target platforms
5. **Musl vs GNU libc**: Linux developers need to pick the right variant (though we auto-detect this)
6. **Trust Model**: Developers trust our GitHub Release artifacts
7. **CGO Required**: Developers must have CGO enabled (which requires a C compiler at build time)

## Alternative Approaches We Considered

### 1. Dynamic Libraries (.so/.dylib/.dll)

**Pros:** Smaller binaries, can share libraries across applications
**Cons:** **End users must install native libraries**—this was unacceptable for our use case. Breaks Go's single-binary deployment model.

### 2. Embed Libraries in Git Repository

**Pros:** Fully automatic, works seamlessly with `go get`, no extra setup step
**Cons:** Each library is ~150 MB (~1 GB total for 7 platforms). GitHub's 100 MB limit requires Git LFS, but `go get` doesn't support Git LFS and has a 500 MB hard limit.

### 3. Build from Source

**Pros:** Maximum flexibility, no trust issues, smallest approach
**Cons:** Requires Rust toolchain on developer machines, very slow builds, potential compilation failures, poor developer experience

### 4. Separate Binary Distribution

**Pros:** Can use OS package managers
**Cons:** Breaks Go's module system, complex installation instructions for developers, **still requires end users to install packages**

### 5. Go Generate with Download Script

**Pros:** Can be automatic
**Cons:** Security concerns with running arbitrary scripts, harder to audit

## Conclusion

Distributing C artifacts for Go modules requires balancing simplicity, security, and deployment models. Our approach using **static linking** with GitHub Releases and a setup tool provides:

- **No additional runtime dependencies** for end users (beyond standard system libraries)
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
