# BrandGuard AI
## Round 3 Product Documentation

### 1. Project overview

BrandGuard AI is a brand-governance application for reviewing written marketing content against a brand's facts, terminology, claim rules, and voice guidance. It combines deterministic checks with optional Gemini AI analysis and provides workflows for improving, reviewing, comparing, and reporting on content.

The project has a React web interface, a Flask API, and a database layer that supports local SQLite and a PostgreSQL connection path. It starts without sample brands or content; a user must create a brand before running an audit, and can configure that brand's guidelines for brand-specific checks.

This document describes the implementation found in the project source and the latest recorded test evidence. It does not claim that every feature has been tested with a live external provider or production service.

### 2. Problem statement

Organizations publish content across many channels and need it to remain consistent with brand facts, terminology, voice, and applicable claims rules. Manual review can be time-consuming and may miss inconsistencies between content drafts and the current guidelines.

BrandGuard AI provides a structured place to maintain brand guidance and inspect content against it. Its scores and suggestions are decision support: they are not legal approval, factual certification, or a replacement for human review.

### 3. Proposed solution

Users create a brand profile, maintain its guidance, and submit content for a quick check or saved audit. The backend runs deterministic policy checks and, when configured, can also request contextual findings from Gemini. The result includes a score, risk level, category findings, readability information, and suggested corrections.

Users can review suggestions, request an AI rewrite preview, save changes as new versions, compare saved versions, restore an older version as a new draft, record a review decision, and export a saved audit.

### 4. Target users and real-world use cases

- **Brand and marketing teams:** check campaign copy against a shared brand profile.
- **Content editors:** find terminology, tone, readability, or configured-claim issues before publication.
- **Reviewers:** inspect an audited version, record an approval or rejection, and leave review comments.
- **Agencies working with multiple brands:** select the relevant brand profile and review its content separately.
- **Organizations with configured policy rules:** highlight configured claims or factual conflicts for human follow-up.

The application currently has no login or role-based authorization. The reviewer name and role fields record review details; they are not an authentication system.

### 5. Implemented features

#### Brand and guideline management

- Create, view, edit, and delete brand profiles.
- Store approved facts, terminology rules, claim rules, and visual guidelines for a brand.
- Edit guideline records in place and use the selected brand's active guidance during analysis.
- Use brand identifiers to scope brand-specific content operations; APIs that support an optional brand scope validate the association when that scope is supplied.

#### Content input and analysis

- Enter or edit content in the analyzer.
- Upload `.txt`, `.md`, `.markdown`, `.docx`, `.pdf`, or `.json` files for text extraction.
- Submit supported PNG, JPEG, and WebP files to the separate Visual Review workflow.
- Run a quick check or save a content audit.
- Create and save content, reopen or edit saved content, and delete a selected content record with confirmation.
- Review a compliance score, risk level, category scores, findings, readability metrics when available, and correction suggestions.
- Reopen saved content and its saved analysis.

#### Content improvement and review

- Request a Gemini rewrite preview without immediately replacing the original text.
- Apply validated corrections individually or adopt the available corrected text; saving creates a new content version.
- Use manual review where a safe replacement cannot be established or multiple replacements conflict.
- Record approve or reject decisions, reviewer details, and comments against the analyzed version.
- Require a current successful audit in the frontend before enabling Approve or Reject.
- Prevent an approval when the latest current audit contains a critical issue, as covered by backend tests.

#### Versions and reporting

- Inspect version history and compare two saved versions in Side-by-Side or Unified view.
- Distinguish saved-version comparisons from the proposed-correction preview.
- Restore an older saved version as a new current draft. The historical version is retained; the restored draft is marked not audited until it is analyzed again.
- Generate PDF and JSON exports for saved content.
- Include report metadata, audit findings, category scores, and available version and review history in PDF reports.
- Format displayed PDF timestamps in UTC as `DD-MM-YYYY HH:MM UTC`.
- View dashboard statistics for the selected brand.

#### Visual Review scope

Visual Review sends a supported image and brand ID to the backend for a preliminary Gemini review against stored visual guidance. The result can include findings and recommendations. It is not a pixel-measurement or design-certification tool.

### 6. The three Round 2 improvements

#### 6.1 Gemini AI integration for contextual content analysis

When `GEMINI_API_KEY` is configured on the backend, the analysis service can send content together with the selected brand context, including available facts, terminology, claim rules, visual rules, content type, and channel. The service validates the returned structure before accepting AI findings. Deterministic rules run independently and remain the foundation of the audit; validated AI findings are merged with those results.

If Gemini is not configured or a text-analysis response cannot be used, the audit can continue with deterministic rule-based results. The engine used is reported by the backend. Gemini is also used for rewrite previews and the separate image-review endpoint when configured; those features report provider failures rather than showing fabricated results.

The API key is read by the backend from its environment. It is not sent to the frontend. When the relevant feature is used, content, brand guidance, and, for Visual Review, the selected image are sent from the backend to Google's Gemini API.

**Verification status:** automated tests use mocked provider responses and cover validation and failure paths. There is no evidence in the recorded test results of a successful live Gemini request. Live Gemini success therefore remains unverified and depends on a valid backend key, network access, and provider availability/quota.

#### 6.2 Advanced brand compliance analysis

The deterministic engine checks configured terminology; explicit negation and supported value conflicts in configured facts; configured claim rules; selected conflicts with recognized voice traits; explicit audience-address or technical-jargon mismatches for supported audience profiles; and accessibility/readability signals. It creates category scores for facts, claims, terminology, voice, and accessibility. The current overall score weights these categories as 30%, 25%, 25%, 10%, and 10%, respectively, and maps the score and issue severities to a risk label. These heuristics do not establish arbitrary semantic truth.

The rule engine is not a general-purpose fact checker. Gemini may contribute contextual findings when configured, but neither an AI result nor a high score certifies content as correct or legally compliant.

#### 6.3 Content improvement and version tracking

The analyzer presents AI rewrites and corrections as previews. The original remains unchanged until the user chooses to save. The correction engine validates replacement text and source spans; ambiguous, conflicting, overlapping, or unsafe replacements require manual review rather than automatic application.

Saved changes create new versions instead of rewriting prior history. The Review History interface compares actual saved text in Side-by-Side or Unified view. Restore validates the content, brand, selected historical version, and expected current version, then appends the selected text as a new draft version. Previous versions and review records are retained. The restored draft has no copied audit and must be analyzed again.

### 7. Technical architecture

#### Frontend

- React application built and served with Vite.
- Tailwind CSS and Lucide icons are used for styling and interface icons.
- Main areas are Dashboard, Content Analyzer, Brand Guidelines, and Review History.
- `frontend/src/api.js` centralizes requests, checks HTTP and response content types, and handles JSON and PDF responses.
- In Vite development, `/api` is proxied to the local Flask server. Non-development builds use a production API base hard-coded in `frontend/src/api.js`; its live availability was not verified.

#### Backend and APIs

- Flask application with separate blueprints for brands, content, analysis, reviews, and history.
- API groups include `/api/brands`, `/api/content`, `/api/analysis`, `/api/reviews`, and `/api/history`.
- Representative routes include:
  - `POST /api/analysis/audit` for a saved audit.
  - `POST /api/analysis/quick-check` for a quick check.
  - `POST /api/analysis/rewrite` for an AI rewrite preview.
  - `POST /api/analysis/visual-check` for image review.
  - `POST /api/content/<content_id>/restore` for version restore.
  - `POST /api/reviews` for a review decision.
  - `GET /api/history/export/<content_id>/pdf?brand_id=<brand_id>` for a brand-scoped PDF report.
- CORS origins and rate limits are configurable. Gemini-backed analysis and rewrite operations have configured request limits.

#### Database

- SQLite is the local default, with the database path configurable through `DATABASE_PATH`.
- A PostgreSQL connection adapter is selected when `DATABASE_URL` is configured.
- The schema includes brand profiles and guideline tables, content items, content versions, analysis results, reviews, and staged manual-correction drafts.
- The application initializes its schema on startup and does not seed example brands or content.
- Automated backend tests configure disposable temporary SQLite databases. A live PostgreSQL database was not used for the recorded test run.

#### AI integration and PDF generation

- The backend reads `GEMINI_API_KEY` from its environment and calls Gemini through the Google GenAI client.
- Provider responses are parsed and validated; retry, timeout, quota, and unavailable-provider behavior is handled in the backend.
- PDF files are generated on the backend with ReportLab and returned through the history API. PDF timestamp formatting normalizes timestamps to UTC and omits microseconds from the displayed format.

### 8. Main user workflow

1. Create a brand profile and select it.
2. Add the brand's approved facts, terminology, claim rules, and any visual guidelines.
3. Enter content or upload a supported text document, then run an audit.
4. Review the score, risk level, findings, readability information, and suggested changes.
5. Optionally request a Gemini rewrite or apply corrections. Inspect the preview and explicitly save it as a new version.
6. Compare saved versions or restore an older version as a new draft.
7. Run a fresh audit on the current text before approving or rejecting it.
8. Reopen review and version history as needed, or download a saved audit as JSON or PDF.
9. For a separate visual check, submit a supported image for preliminary review against the selected brand's visual guidance.

### 9. Testing methodology and recorded results

The results below are the most recent recorded project validations available for this documentation. They are not a claim that every external integration was tested live.

| Area | Method and scope | Recorded result |
|---|---|---|
| Backend | Python `unittest` suite using Flask's test client and isolated temporary SQLite databases. Covers brand/guideline operations, analysis, corrections, versioning, review rules, PDF generation, request validation, and provider failure cases. Gemini calls are mocked in automated tests. | **112 passed, 0 failed** in the previously recorded full backend run. |
| Frontend | `npm test` using Node's test runner and `happy-dom`, with mocked requests. Covers API helpers, component behavior, errors, diffs, PDF downloads, Visual Review, rewrite states, restore, and review gating. | **52 passed, 0 failed** in the latest recorded frontend run. |
| Production frontend build | `npm run build` with Vite. | **Passed.** |
| Diff whitespace validation | `git diff --check`. | **Passed.** Git emitted line-ending conversion notices for some files; no diff whitespace error was reported. |
| PDF content and dates | Backend tests parse generated PDF output, exercise timestamp normalization including offsets and microseconds, and include large-report pagination cases. | Automated PDF checks passed in the recorded backend suite. |
| PDF visual layout | Prior audit work sampled rendered pages 1, 2, 24, 36, and 37 of a long report. This was a sample, not a full page-by-page visual audit. | **Partially verified.** |
| Live Gemini | No successful live provider response was recorded. | **Unverified.** |
| Live browser-to-backend E2E | The recorded frontend suite is a component/API test harness; it is not a full end-to-end run against a live backend and database. | **Unverified.** |
| Live PostgreSQL | Backend tests use temporary SQLite; no live PostgreSQL connection was tested. | **Unverified.** |

### 10. Reliability and error handling

- Frontend API helpers report network failures, non-JSON responses, HTTP errors, invalid PDF responses, and empty PDF responses as failures rather than treating them as successful data.
- Backend routes validate request fields; operations with a brand scope validate the content-brand association, and restore always checks it. Restore also checks the expected current version to reject stale requests.
- Text analysis can fall back to deterministic rules when Gemini is unavailable or its response is unusable. Rewrite and Visual Review require Gemini and return errors when the provider is unavailable, the response is invalid, or the request cannot be completed.
- Gemini requests have a configured timeout and bounded retry behavior for selected transient failures. Rate limits are configurable; quota and rate-limit errors are not converted into fake AI results.
- Review actions are associated with the analyzed content version. Frontend approval and rejection controls remain disabled until the current content has a successful audit.
- The backend logs sanitized exception categories rather than returning internal exception details as API responses.
- PDF timestamps are normalized to UTC for display, and report layout code uses structured sections and page-aware elements. This does not constitute certification of every possible report shape.

### 11. Known limitations and unverified features

- **Live Gemini is unverified.** Automated coverage uses mocked responses. Successful service requires backend configuration and available provider quota.
- **Visual Review is preliminary.** It does not certify exact color values, pixel-level contrast, logo identity or geometry, font identity, or overall design quality. Human inspection is required.
- **AI and rule-based findings are advisory.** They can miss context or produce incorrect suggestions. The score is a heuristic based on current rules, not a guarantee of compliance.
- **No authentication or role-based authorization is implemented.** Reviewer name and role are entered as review metadata only.
- **PostgreSQL support is present in the database adapter, but the live PostgreSQL path has not been verified by the recorded test suite.**
- **Full live browser/API/database E2E is not evidenced by the recorded component and backend test runs.** Frontend tests use `happy-dom` and mocked requests; backend tests use Flask's test client and temporary SQLite.
- **PDF reports do not currently include separate readability metrics.** The README says readability appears in PDF reports where available, but the current PDF report implementation does not render those metrics; that README statement remains to be reconciled.
- **The production API base is source-defined rather than environment-configurable, and its current live availability was not tested.**
- **PDF visual inspection is limited.** Selected pages were sampled, and automated extraction/pagination checks passed, but there was no exhaustive visual inspection of every generated page. This document makes no claim of exact logo, color, font, or layout validation.
- The application requires an existing brand and configured guidelines for meaningful brand-specific auditing. It starts without seeded data.

### 12. Future development roadmap

The following are proposals, not implemented product claims:

1. Add authentication, user accounts, and enforceable reviewer roles.
2. Add a repeatable browser E2E suite against a clearly isolated development environment.
3. Run a controlled live Gemini verification process with explicit quota, privacy, and failure checks.
4. Validate the PostgreSQL path in an isolated test environment and add database-specific integration coverage.
5. Improve visual checks with deterministic image measurements where appropriate, while clearly identifying which checks remain subjective.
6. Expand PDF regression testing across representative long, multilingual, and unusual-content reports, including systematic visual inspection.
7. Improve guidance for first-time setup, missing provider configuration, and empty brand guideline sections.

### 13. Conclusion

BrandGuard AI implements a complete brand-guideline and content-review workflow with optional Gemini assistance, deterministic checks, saved version history, review decisions, and PDF/JSON reporting. Its strongest verified foundation is the combination of isolated backend tests and frontend component/API tests. Live Gemini behavior, live PostgreSQL integration, and exhaustive browser and PDF visual validation remain unverified and should be treated as future validation work rather than completed capabilities.
