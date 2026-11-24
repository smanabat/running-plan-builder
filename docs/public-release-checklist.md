# Public repository checklist

## Reviewed for this initial publication

- No personal name, email, home/work location, race date, race target or personal activity records are included in source files.
- Sample histories are synthetic and use relative week offsets.
- Raw activity exports, GPX/FIT files, generated build output, emulator logs and local environment files are excluded by `.gitignore`.
- Firebase configuration uses the demo project ID and placeholder client values; no production project or service-account key is included.
- The dependency lockfile is included for reproducible installs.
- Local commit metadata is scrubbed to a generic project identity before public push.

## Still required before broad reuse or deployment

- Choose and add a license. A public GitHub repository can be viewed, but without a license others do not receive a general grant to reuse the code.
- Confirm the GitHub owner account and repository name before creating the remote.
- Keep the first public repository limited to source, documentation and synthetic fixtures; do not push private activity files or local emulator exports.
- Use a separate Firebase project for any hosted demo. Keep credentials in environment/secret configuration and never commit them.
- Get coaching review and privacy/security review before accepting real runners or making stronger training claims.
- Do not publish this MVP as a production training service until retention, deletion, abuse prevention, monitoring and legal terms are defined.

## Before each push

```sh
git status --short
git diff --check
git ls-files
```

Review staged content, ignored/untracked files and commit history. If a secret or private activity record was ever committed, removing it in a later commit is insufficient; rewrite the affected history and rotate the exposed credential where relevant.
