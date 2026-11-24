# Product brief

## Working concept

A runner provides a race goal, schedule constraints and recent training history. The app creates a structured training plan, explains the inputs and rules behind it, and gives the runner a clear way to adjust it as circumstances change.

The differentiator to explore is **personalized, explainable planning**. Activity import is an input, not the product by itself.

## Initial audience hypothesis

Recreational road runners who track their runs, have a goal race, and want a plan that fits their actual training history and available days. The first end-to-end example is marathon planning, informed by an existing personal marathon plan. This audience choice is a hypothesis to validate through discovery.

## Problem hypothesis

Generic schedules can be hard to map to a runner's current consistency, race date, weekly availability and everyday constraints. Runners may also struggle to understand why a schedule has a particular progression or what to do after missing sessions.

## Product principles

1. **Explain recommendations:** show the inputs, assumptions and rules that shaped the plan.
2. **Separate evidence from estimates:** label imported activity metrics, user-provided facts and model estimates distinctly.
3. **Respect uncertainty:** incomplete or irregular history should result in conservative defaults and visible caveats.
4. **Keep the runner in control:** edits and adjustments are reviewable; the app does not silently rewrite a plan.
5. **Minimize sensitive data:** collect only what is needed; do not retain routes or raw activity exports longer than needed.
6. **Make safety boundaries clear:** offer general training guidance, not diagnosis or injury treatment.

## First-version scope

- Email/password account creation and sign-in.
- Runner intake: race date, distance, goal, experience, available training days and typical weekly volume.
- Strava activity CSV upload and parsing for running activity history.
- Private raw-upload storage in the user's storage path; derived summaries in the user's Firestore data.
- A transparent plan-generation function using explicit, versioned rules.
- A plan dashboard with weekly mileage, workout type, effort/pace guidance, rationale and assumptions.
- Save and retrieve the user's plans; show when a plan was generated and which methodology version it used.
- Local development against Firebase Auth, Firestore, Storage and Functions emulators.

## Not in the first version

- Direct Strava OAuth/API connection.
- Injury diagnosis, rehabilitation plans, nutrition prescriptions or guarantees of race outcomes.
- Automatic plan adaptation from wearable streams or heart-rate data.
- Payments, subscriptions, coach marketplace or social features.
- Multi-sport plans or support for every race distance.

## Initial measures of success (hypotheses)

- A new runner can create an account, import a supported activity file and generate a plan without developer help.
- A runner can identify why the plan starts at its initial volume and how the target pace was estimated.
- The plan fits the selected days and race date, and its schedule arithmetic is internally consistent.
- In early usability sessions, runners can explain what they would do after a missed or unusually hard week.

Do not present these as achieved outcomes until measured with users and recorded in project notes.

## Open product questions

- Which first user segment and race distance should discovery prioritize?
- Which history window is enough to establish a safe starting point, and how should sparse history be handled?
- Which adjustments can be safely suggested from training logs alone?
- What evidence would make runners trust the recommendations?
- What data should be deleted after import, and what retention controls should the user have?
- What marketing promise can be supported by the product and its evidence?
- Is a paid product desirable, and what value would justify a price?
