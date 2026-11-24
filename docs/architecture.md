# Architecture and solution choices

## Goals

- Run the complete product locally without connecting to production services.
- Keep authentication, uploaded data and plans scoped to each user.
- Keep plan calculations deterministic and inspectable.
- Separate the interface, cloud boundary and training rules so each can evolve independently.
- Avoid committing private activity data or credentials.

## Selected stack

| Area | Choice | Reason |
| --- | --- | --- |
| Web client | React, TypeScript, Vite | Fast local iteration, typed UI boundaries and simple static deployment. |
| Authentication | Firebase Authentication | Email/password sign-in and local Auth emulator support. |
| Application data | Cloud Firestore | User-owned plan and import metadata, realtime reads, emulator support. |
| File storage | Cloud Storage for Firebase | Private per-user upload path and Storage emulator support. |
| Backend | Firebase Cloud Functions, TypeScript | Server-side validation and plan creation without exposing privileged writes in the browser. |
| Local services | Firebase Emulator Suite | Auth, Firestore, Storage, Functions and Emulator UI run against a demo project ID. |
| Hosting (future) | Firebase Hosting or Cloud Run/static hosting | Decide after the local MVP and portfolio deployment needs are clearer. |

## Local request flow

1. The user creates an account or signs in through the Auth emulator.
2. The browser parses a supported activity CSV and displays a preview before upload.
3. The raw file is uploaded to `users/{uid}/imports/{importId}/source.csv` in the Storage emulator. The app stores only import metadata and derived summary in Firestore.
4. The browser calls the authenticated `generateTrainingPlan` callable function with validated goal/preferences and derived activity summary.
5. The function applies versioned deterministic rules and writes a plan document under `users/{uid}/plans/{planId}`.
6. The browser reads the plan from Firestore, subject to owner-only security rules.

## Data boundaries

Firestore layout:

```text
users/{uid}
users/{uid}/imports/{importId}
users/{uid}/plans/{planId}
```

The app must not upload or persist GPS tracks, route maps, activity names, athlete names, device identifiers, Strava IDs or exact original timestamps in generated fixtures. Production data retention and deletion behavior must be documented before deployment. The local MVP will include a delete-import action and avoid logging CSV contents.

The CSV import is processed in the browser. Only a bounded derived summary is sent to the function; the raw file remains in private Storage until the user deletes it. A later production version should consider transient parsing and automatic source-file expiry.

## Security posture

- Firebase Auth ID token is required for callable plan generation.
- Functions validate input shape, numeric ranges and payload size; never trust client calculations blindly.
- Firestore rules allow users to read/write only their own allowed user-scoped documents. Plan generation writes are server-owned.
- Storage rules allow authenticated owners to upload/read/delete only their own bounded CSV import objects.
- App Check, rate limiting/quotas, abuse protection, retention policy and production secret management are required before public launch.
- Do not commit production Firebase configuration, service account keys or secrets.

## Why CSV first

An export-based import keeps the first product independent from third-party OAuth review, ongoing API changes and external account access. It is adequate for validating the core workflow. Direct Strava integration can be considered after usability validation and a review of current platform requirements.

## Why deterministic planning first

Training structure and arithmetic should be reproducible and reviewable. The application can show the exact rules and assumptions used for a plan. A language model may explain the result later, but should not invent or mutate workouts outside validated constraints.

## Operations and environments

- Local: Firebase emulators with `demo-running-plan`; no production project configured.
- Preview/production: separate Firebase projects, explicit environment configuration, Firestore and Storage rules deployed from source, backups and monitoring configured before real user data is accepted.
- Emulator export/import may be used for repeatable development data, but fixtures must be synthetic or de-identified.

## Alternatives considered

- **Direct Strava OAuth first:** deferred to avoid spending initial effort on integration before the planning workflow is useful.
- **LLM-generated schedule:** rejected for first release because schedule details need deterministic constraints and auditable calculations.
- **Single client-only application:** rejected because owner-scoped data rules and plan generation need a trusted backend boundary.
- **Cloud SQL:** not selected for the first version because the MVP is document-oriented and benefits from the Firebase emulator workflow; reconsider if relational reporting or complex cross-user queries become central.

## Known trade-offs and follow-up decisions

- Firestore has query and indexing constraints; schema should stay user-scoped and avoid cross-user analytics by default.
- Keeping a raw source CSV aids reprocessing but increases privacy impact. Add retention controls before deployment.
- Firebase emulator workflows are convenient but do not prove production IAM, billing, App Check or operational readiness.
- Production region, backup policy, analytics, observability, privacy terms and deployment pipeline remain undecided.
