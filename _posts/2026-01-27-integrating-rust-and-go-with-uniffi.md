---
layout: post
title: "Integrating Rust and Go with UniFFI: A Complete Guide"
date: 2026-01-27 15:50:00 +0000
author: Sam Betts
author_url: https://github.com/tehsmash
categories: technical
tags: [rust, go, uniffi, bindings, cgo, interop]
---

Rust and Go are both excellent languages, but they excel in different areas. Rust provides memory safety and zero-cost abstractions, while Go offers simplicity and fast compilation. What if you could combine the strengths of both? This post explores how we use UniFFI to create seamless Rust-Go integrations for the SLIM messaging library.

<!--more-->

## Why Integrate Rust and Go?

Before diving into the technical details, let's understand when and why you might want to integrate Rust with Go:

**Rust's Strengths:**
- Memory safety without garbage collection
- Zero-cost abstractions
- Excellent cryptography libraries
- Strong type system with powerful error handling
- Performance-critical operations

**Go's Strengths:**
- Simple, readable syntax
- Fast compilation times
- Excellent concurrency model
- Great standard library for networking and HTTP
- Easy deployment (single binary)

**When to Integrate:**
- You have performance-critical code that benefits from Rust's zero-cost abstractions
- You need cryptographic operations best handled by Rust's mature ecosystem
- You want Go's deployment simplicity but need Rust's safety guarantees
- You're building a library that needs to support multiple languages

## The Challenge: Foreign Function Interface (FFI)

Calling Rust from Go requires crossing the FFI boundary through C. The traditional approach involves:

1. Writing a C-compatible API in Rust using `extern "C"`
2. Creating C header files manually
3. Writing Go code with CGO to call the C functions
4. Manual memory management at the boundary
5. Custom error handling and type conversions

This is tedious, error-prone, and requires maintaining three separate codebases (Rust, C headers, and Go bindings).

## Enter UniFFI: Automated Binding Generation

[UniFFI](https://mozilla.github.io/uniffi-rs/) (Unified Foreign Function Interface) is Mozilla's solution to this problem. Instead of manually writing FFI code, you:

1. Write your Rust library with normal Rust types
2. Define an interface using UniFFI's macro system
3. UniFFI automatically generates:
   - C-compatible FFI layer
   - C header files
   - Language bindings (Go, Python, Swift, Kotlin, etc.)

For Go specifically, we use [uniffi-bindgen-go](https://github.com/NordSecurity/uniffi-bindgen-go), a Go binding generator maintained by NordSecurity.

## Our Implementation: SLIM Go Bindings

Let's walk through how we integrated Rust and Go for the [SLIM messaging library](https://github.com/agntcy/slim).

### Step 1: Define the Rust API

First, we write our Rust library with normal Rust types and use UniFFI macros to expose the API:

```rust
// src/lib.rs
use uniffi;

#[uniffi::export]
pub fn create_identity(name: String) -> Result<Identity, SlimError> {
    // Implementation using normal Rust code
    Identity::new(name)
}

#[derive(uniffi::Object)]
pub struct Identity {
    inner: Arc<IdentityInner>,
}

#[uniffi::export]
impl Identity {
    pub fn public_key(&self) -> Vec<u8> {
        self.inner.public_key.clone()
    }
    
    pub fn sign(&self, data: Vec<u8>) -> Result<Vec<u8>, SlimError> {
        self.inner.sign(&data)
    }
}

#[derive(uniffi::Error)]
pub enum SlimError {
    InvalidInput { message: String },
    CryptoError { message: String },
}
```

**Key Points:**
- `#[uniffi::export]` marks functions for export
- `#[derive(uniffi::Object)]` for complex types that need methods
- `#[derive(uniffi::Error)]` for error enums
- Use standard Rust types like `String`, `Vec<u8>`, `Result`
- UniFFI reads the Rust macros directly—no separate `.udl` file needed!

### Step 2: Configure the Rust Crate to Use UniFFI

Add UniFFI to your `Cargo.toml` with the CLI feature:

```toml
[lib]
crate-type = ["staticlib"]
name = "slim_bindings"

[dependencies]
uniffi = { version = "0.28.3", features = ["cli"] }

[dev-dependencies]
uniffi = { version = "0.28.3", features = ["build"] }
```

**Important:** We use `crate-type = ["staticlib"]` to produce a static library (`.a` archive) rather than a dynamic library. This allows the Go compiler to statically link the native code into the final binary, ensuring there are no external runtime dependencies.

Then add the scaffolding macro to your `lib.rs`:

```rust
// src/lib.rs
uniffi::setup_scaffolding!();
```

The `setup_scaffolding!()` macro generates all the FFI glue code at compile time—no build script needed when using proc-macros!

### Step 3: Build the Rust Library

Compile the Rust library to produce the static archive:

```bash
# Build in release mode for optimal performance
cargo build --release
```

This produces `target/release/libslim_bindings.a` - a static library archive that can be linked directly into Go binaries. Static linking means:
- **At build time**: The Go compiler embeds the native code into your binary
- **At runtime**: No external `.so`, `.dylib`, or `.dll` files are needed
- **For end users**: Just distribute a single, self-contained executable

### Step 4: Generate Go Bindings

Use `uniffi-bindgen-go` to generate the Go code:

```bash
# Install uniffi-bindgen-go
cargo install uniffi-bindgen-go

# Generate Go bindings
uniffi-bindgen-go \
  --library target/release/libslim_bindings.a \
  --out-dir ./bindings/go
```

UniFFI reads the macros directly from your Rust code to generate the bindings—no separate definition file required!

This generates two files:
- `slim_bindings.go` - Go wrapper code
- `slim_bindings.h` - C header file

### Step 5: Distribution Strategy

Now that you have the static library (`.a` file) and Go bindings, you need to distribute them to developers. This presents a challenge:

- The static library is ~150 MB per platform
- GitHub has a 100 MB file size limit (without Git LFS)
- `go get` doesn't support Git LFS
- `go get` has a hard-coded 500 MB size limit

**Solution:** Use GitHub Releases to host the pre-compiled static libraries, and provide a setup tool that downloads the appropriate library for the developer's platform.

We cover this approach in detail in our blog post: [Distributing C Artifacts for Go Modules](/2026/01/16/distributing-c-artifacts-for-go-modules.html)

Key points:
- Host static libraries on GitHub Releases (not in the Git repository)
- Provide a lightweight setup tool developers run once
- Cache libraries in `$GOPATH/.cgo-cache/` for CGO to find
- Configure CGO linker flags to reference the cached library

### Step 6: Using the Go Bindings

The generated Go code provides an idiomatic Go API. Here's a complete example showing SLIM message encryption:

```go
package main

import (
    "fmt"
    slim "github.com/agntcy/slim-bindings-go"
)

func main() {
    // Create two identities
    alice, err := slim.CreateIdentity("Alice")
    if err != nil {
        panic(err)
    }
    defer alice.Destroy() // Important: cleanup Rust resources
    
    bob, err := slim.CreateIdentity("Bob")
    if err != nil {
        panic(err)
    }
    defer bob.Destroy()
    
    // Get public keys
    alicePubKey := alice.PublicKey()
    bobPubKey := bob.PublicKey()
    fmt.Printf("Alice public key: %x\n", alicePubKey)
    fmt.Printf("Bob public key: %x\n", bobPubKey)
    
    // Alice creates an encrypted message for Bob
    message := []byte("Secret message")
    encrypted, err := alice.Encrypt(message, bobPubKey)
    if err != nil {
        panic(err)
    }
    
    // Bob decrypts the message
    decrypted, err := bob.Decrypt(encrypted, alicePubKey)
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Original:  %s\n", message)
    fmt.Printf("Decrypted: %s\n", decrypted)
}
```

**Key Features:**
- **Idiomatic Go error handling** with the `error` interface
- **Automatic type conversions** (Rust `Vec<u8>` ↔ Go `[]byte`)
- **Memory management** via `Destroy()` method—call this to free Rust resources
- **High-level API** that hides all FFI complexity

This high-level Go code is calling Rust crypto functions under the hood, with all the FFI complexity handled by UniFFI.

## How UniFFI Works: Under the Hood

Let's understand what UniFFI generates:

### The Rust Side (Generated by UniFFI)

UniFFI generates a C-compatible FFI layer:

```rust
// Generated by UniFFI
#[no_mangle]
pub extern "C" fn slim_create_identity(
    name: RustBuffer,
    err: &mut RustCallStatus,
) -> *const Identity {
    // Conversion logic from C types to Rust types
    // Calls your actual Rust function
    // Converts result back to C-compatible types
}
```

### The Go Side (Generated by uniffi-bindgen-go)

The Go bindings wrap the C functions:

```go
// Generated by uniffi-bindgen-go

// #include "slim_bindings.h"
// #cgo LDFLAGS: -lslim_bindings
import "C"

type Identity struct {
    pointer unsafe.Pointer
}

func CreateIdentity(name string) (*Identity, error) {
    // Convert Go string to C string
    cName := C.CString(name)
    defer C.free(unsafe.Pointer(cName))
    
    // Call C function
    var err C.RustCallStatus
    ptr := C.slim_create_identity(cName, &err)
    
    // Handle errors
    if err.code != 0 {
        return nil, convertError(err)
    }
    
    return &Identity{pointer: ptr}, nil
}

func (i *Identity) Destroy() {
    C.slim_identity_free(i.pointer)
}
```

### Memory Management

UniFFI handles the complex memory management at the boundary:

- **Rust → Go**: Rust allocates, Go receives pointer, Go calls `Destroy()` to free
- **Go → Rust**: Go data is copied into Rust-owned memory
- **Return values**: Rust allocates, transfers ownership to Go

The generated `Destroy()` method is crucial—it tells Rust to free its memory. Without it, you'd have memory leaks.

## Advantages of the UniFFI Approach

1. **Type Safety**: UniFFI generates type-safe bindings automatically
2. **Error Handling**: Rust `Result` types map to Go `error` naturally
3. **Multiple Languages**: Same Rust code can target Go, Python, Swift, Kotlin
4. **Maintainability**: Changes to Rust API automatically reflect in bindings
5. **Idiomatic APIs**: Generated code feels natural in each target language
6. **Memory Safety**: Automatic handling of ownership and lifetimes

## Challenges and Limitations

1. **Learning Curve**: Understanding UniFFI's macro system takes time
2. **Build Complexity**: Requires cargo, uniffi-bindgen-go, and CGO toolchain
3. **Memory Management**: Developers must remember to call `Destroy()`
4. **Type Limitations**: Not all Rust types can cross FFI boundary (e.g., traits, complex generics)
5. **Debugging**: Stack traces cross language boundaries
6. **Binary Size**: Static linking increases final binary size

## Special Cases

### Native Async Functions

UniFFI supports exposing Rust async functions through the FFI interface. The key thing to understand is that these async functions use the **binding language's async runtime**, not Rust's:

```rust
#[uniffi::export]
pub async fn fetch_data(url: String) -> Result<Vec<u8>, SlimError> {
    // This async function will be translated to the target language
    perform_http_request(url).await
}
```

**How it translates across languages:**

- **Python**: Directly becomes an awaitable function that integrates with Python's `asyncio`
  ```python
  data = await fetch_data("https://example.com")
  ```

- **Go**: Becomes a regular blocking function (Go doesn't have native async/await)
  ```go
  data, err := FetchData("https://example.com") // Blocks until complete
  
  // To make it non-blocking, wrap it in a goroutine
  go func() {
      data, err := FetchData("https://example.com")
      // Handle result...
  }()
  ```

**Important Note About Futures:**

Rust `Future` types don't translate well to Go. If you need to expose a custom future, you must provide a `.Wait()` method that handles the awaiting internally:

```rust
#[derive(uniffi::Object)]
pub struct DataFuture {
    inner: /* your future implementation */
}

#[uniffi::export]
impl DataFuture {
    // Provide an async wait method that UniFFI will translate
    pub async fn wait(&self) -> Result<Vec<u8>, SlimError> {
        self.inner.await
    }
}
```

Then in Go:
```go
future := CreateDataFuture(url)
defer future.Destroy()
result, err := future.Wait() // Blocks until complete
```

### Tokio and External Async Runtimes

If your Rust code uses an external async runtime like **Tokio**, you need to handle it differently. The runtime must live on the Rust side of the boundary, and you need to explicitly spawn or block on tasks:

```rust
use tokio::runtime::Runtime;
use std::sync::Arc;

#[derive(uniffi::Object)]
pub struct AsyncClient {
    runtime: Arc<Runtime>,
    // other fields...
}

#[uniffi::export]
impl AsyncClient {
    #[uniffi::constructor]
    pub fn new() -> Result<Arc<Self>, SlimError> {
        let runtime = Runtime::new()
            .map_err(|e| SlimError::RuntimeError { 
                message: e.to_string() 
            })?;
        
        Ok(Arc::new(Self {
            runtime: Arc::new(runtime),
        }))
    }
    
    // Blocking operation that uses the Tokio runtime
    pub fn fetch_data(&self, url: String) -> Result<Vec<u8>, SlimError> {
        // Use block_on to await the async operation
        self.runtime.block_on(async {
            perform_async_request(&url).await
        })
    }
    
    // Fire-and-forget background task
    pub fn start_background_task(&self, interval_ms: u64) -> Result<(), SlimError> {
        let runtime = self.runtime.clone();
        
        // Spawn a task on the Tokio runtime
        runtime.spawn(async move {
            loop {
                tokio::time::sleep(
                    tokio::time::Duration::from_millis(interval_ms)
                ).await;
                // Do background work...
            }
        });
        
        Ok(())
    }
}
```

**Key points for Tokio integration:**

1. **Create the runtime once**: Store a reference to the Tokio runtime in your Rust object
2. **Use `block_on`**: For synchronous operations that need to await async code
3. **Use `spawn`**: For background tasks that shouldn't block the caller
4. **Runtime lifecycle**: The runtime lives as long as your Rust object exists
5. **Go integration**: From Go's perspective, these are just regular blocking functions

Example usage in Go:
```go
client, err := NewAsyncClient()
if err != nil {
    panic(err)
}
defer client.Destroy()

// This blocks until the async operation completes
data, err := client.FetchData("https://example.com")

// This starts a background task and returns immediately
err = client.StartBackgroundTask(1000)
```

The Tokio runtime handles all the async execution internally, while Go sees only synchronous function calls.

## Performance Considerations

Crossing the FFI boundary through CGO has overhead. While the exact performance impact depends on your use case, there are some general guidelines:

**Key Considerations:**
- **Function call overhead**: Each FFI call has a cost beyond a regular function call
- **Data copying**: Data must be copied across the language boundary
- **Avoid chatty APIs**: Design your API to minimize the number of FFI calls

**Optimization tips:**
- Batch operations when possible instead of making many small calls
- Keep data structures simple at the boundary
- Use byte slices (`Vec<u8>`) for efficient data transfer
- Do heavy processing on one side of the boundary, not back-and-forth

For a detailed analysis of CGO performance overhead, see Shane O'Neill's excellent post: [CGO Performance in Go 1.21](https://shane.ai/posts/cgo-performance-in-go1.21/)

## Build and Distribution

For production use, you'll need to:

1. **Cross-compile Rust libraries** for target platforms
2. **Distribute static libraries** (see our [previous blog post](https://blog.agntcy.com/2026/01/16/distributing-c-artifacts-for-go-modules.html))
3. **Configure CGO** to link against the Rust library
4. **Handle platform-specific differences**

We cover this in detail in our blog post about [distributing C artifacts for Go modules](https://blog.agntcy.com/2026/01/16/distributing-c-artifacts-for-go-modules.html).

## Automation and CI/CD

Our release process automates the entire workflow for building Rust libraries, generating Go bindings, and distributing them across platforms. You can see our complete CI/CD setup in the [SLIM repository's release-bindings.yaml workflow](https://github.com/agntcy/slim/blob/main/.github/workflows/release-bindings.yaml).

This workflow handles:
- Cross-compilation for multiple platforms using Zig
- UniFFI binding generation
- Packaging and uploading to GitHub Releases
- Version tagging and coordination between repositories

## Conclusion

UniFFI provides a powerful way to integrate Rust and Go, combining Rust's safety and performance with Go's simplicity and deployment model. While there's complexity in the build process and memory management, the type safety and automated binding generation make it far superior to manual FFI code.

For the SLIM project, this approach allows us to:
- Write cryptographic code once in Rust
- Expose it to Go developers with an idiomatic API
- Maintain type safety across the language boundary
- Support multiple languages from the same Rust codebase

If you're building performance-critical libraries or need Rust's safety guarantees in your Go projects, UniFFI is worth the investment.

## Additional Resources

- [UniFFI Documentation](https://mozilla.github.io/uniffi-rs/)
- [uniffi-bindgen-go](https://github.com/NordSecurity/uniffi-bindgen-go)
- [SLIM Go Bindings Repository](https://github.com/agntcy/slim-bindings-go)
- [SLIM Main Repository](https://github.com/agntcy/slim)
- [CGO Documentation](https://pkg.go.dev/cmd/cgo)

---

*Have questions about Rust-Go integration or UniFFI? Join our [Slack community](https://join.slack.com/t/agntcy/shared_invite/zt-3hb4p7bo0-5H2otGjxGt9OQ1g5jzK_GQ) or check out our [GitHub](https://github.com/agntcy).*
