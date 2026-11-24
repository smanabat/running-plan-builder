# Training-plan methodology

## Status

This is the product's initial planning policy. It is a transparent prototype, not a clinically validated or coach-approved training method. The rules must be reviewed and refined with qualified coaching expertise before the product makes stronger claims.

## Inputs

- User-provided race distance, race date, goal and weekly availability.
- User-provided experience and current typical weekly distance.
- Imported running activity dates, distances and durations when available.
- The source, date range, completeness and parsing status of imported data.

Do not infer injury status or medical readiness from activity history. Ask only for information that is needed for a clearly defined feature, and do not present it as medical screening.

## Initial generation approach

Use deterministic, versioned rules for schedule structure and calculations. Use language generation only to explain structured results in plain language; it must not change calculated dates, volumes, workout counts or safety constraints. The first implementation may use fixed explanation templates rather than a language model.

The planner should:

1. Validate the race date, distance, available days and training history.
2. Summarize recent weekly activity and show gaps or unusual spikes.
3. Choose a conservative starting load based on the runner's recent consistent training, not the single largest week or workout.
4. Increase training gradually, schedule recovery weeks and reserve a taper before race day.
5. Respect selected training days and keep the number of harder sessions limited.
6. Estimate paces only when the evidence supports it; otherwise use effort descriptions and mark pace estimates as uncertain.
7. Include a rationale, assumptions, data coverage and methodology version with each plan.

## Current limitations

- Activity records alone cannot establish recovery, injury status, life stress or training intent.
- Pace calculations may be distorted by terrain, weather, stops, treadmill runs and device measurement error.
- A recent race result or validated threshold is stronger evidence for pace targets than generic estimates.
- The current prototype does not have coach validation or prospective outcome data.

## Review required before launch

- Get qualified coaching review of progression, workout balance, taper and adjustment rules.
- Define conservative behavior for sparse, inconsistent, duplicate or malformed activity records.
- Define clear escalation language for pain, illness and other medical concerns.
- Evaluate the planner against a documented set of edge cases and coach-reviewed examples.
- Measure whether users understand the rationale and limitations.
