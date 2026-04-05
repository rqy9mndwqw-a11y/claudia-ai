---
name: No hardcoded credential fallbacks
description: Never use hardcoded API keys, project IDs, or credentials as fallback values anywhere in code
type: feedback
---

Never put hardcoded API keys, WalletConnect project IDs, or any credentials as fallback values in code. If an env var is missing, the app should fail visibly — empty string or throw, never a silent fallback to a real value.

**Why:** User has corrected this multiple times. Hardcoded fallbacks mask missing configuration and create security risks. The pattern `|| "some_real_id"` is never acceptable for credentials.

**How to apply:** For any `process.env.X` or `import.meta.env.X` that holds a credential/key/ID, use `|| ""` or throw an error. Never provide a working default.
