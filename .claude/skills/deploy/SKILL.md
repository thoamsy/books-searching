---
name: deploy
description: Build and deploy the app to Cloudflare Workers (opus.thoamsy.me)
disable-model-invocation: true
---

Deploy the application to production:

1. **Build**: `bun run build`
2. **Deploy**: `bunx wrangler deploy`

This deploys the Cloudflare Worker + static assets to `opus.thoamsy.me`.

If the build fails, stop and report the errors — do not deploy a broken build.

After successful deployment, report the deployment URL and version ID from wrangler output.
