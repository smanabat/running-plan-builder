# DECISION-0002: Use Firebase with emulator-first development

- **Date:** 2026-11-24
- **Status:** Accepted
- **Owners:** Project owner

## Context

The requested product needs authentication, private activity uploads, user-scoped plans, backend generation and a full local development environment.

## Decision

Use React/TypeScript with Firebase Authentication, Cloud Firestore, Cloud Storage and TypeScript Cloud Functions. Run local development against the Auth, Firestore, Storage and Functions emulators using the `demo-running-plan` project ID. Use CSV import first and keep plan structure deterministic and versioned.

## Consequences

The project gets a cohesive local stack and clear server-side boundary. Production deployment still requires separate project setup, security review, retention policy, App Check, monitoring and operational configuration. The choice can be revisited if product needs outgrow Firestore.

## Review trigger

Revisit after the first end-to-end workflow or if user research introduces requirements that make Firebase an unsuitable fit.
