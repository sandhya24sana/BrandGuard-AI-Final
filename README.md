# BrandGuard AI

BrandGuard AI is a brand-governance application for managing brand guidelines and reviewing marketing content against those guidelines. It includes a React frontend, a Flask API, and a SQLite database. The application starts with no seeded brands or demo content; add a brand before using analysis features.

## Features

- Create, edit, and delete brand profiles.
- Manage approved facts, terminology guidance, claim rules, and stored visual guidelines for each brand.
- Enter content in the editor or upload `.txt`, `.md`, `.markdown`, `.docx`, `.pdf`, or `.json` files for text extraction; PNG, JPEG, and WebP files can be submitted for a separate visual review.
- Run Visual Review for supported PNG, JPEG, and WebP images. The backend validates the image and configured visual rules, then sends the image to Gemini only when a backend API key is configured.
- Run a quick check or save a content audit. The rule-based engine works without an API key; an optional Gemini API key enables AI analysis with rule-based checks retained as a fallback.
- Deterministic fallback checks include explicit negation and supported value conflicts in configured facts, selected conflicts with recognized voice traits, and explicit audience-address or technical-jargon mismatches for supported audience profiles. These heuristics do not establish arbitrary semantic truth.
- Review categorized findings, risk scores, readability information, and suggested corrections. Apply individual fixes or adopt corrected content as a new version.
- Compare actual saved versions in Side-by-Side or Unified view. The comparison highlights added, removed and modified text separately from proposed correction previews.
- Restore a saved historical version as a new current draft version. The restored text is not a copied analysis or review; the new version is marked **Draft** and **Not audited** until a new analysis is saved.
- Generate downloadable PDF reports for saved audits, with readable UTC audit/version/review timestamps in `DD-MM-YYYY HH:MM UTC` format, structured report sections, page boundaries and page numbering.
- Record reviewer decisions, reviewer details, and comments against the reviewed content version; stale frontend submissions are rejected. Existing review history is preserved without guessing a version for older records.
- View dashboard statistics and export a content audit report as JSON or PDF.

PNG, JPEG, and WebP uploads are sent to the backend Gemini service for a preliminary review of configured colors, logo visibility/placement/obvious distortion, typography, visible text contrast, and severe image rendering issues when those details can be discerned. Results include severity, explanation, and recommendations; uncertain or exact measurements still require manual verification. The service does not certify exact color values, logo identity or clear-space geometry, font identity, numeric WCAG contrast ratios, layout, or general audience/content suitability. Images are not saved. A Gemini key is required on the backend, and provider or quota failures are returned as errors rather than mock audits. Automated analysis is not a substitute for human approval.

Automatic corrections use exact detected spans and an explicitly configured replacement-text field. Claim disclaimers and policy explanations are not treated as replacement copy; for compatibility, only an explicitly quoted alternative following `Use:` in a legacy disclaimer is extracted as replacement text. Other existing claim rules without replacement text remain manual-review issues. Applying an individual correction or adopting all corrections creates a new content version and re-runs the analysis; grammar is not automatically certified, so human review remains required.

### Visual Review usage

Open a brand, use the Visual Review action in the content analyzer, and select a PNG, JPEG, or WebP image. The frontend sends the image and brand ID to `POST /api/analysis/visual-check`. The backend validates file type and size, reads `GEMINI_API_KEY` only from the backend environment, and applies configured visual rules. Missing keys, invalid images, provider quota/rate-limit responses and timeout/provider failures are displayed as errors. The key is never sent to or stored in the frontend. Live provider success has not been guaranteed by this repository configuration and depends on a valid backend key and available provider quota.

### Saved-version comparison and restore usage

Open a saved audit in Review History or use the Diff & Changes tab in Content Analyzer. Choose or reload saved versions to inspect the actual text in Side-by-Side or Unified view. Saved-version comparisons are distinct from proposed correction previews.

In the Review History version timeline, select **Restore as New Version** for an older saved version and confirm the action. The backend validates the content, brand and selected version, then appends the historical text as a new current version rather than overwriting or deleting the historical version. Restore preserves existing versions and review records, creates a `draft` status, clears any copied risk result, and marks the restored text **Not audited** until a new analysis is run and saved. Stale restore requests are rejected so duplicate or incorrect versions are not created.

### PDF report usage

Open a saved audit and use **Download PDF Report**. The frontend requests `GET /api/history/export/{content_id}/pdf?brand_id={brand_id}` and downloads the returned PDF. Reports include current report metadata, audit findings, category scores, and available version/review history; they do not include separate readability metrics. Audit, version and review timestamps are normalized to UTC and displayed as `DD-MM-YYYY HH:MM UTC`; microseconds and raw database timestamp strings are not displayed. The generated PDF includes page numbering and keeps report sections and tables separated across page boundaries. PDF layout may be inspected through a local PDF renderer, but the repository cannot claim live visual inspection for environments where rendering is unavailable.

## Project layout

```text
BrandGuard-AI/
├── backend/
│   ├── app.py
│   ├── config.py
│   ├── database.py
│   ├── seed_data.py        # Compatibility entry point; does not seed data
│   ├── routes/
│   ├── services/
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── run.bat
├── run.sh
└── README.md
```

The backend creates the database schema on startup but does not insert example brands or records.

## Requirements

- Python 3.9 or newer
- Node.js and npm (for frontend development or building)

## Run the application

### Windows

From the project directory, run:

```cmd
run.bat
```

The script installs backend dependencies, builds the frontend if no build is present, and starts the Flask application at `http://localhost:5000`.

### Linux or macOS

From the project directory, run:

```bash
chmod +x run.sh
./run.sh
```

### Manual setup

Install backend dependencies from the project directory:

```bash
python -m pip install -r backend/requirements.txt
```

Optionally copy `backend/.env.example` to `backend/.env` and set `GEMINI_API_KEY` to enable backend Gemini text analysis and visual review. The key stays on the backend; audit text, brand guidelines, and uploaded images are sent to Google's Gemini API when the corresponding feature is used. Without a key, text audits use the local rule-based engine and visual review is unavailable. Gemini quota limits are controlled by the configured Google AI project; quota exhaustion is reported as an error and does not produce a mock review.

Start the backend in one terminal:

```bash
python backend/app.py
```

For frontend development with Vite, install dependencies and start the dev server in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` for the Vite frontend or `http://localhost:5000` for the backend-served production frontend (after building it with `npm run build` in `frontend`).

## Backend tests

Run the backend and frontend tests from the project directory:

```bash
python -m unittest discover -s backend/tests -v
cd frontend
npm test
npm run lint
npm run build
cd ..
```

The backend test suite uses isolated temporary SQLite databases and covers brand and guideline management, content auditing and versioning, review decisions, correction behavior, API validation, dashboard aggregation, report export, visual-review provider mocks, version restore and brand/content deletion. Frontend tests cover issue rendering, API failures, brand-scoped request races, saved-version diffs, PDF downloads, visual review, rewrite states and review/restore behavior.

## Configuration

Backend settings can be provided through `backend/.env` or environment variables. Supported settings include `APP_ENV`, `GEMINI_API_KEY`, `DATABASE_PATH`, `UPLOAD_FOLDER`, `PORT`, `FLASK_DEBUG`, `CORS_ORIGINS`, `GEMINI_ANALYSIS_RATE_LIMIT`, `GEMINI_REWRITE_RATE_LIMIT`, `RATELIMIT_STORAGE_URI`, and `REDIS_URL`. The default database path is `backend/brandguard.db`.

Gemini-backed analysis requests share a per-client limit of `10 per minute` by default; rewrites default to `5 per minute`. Override these values with the corresponding environment variables using Flask-Limiter's rate-limit syntax. `APP_ENV=production` (also detected on Render) requires `RATELIMIT_STORAGE_URI` or `REDIS_URL` to contain a valid `redis://` or `rediss://` URL; startup fails otherwise. The local default storage (`memory://`) is process-local and intended only for development. Configure a shared Redis-compatible URI in production so limits are consistent across workers. A rejected request receives HTTP 429 with a generic retry-later message.

Uploaded files are extracted for analysis and are not listed as preloaded project data.
