# Personalized Running Plan Builder

A portfolio project exploring how a running plan can use activity history and runner preferences while keeping its recommendations understandable and adjustable.

**Current status:** local-first MVP in development. The product is a planning aid, not a medical device or a substitute for a qualified coach.

## Run locally

Requirements: Node.js 22 or later, Java 21 or later (for Firebase emulators), and Firebase CLI.

```sh
npm install
npm run dev
```

The development command starts Firebase Auth, Firestore, Storage and Functions emulators, then starts the web app. Emulator UI is available at http://127.0.0.1:4000. The web app is available at http://127.0.0.1:5173.

Set up a local environment file before running:

```sh
cp web/.env.example web/.env.local
```

The emulator configuration uses the non-production project ID `demo-running-plan`. Emulator data is local and is not connected to a live Firebase project.

## Repository map

- `web/` — React, TypeScript and Vite application.
- `functions/` — Firebase callable Cloud Functions and plan-generation rules.
- `firestore.rules`, `storage.rules` — user-scoped data access rules.
- `docs/product-brief.md` — product direction and first-version scope.
- `docs/architecture.md` — architecture, security and solution choices.
- `docs/methodology.md` — plan-generation assumptions and decision rules.
- `docs/public-release-checklist.md` — publication and deployment checks.
- `SECURITY.md` — security reporting and prototype limits.
- `decisions/` — dated decision records and a reusable template.
- `notes/` — discovery and project notes; do not put raw personal data here.
- `fixtures/` — synthetic and de-identified test inputs only.

## Project source material

The first product example is a personal marathon plan from a separate working project. It is inspiration and a prototype, not evidence that the product has been validated with other runners. Raw activity exports, GPX/FIT files, account identifiers, route coordinates and exact activity names do not belong in this repository.

## Working agreements

- Record durable product or technical choices in `decisions/`.
- Capture hypotheses and open questions in `notes/`; move confirmed decisions into a decision record.
- Never commit credentials, live Firebase configuration, raw activity exports, route data or personally identifying data.
- Choose a license before inviting code reuse; see the public-release checklist.
