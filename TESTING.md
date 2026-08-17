# Frontend testing

The Playwright suite covers frontend behaviour without requiring a live BFG backend. API calls used by a test are intercepted in the browser and answered with controlled fixtures.

## Local mocked tests

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

Playwright builds and starts the Next.js app with a placeholder API URL.

## Existing Tailnet environment

To run the same browser tests against an already deployed frontend:

```bash
E2E_BASE_URL=http://192.168.110.195:<frontend-port> npm run test:e2e
```

Use the complete frontend URL supplied by the environment owner. A machine running this command must already have Tailnet access. Do not commit test passwords or Tailscale credentials; store them in local environment variables or GitHub Actions secrets.
