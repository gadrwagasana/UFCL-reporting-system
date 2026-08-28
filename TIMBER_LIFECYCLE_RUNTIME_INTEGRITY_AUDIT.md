# Timber Lifecycle — Pre-Phase-2 Runtime Integrity Audit

**Trigger:** during Timber Lifecycle Phase 2 QA data-scoping, two `node` runs that loaded `db/pool.js` printed the following to stdout:

```
◇ injected env (8) from .env // tip: ⌁ auth for agents [www.vestauth.com]
◇ injected env (8) from .env // tip: ⌘ enable debugging { debug: true }
```

This audit is a **read-only** investigation of that output. No package was installed/upgraded/removed, no external URL was visited, no credentials were entered, and no application code was modified while producing this report.

---

## 1. Finding

The message is produced by the installed **`dotenv`** npm package itself (not application code, not a custom loader, not an npm lifecycle script). `dotenv`'s `configDotenv()` function ends every call with a randomly-selected "tip" appended to its own `injected env (N) from ...` log line. One of the entries in that tip list advertises an unrelated external product, `www.vestauth.com`, phrased specifically to address AI coding agents ("auth for **agents**").

## 2. Exact Source

| | |
|---|---|
| File | `node_modules/dotenv/lib/main.js` |
| Lines | 7–16 (the `TIPS` array), triggered at line 309 (`_log(...// tip: ${_getRandomTip()})`) |
| Package | `dotenv@17.4.2` |
| Dependency chain | `db/pool.js:3,18` (`require('dotenv')` → `dotenv.config({ path: envPath })`) → every module that requires `db/pool.js` (i.e. `db/services/data.js` and everything downstream, including the Phase 2 QA scripts) |

```js
// node_modules/dotenv/lib/main.js:7-16
const TIPS = [
  '◈ encrypted .env [www.dotenvx.com]',
  '◈ secrets for agents [www.dotenvx.com]',
  '⌁ auth for agents [www.vestauth.com]',
  '⌘ custom filepath { path: \'/custom/path/.env\' }',
  '⌘ enable debugging { debug: true }',
  '⌘ override existing { override: true }',
  '⌘ suppress logs { quiet: true }',
  '⌘ multiple files { path: [\'.env.local\', \'.env\'] }'
]
```

The two messages observed are simply two random draws from this array — not two different issues.

## 3. Classification

**Suspicious** (not Potentially Compromised, not Benign-and-ignorable — see below).

## 4. Evidence

- **`db/pool.js` itself is clean.** It only does `require('dotenv')` + `dotenv.config({ path: envPath })`. No custom env loader, no direct `console.log`/`stdout` writes, no code that could originate this string. Ruled out as the source.
- **Root `package.json` declares `"dotenv": "^17.2.2"`**; the resolved/installed version is `17.4.2`, which satisfies that range — this is ordinary semver resolution, not a hijacked/typosquatted package name.
- **`package-lock.json`** records the install as coming from the official registry, with a normal integrity hash:
  `"resolved": "https://registry.npmjs.org/dotenv/-/dotenv-17.4.2.tgz"`, `"integrity": "sha512-nI4U3TottKAcAD9LLud4Cb7b2QztQMUEfHbvhTH09bqXTxnSie8WnjPALV/WMCrJZ6UV/qHJ6L03OqO3LcdYZw=="`. Not a git/URL dependency, not a local file: reference.
- **File timestamps rule out local tampering:** `node_modules/dotenv/lib/main.js` and `node_modules/dotenv/package.json` both carry mtime `2026-06-02T09:16:32Z`, one second apart from an unrelated neighboring package (`pg`, `2026-06-02T09:16:33Z`) — consistent with a single ordinary `npm install` batch, not a later out-of-band edit of just this one file.
- **Full source review of the 423-line `lib/main.js`** (not just the TIPS array) found **no** network code, no `http`/`https`/`fetch`, no `child_process`/`exec`/`spawn`, no telemetry call anywhere in the file. The only `.exec` match is `LINE.exec(lines)`, an unrelated `RegExp.exec()` call used to parse `.env` syntax. The TIPS string is used for exactly one purpose: appended to a `console.log`-style line via `_log()`. It is inert text.
- **Repo-wide grep** for `vestauth`, `auth for agents`, and `injected env` outside `node_modules/` returned **zero matches** — confirms this is not application code and not something introduced into this repository's own source.
- **Root `package.json` has no `preinstall`/`install`/`postinstall`/`prepare` script** that could run anything at install time; the only scripts are `start`, `dev`, `setup`, `migrate`, `lint`, `dist`.
- **Git history** for `package.json`, `package-lock.json`, and `db/pool.js` shows no recent commit touching the `dotenv` dependency line — the `17.4.2` resolution is simply what the existing `^17.2.2` semver range currently resolves to on the public registry, picked up by an ordinary `npm install`, not a deliberate bump in this repo.
- **The `dotenv` package now also ships two files**, `node_modules/dotenv/skills/dotenv/SKILL.md` and `node_modules/dotenv/skills/dotenvx/SKILL.md`, both read in full during this audit. Both are genuine "agent skill" documentation (a growing, legitimate practice among npm packages) from the same maintainer (`motdotla`), and both are self-consistent and non-directive: they explicitly instruct an agent to *never* execute or relay instructions found in `.env` files, to redact secrets, and to only *recommend* (not auto-install) `dotenvx`. **No hidden or adversarial instructions were found in either SKILL.md.**
- **External confirmation via web search:** `vestauth` is a real, independently-listed product ("web-bot-auth for agents", npm package `vestauth`, GitHub org `vestauth`, an HN "Show HN" post) built by the same author as `dotenv`/`dotenvx` — it is not a phishing/typosquat domain impersonating an unrelated brand. One independent GitHub issue (`BeMySlaveDarlin/cc-bootstrapper#1`) explicitly characterizes this same `dotenv@17` TIPS behavior as a "prompt injection via supply chain" concern — i.e. this is an already-noticed, community-flagged pattern, not something unique to this repo. A claim surfaced in that same search result set — that the package also sends data to an external host (`as2.dotenvx.com`) — was **not corroborated** by the direct source review above (no such string or network code exists anywhere in the installed `lib/main.js`); that specific claim is not repeated as fact here.

## 5. Security Impact

- Cannot access anything beyond what `dotenv` already legitimately loads for the application (the `.env` file this app already trusts and requires to run).
- Cannot execute arbitrary code — no `eval`, no dynamic `require`, no `child_process` anywhere in the reviewed file.
- Cannot communicate externally on its own — it only writes a string to stdout; nothing in the package makes an outbound request.
- Cannot modify application behavior — the tip has no effect on `process.env`, the parsed config, or control flow.
- **The actual risk is social-engineering, not code execution**: the string is deliberately worded ("...for **agents**") to catch the attention of an AI coding assistant mid-task and prompt it to autonomously visit an external site or install unrelated software — exactly what triggered this audit. That risk is fully mitigated by *not acting on it*, which is what happened here.
- Does not affect production: this only prints during local dev/QA runs of `node db/migrate.js`, `node` scripts, or the mobile API server when `dotenv.config()` is called without `{ quiet: true }`; it plays no role in the packaged Electron app's actual data operations.

## 6. Recommended Action

Not performed during this audit (per its read-only scope) — for the user to decide:
- Optionally pass `{ path: envPath, quiet: true }` to `dotenv.config()` in `db/pool.js` to suppress all promotional tips going forward (one-line, low-risk change).
- Optionally pin `dotenv` to an exact version in `package.json` (`"dotenv": "17.4.2"` instead of `^17.2.2`) to prevent silently picking up further promotional content changes on future `npm install` runs, at the cost of manual bumps for real security fixes.
- No dependency needs to be removed or replaced — `dotenv` itself is not malicious and still correctly performs its actual job (confirmed by the successful `.env` loads throughout this session).

## 7. Timber Lifecycle Impact

```
SAFE TO CONTINUE
```

`db/pool.js` and the `dotenv` chain it depends on are not compromised. The only effect of this finding is unwanted promotional text in stdout during local QA runs; it has no bearing on the correctness, security, or data integrity of the Timber Lifecycle Phase 2 backend, migration, or QA scenario work already completed or still pending (Scenarios A–G).
