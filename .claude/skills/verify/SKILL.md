---
name: verify
description: Run build and tests to verify the project is in a good state before shipping
---

Run the full verification suite and report results:

1. **Build** (includes typecheck): `bun run build`
2. **Tests**: `bun run test`

Run both commands sequentially. If the build fails, still attempt tests so the user gets a complete picture.

Report a clear pass/fail summary at the end. For failures, quote the relevant error lines — don't just say "it failed".
