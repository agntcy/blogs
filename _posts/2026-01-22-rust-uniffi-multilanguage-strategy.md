---
layout: post
title: "Write Once, Run Everywhere: Why Rust + UniFFI is the Future of Multi-Language Libraries"
date: 2026-01-22 13:43:00 +0000
author: Sam Betts
author_url: https://github.com/tehsmash
categories: technical
tags: [rust, uniffi, multilanguage, bindings, interop, architecture]
---

Imagine writing your core business logic once and having it automatically available in Python, Swift, Kotlin, Ruby, and Go. No rewrites, no version drift, no maintaining parallel implementations. This isn't a pipe dream—it's exactly what Rust + UniFFI enables. In this post, we'll explore why choosing Rust as your base language with UniFFI for language bindings is a game-changer for teams supporting multiple platforms.

<!--more-->

## The Multi-Language Problem

If you're building a library or SDK that needs to work across multiple languages, you've likely faced this dilemma:

**Option 1: Rewrite for each language**
- Write the same logic in Python, JavaScript, Java, Swift, etc.
- Result: N implementations to maintain, N sets of bugs, version drift nightmares

**Option 2: Pick one language and force everyone to use it**
- Standardize on one language for all platforms
- Result: Can't support iOS (needs Swift/Obj-C), can't support Android (needs Kotlin/Java), can't support Python users, etc.

**Option 3: Use C as a common denominator**
- Write once in C, bind everywhere
- Result: Memory unsafety, tedious FFI code, no modern language features

None of these options are great. But there's a fourth way.

## Enter Rust + UniFFI

Rust offers a compelling foundation for multi-language libraries:

**Rust's Strategic Advantages:**
- **Memory safety without garbage collection** - Works on any platform, no runtime required
- **Zero-cost abstractions** - Performance comparable to C/C++
- **Modern language features** - Algebraic data types, pattern matching, traits
- **Excellent error handling** - Result types and comprehensive error propagation
- **Strong ecosystem** - Mature cryptography, networking, parsing libraries
- **C-compatible FFI** - Can expose a stable C API when needed

But raw Rust FFI is still tedious. You need to manually:
- Create C-compatible functions with `extern "C"`
- Write header files
- Handle memory allocation and deallocation across boundaries
- Convert between Rust and C types
- Write bindings for each target language

This is where **UniFFI** comes in.

## What is UniFFI?

[UniFFI](https://mozilla.github.io/uniffi-rs) (Unified Foreign Function Interface) is Mozilla's solution for generating language bindings from Rust. You define your API once using either a UDL (UniFFI Definition Language) file or Rust procedural macros—we prefer the macro approach since it keeps everything directly in the code—and UniFFI automatically generates:

- C-compatible FFI layer in Rust
- Python bindings
- Swift bindings
- Kotlin bindings
- Ruby bindings
- Go bindings (via community extensions)

**The result?** Write your core logic once in Rust, add a few annotations, and get native-feeling bindings in multiple languages automatically.

## Real-World Benefits

### 1. Single Source of Truth

Your business logic lives in one place. When you fix a bug or add a feature, it's immediately available to all languages after regenerating bindings.

```rust
// Core Rust implementation
#[uniffi::export]
pub fn validate_transaction(tx: Transaction) -> Result<ValidationResult, ValidationError> {
    // Complex validation logic here - write once
    // Automatically available in Python, Swift, Kotlin, Go, Ruby
}
```

### 2. Native Performance Everywhere

Because Rust compiles to native code without a runtime, your library performs well on:
- iOS and Android mobile apps
- Python data science tools
- Go microservices
- Ruby web applications

No GIL issues in Python, no garbage collection pauses, no warm-up time.

### 3. Type Safety Across Languages

UniFFI preserves your Rust types across language boundaries:

```rust
#[derive(uniffi::Record)]
pub struct User {
    pub id: u64,
    pub name: String,
    pub email: Option<String>,
}

#[derive(uniffi::Enum)]
pub enum UserStatus {
    Active,
    Suspended { reason: String },
    Deleted,
}
```

This becomes:
- Python: dataclasses with proper types
- Swift: native structs and enums with associated values
- Kotlin: data classes and sealed classes
- Go: structs with proper types

### 4. Consistent Error Handling

Define errors once in Rust:

```rust
#[derive(uniffi::Error)]
pub enum ApiError {
    NetworkError { message: String },
    InvalidCredentials,
    RateLimitExceeded { retry_after: u64 },
}
```

UniFFI converts these to idiomatic exceptions or Result types in each target language.

### 5. Drastically Reduced Maintenance

Consider the maintenance burden:

**Without UniFFI:**
- 5 language implementations = 5× the code
- 5× the testing surface
- 5× the bug fixes
- Constant version drift

**With Rust + UniFFI:**
- 1 core implementation + thin binding layer
- Test the core once, integration test the bindings
- Fix bugs once, works everywhere
- Versions stay in sync automatically

## The Architecture

Here's how we approach laying out a multi-language library with Rust + UniFFI:

```
my-library/
├── core/              # Core Rust implementation
│   ├── src/
│   │   ├── lib.rs
│   │   └── api.udl   # UniFFI interface definition
│   └── Cargo.toml
├── bindings/
│   ├── python/        # Python bindings + packaging
│   │   ├── src/       # Generated Python code (from UniFFI)
│   │   ├── pyproject.toml
│   │   └── setup.py
│   ├── swift/         # Swift bindings + packaging
│   │   ├── Sources/   # Generated Swift code (from UniFFI)
│   │   └── Package.swift
│   ├── kotlin/        # Kotlin bindings + packaging
│   │   ├── src/       # Generated Kotlin code (from UniFFI)
│   │   ├── build.gradle.kts
│   │   └── pom.xml
│   └── go/            # Go bindings + packaging
│       ├── *.go       # Generated Go code (from UniFFI)
│       └── go.mod
└── examples/          # Usage examples in each language
```

**Important:** UniFFI generates the language-specific binding code, but it doesn't create the packaging and build files needed for each ecosystem. You'll need to provide:
- `pyproject.toml` or `setup.py` for Python (PyPI)
- `Package.swift` for Swift (Swift Package Manager)
- `build.gradle.kts` or `pom.xml` for Kotlin (Maven/Gradle)
- `go.mod` for Go (Go modules)
- `Cargo.toml` configuration for the bindings
- Platform-specific build scripts or CI/CD workflows

The workflow:
1. Implement features in Rust
2. Define public API in `.udl` or use macros
3. Run UniFFI code generation
4. Update version numbers in language-specific package files
5. Package bindings for each language's ecosystem (PyPI, CocoaPods, Maven, go modules)

## When to Choose Rust + UniFFI

This approach is ideal when:

- **You're building a library or SDK** used by multiple languages
- **Performance matters** - mobile apps, data processing, cryptography
- **Correctness is critical** - financial systems, security tools, infrastructure
- **You need mobile support** - iOS and Android apps
- **You want to avoid vendor lock-in** - not tied to a specific runtime or platform
- **Your team values maintainability** - over initial development speed

It's **less ideal** when:
- You only need to support one language
- Your logic is primarily I/O-bound with no computation
- You need extremely rapid prototyping (though Rust has gotten much faster to develop in)
- Your team has no one comfortable with Rust (though the learning investment pays off)

## Getting Started

If you're convinced, here's how to start:

1. **Learn Rust basics** - Focus on ownership, borrowing, and error handling
2. **Build a small Rust library** - Implement core logic
3. **Add UniFFI** - Start with one target language using the [UniFFI documentation](https://mozilla.github.io/uniffi-rs)
4. **Generate bindings** - See your Rust code callable from Python/Swift/Kotlin
5. **Expand** - Add more languages as needed

We've found this approach transformative for our own work. Our [SLIM messaging library](https://github.com/agntcy/slim) uses Rust + UniFFI to provide consistent, high-performance messaging across Go, Python, and mobile platforms—all maintained by a small team.

## Conclusion

For teams building libraries that need to support multiple languages, Rust + UniFFI offers a practical solution to the maintenance burden of parallel implementations.

By choosing Rust as your base language and UniFFI for bindings, you get:
- ✅ Write logic once
- ✅ Native performance everywhere
- ✅ Type safety across language boundaries
- ✅ Memory safety without garbage collection
- ✅ Dramatically reduced maintenance burden

The initial investment in learning Rust and setting up UniFFI pays off when you add features, fix bugs, or expand to new languages. For teams with limited engineering resources, consolidating your core logic into a single, well-tested implementation makes a lot of sense.

---

*Interested in seeing Rust + UniFFI in action? Check out our [complete guide to integrating Rust and Go](/2026/01/20/integrating-rust-and-go-with-uniffi.html) or explore the [SLIM messaging library](https://github.com/agntcy/slim). Have questions? Join our [Slack community](https://join.slack.com/t/agntcy/shared_invite/zt-3hb4p7bo0-5H2otGjxGt9OQ1g5jzK_GQ) or check out our [GitHub](https://github.com/agntcy).*
