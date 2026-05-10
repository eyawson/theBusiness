# Project Context

## What this project is
Yawstone marketing site — the public web presence for a consultancy that bundles three service lines under one brand: Web Design Studio, ServiceNow Consultancy, and Cybersecurity Advisory (per the home-page meta description and `#services` section). The site is a four-page Vite build: a home page (`index.html`) with the headline pitch and a contact form, plus one deep-dive landing page per service. The contact form on the home page POSTs JSON to an AWS API Gateway endpoint that fronts an Amplify-managed Lambda (see `amplify-api-payload.json` — `contactapi` → `/contact` → `contactfunction`); the rest of the site is fully static.

## Stack
- Framework: Vite 7 (multi-page app, no SPA framework)
- Language: Vanilla JavaScript (ES modules) + HTML + CSS — no TypeScript
- Package manager: npm — use this one
- Styling: Plain CSS in `src/css/style.css` (single shared stylesheet)
- State: N/A (static site)
- Testing: None configured. No test runner, no `test` script in `package.json`. A clean `npm run build` is the only automated correctness signal.
- Backend / hosting: AWS Amplify (`amplify/` directory, `aws-exports.js`, `amplifyconfiguration.json`)

## Commands
- `npm run dev` — start Vite dev server
- `npm run build` — production build (outputs to `dist/`)
- `npm run preview` — preview the production build locally
- `amplify push` — deploy Lambda + API + hosting changes to AWS (run by user, not Claude)

## Environment variables
- `VITE_CONTACT_API_URL` — contact API Gateway URL. Read by `src/js/main.js` at build time. Public (ships in the JS bundle), but env-var-ized so stage promotion is a config change, not a code change. Defaults live in `.env`; per-developer overrides in `.env.local` (gitignored).
- Lambda runtime: `FROM_ADDRESS`, `TO_ADDRESS`, `REGION`. Defaults hardcoded to `yawson@yawstone.com` / `us-east-1`. Set via Amplify Lambda env vars to override.

## Folder conventions
- HTML entry points live at the **repo root**, not in `src/` — `index.html`, `web-design.html`, `servicenow.html`, `cybersecurity.html`. Each is registered as a Rollup input in `vite.config.js`; **add new pages there** when introducing one.
- `src/css/style.css` — single shared stylesheet for all pages
- `src/js/main.js` — shared JS entry
- `src/assets/images/` — image assets referenced from CSS/HTML
- `public/` — static files served as-is (currently empty)
- `amplify/` — AWS Amplify backend config (mostly auto-generated; respect the `#amplify-do-not-edit` regions)
- `dist/` — build output (gitignored)

## Conventions Claude should follow
- Match surrounding formatting; don't reformat unrelated lines
- Prefer editing the existing shared `style.css` and `main.js` over fragmenting into new files unless the file is getting unwieldy
- When adding a new page, register it in `vite.config.js` `rollupOptions.input` — Vite will not pick it up otherwise
- Inline background images in HTML break the Vite asset pipeline (this has bitten us before — see commit `fb5dc4e`). Move them into CSS classes that reference `src/assets/images/...` so Vite bundles them.
- Don't add dependencies without flagging them — this site is intentionally dependency-light
- Don't touch files inside `amplify/#current-cloud-backend` or anything between the `#amplify-do-not-edit` markers in `.gitignore`-adjacent configs
- Don't commit, push, or deploy
- Run `npm run build` before declaring work done — there's no lint/typecheck, so a clean build is the basic correctness signal

## Known sharp edges
- `aws-exports.js` and `amplifyconfiguration.json` are **gitignored** — they exist locally but won't be in fresh clones; expect Amplify CLI to regenerate them
- Multi-page setup means there is no shared layout/header component — changes to nav/footer must be applied to each `*.html` file
- All four HTML pages load the **same** `/src/js/main.js`. Page-specific behavior in `main.js` is gated by element-existence checks (e.g., `if (contactForm)`, `if (hero && glow)`) — when adding new behavior, follow that pattern so it no-ops on pages where the elements don't exist.
- Scroll-reveal animations: elements matching the selector list in `main.js` get `.fade-up-element` added at runtime and stay invisible until `IntersectionObserver` flips them visible. If JS fails to load, those sections never appear. Keep critical above-the-fold content out of the animation selector if you want it visible without JS.
- **Fonts (Clash Display, Inter) load from Google Fonts CDN** in each HTML head, not bundled by Vite. Every page makes external font requests on load — relevant for offline dev, CSP, and any privacy review. Slated for self-hosting in a future hardening pass.
- Footer year is hardcoded (`© 2026 Yawstone` in `index.html:244`) — bump it manually each January.

### Federal credibility — do not break these invariants
- **Legal entity name** is **Yawstone Holdings LLC**. Use this in formal/federal contexts (footer copyright, federal capability section, capability statement). The brand name "Yawstone" is fine in marketing copy and headers.
- **EIN is PRIVATE** — never goes on the website, in this repo, in client-facing copy, or in any public artifact. Treat like a tax-document-only field. (User flagged this explicitly 2026-05-10.)
- **Federal markers (CAGE `1P6B0`, UEI `Q8YDG3NQZGB1`, NAICS `541512` primary / `541511` / `541519`, PSC `DA01 DD01 DF01 DG01`, SDB) and certifications (CSA, CIS-Discovery, CIS-Service Mapping, CIS-SAM Pro, CAD, ITIL v4 Foundation, CompTIA Security+, Active Secret) are user-confirmed and may be displayed verbatim.** Do not paraphrase, abbreviate, or reorder the alphanumeric codes.
- The federal capability section lives on `/servicenow.html#federal` and `/cybersecurity.html#federal`. The home page has a smaller callout linking to the SN page's federal section. Footer markers (CAGE/UEI/NAICS line) appear on all four pages.
- Active Secret clearance is held by the **principal** (a person), not the entity. Phrase accordingly — never "Yawstone is cleared at Secret."
- Framework language (NIST/FISMA/FedRAMP/RMF/CMMC/Section 508) is fine as **alignment / awareness**, not as authorization claims. "FedRAMP-aware," not "FedRAMP authorized."
- Contract Vehicles statuses are time-sensitive: **SAM.gov Direct = Active, GSA Schedule = In Progress, DemandStar/BidNet = Coming Soon** as of 2026-05-10. Update when status changes.

### Contact form / Lambda — do not break these invariants
- The form submits a `_t` field (ms since DOMContentLoaded) and a `company` honeypot field. The Lambda silently returns `{ ok: true }` if `company` is non-empty OR `_t < 1500`. Any client-side change to the form must preserve both fields and the render-time capture. Any test or curl against the Lambda must include `_t >= 1500` and omit `company`.
- The Lambda allows CORS only from `https://yawstone.com`, `https://www.yawstone.com`, and `http://localhost:5173`. Adding a new origin (staging domain, preview build) requires editing `ALLOWED_ORIGINS` in `amplify/backend/function/yawstoneContactFunction/src/app.js` and redeploying.
- The Lambda only accepts `POST /contact`. The previous `GET/PUT/DELETE/*-catchall` stub routes were removed as recon surface — do not re-add them when refactoring.
- Lambda code changes require `amplify push` to take effect — purely local edits to `amplify/backend/function/...` do nothing until pushed.

### Security headers — manual mode caveat (read this before touching headers)
- **`customHttp.yml` at the project root is currently INERT.** Amplify Hosting only processes that file for git-connected continuous-deployment apps. This app is in manual deploy mode (`amplify/backend/backend-config.json` → `hosting.amplifyhosting.type: "manual"`), so the file is ignored. Verified empirically 2026-05-10 — `curl -sI https://www.yawstone.com/` returned zero security headers despite the file being in the repo.
- **Headers are managed via the Amplify Console UI.** AWS Amplify Console → your Yawstone app → Hosting → Custom headers. The Console accepts the same YAML structure as `customHttp.yml` — keep the two in sync manually until hosting moves to continuous deployment.
- The `customHttp.yml` file is kept in the repo as the source-of-truth document and as ready-to-go config for if/when hosting migrates to continuous deployment. Treat it as a reference; do not rely on it being applied.
- CSP is intentionally pragmatic: `script-src 'self'` is strict (zero inline scripts in this repo, verified), but `style-src-attr 'unsafe-inline'` is allowed because there are ~53 inline `style=""` attributes across the four pages. Refactoring those to classes would let us drop the allowance — that's a separate cleanup pass, not blocking.
- `style-src` and `font-src` currently include `https://fonts.googleapis.com` / `https://fonts.gstatic.com` because we still load fonts from Google's CDN. **Phase 3.5 (queued):** self-host Clash Display + Inter and tighten both directives to `'self'` only. See "Phase 3.5 follow-ups" below for the steps.
- `connect-src` allows `https://*.execute-api.us-east-1.amazonaws.com` so the contact form can post regardless of which API Gateway stage is active. Specific to us-east-1 — change if the API moves regions.
- HSTS is set with `preload` directive (max-age 1 year, includeSubDomains). **The header alone does not put yawstone.com on the browser preload list** — to actually preload, submit at https://hstspreload.org/. Submission is one-way for practical purposes (removal takes weeks); only submit when HTTPS is locked in across yawstone.com and all subdomains.
- After deploy, verify headers landed via `curl -sI https://yawstone.com/` or https://securityheaders.com/?q=yawstone.com.

### Phase 3.5 follow-ups (queued, not started)
- **Self-host Clash Display + Inter.** Steps: download .woff2 (Clash Display from https://fontshare.com/, Inter from `npm install @fontsource-variable/inter` or rsms.me); place files in `public/fonts/`; add `@font-face` rules in `style.css`; remove the Google Fonts `<link>` tags from all four HTML heads; tighten CSP `style-src` / `font-src` to `'self'` only in `customHttp.yml`. License check on Clash Display before committing the .woff2 to git.
- **Refactor inline `style=""` attributes to classes.** ~53 occurrences across the four pages (servicenow.html and cybersecurity.html have 19 each, mostly section/card style overrides). Removing them lets us drop `style-src-attr 'unsafe-inline'` from CSP for full strict-styles posture.
- **Migrate Amplify Hosting from manual to git-connected continuous deployment.** Prerequisites: (a) commit everything in flight; (b) gitignore `.env`; (c) review `amplify/team-provider-info.json` and other state files for deployment-bucket refs before pushing; (d) push to `origin/master` (https://github.com/eyawson/theBusiness.git). Then in AWS Console → Amplify → app → Hosting environments → Connect a branch → authorize GitHub → pick `eyawson/theBusiness` `master`. Amplify auto-detects Vite and generates `amplify.yml`. Once the first git-connected build succeeds, `customHttp.yml` at the repo root becomes authoritative — remove headers from Console UI to prevent drift. Verify the domain (yawstone.com / www.yawstone.com) routes to the new branch environment after migration. **Risk:** if you skip step (b)/(d) and connect to a stale `master`, the live site reverts to the pre-session state.
- **API Gateway throttle is set in the AWS console (10 rps / 20 burst), not in source.** The Amplify-generated CF template at `amplify/backend/api/contactapi/build/contactapi-cloudformation-template.json` does not include an `AWS::ApiGateway::Stage` resource (only `Deployment`), so CloudFormation does not manage stage settings — console-set throttle persists across normal `amplify push`. It would be lost only on full API destroy/recreate (`amplify remove api` + `amplify add api`) or a future Amplify CLI version that begins managing the stage. Robustness improvement: `amplify override api` to pin `MethodSettings` in source — not urgent.
- **Cognito auth backend is provisioned but unused.** `amplify/backend/backend-config.json` declares `auth.yawstone` (Cognito), but no client code references it. Either wire it up or remove it via `amplify remove auth`; unused infra is attack surface.
- **`event.json` sample event** lives in the Lambda src directory — verify it doesn't contain real PII before pushing further changes.
