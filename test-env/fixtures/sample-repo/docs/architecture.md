# Architecture

The system is composed of:

1. Auth layer - Token validation and JWT verification
2. Database layer - In-memory user storage
3. API layer - HTTP request handling using auth and db
4. Cache layer - Python-based LRU cache
5. Calculator - Go-based math operations
6. Validator - Rust-based input validation
