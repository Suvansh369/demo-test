# NIRVAIR
### Know Your Air. Understand Your Neighbourhood. Take Action.
**Google for Developers PromptWars Hackathon Project**

NIRVAIR is an AI-driven civic air-quality intelligence platform that transforms raw atmospheric data into location-specific understanding, actionable interventions, and measurable civic outcomes.

---

## 🌟 Key Workflows

### 1. Understand My Air (Citizen & Civic Intelligence)
- **Signature "Perception vs Reality" Onboarding**: Prompts users to guess their local AQI, retrieves real atmospheric readings via Open-Meteo & Copernicus CAMS, computes official CPCB Indian National AQI (NAQI), and reveals the divergence.
- **Station-Level vs Hyperlocal Transparency**: Explicitly calculates distance to the nearest regulatory Continuous Ambient Air Quality Monitoring Station (CAAQMS) and warns users that regulatory stations monitor regional airsheds, not exact building-level conditions.
- **Neighbourhood Intelligence Map**: Interactive Leaflet map displaying categorized point sources:
  - `[VERIFIED]`: Continuous monitoring stations
  - `[MAPPED]`: Arterial traffic corridors, industrial zones
  - `[CITIZEN]`: Crowdsourced user reports (visible dust, waste burning)
  - `[HYPOTHESIS]`: AI-generated spatial dispersal hypotheses
- **Personalised Action Intelligence (Gemini)**: Role-tailored immediate (today), short-term (7–30 days), and long-term (structural) directives for:
  - Citizens / Residents
  - School Administrators
  - Housing Societies (RWAs)
  - Ward Officers / Local Authorities
- Every recommendation contains *Why it is recommended*, *Supporting evidence*, *Responsible stakeholder*, *Timeline*, *Expected outcome*, and *Verification method*.

### 2. Analyse My Data (Institutional Data Trust Engine)
- **Ingestion**: Supports CSV, Excel (`.xlsx`/`.xls`), and raw pasted tabular text.
- **Handles Messy Data**: Cleans inconsistent date formats, ambiguous column headers, inconsistent measurement units ($\mu g/m^3$, $ppm$, $ppb$), duplicate rows, and out-of-range sensor readings.
- **4-Tier Data Trust Framework**:
  - 🟢 **GREEN**: Reliable observation
  - 🟡 **YELLOW**: Suspicious observation (sudden $>400\%$ spike, flatlined/frozen sensor)
  - 🔴 **RED**: Invalid observation (negative concentration, $AQI > 1500$)
  - ⚪ **GREY**: Insufficient evidence (missing values, blank, NULL, NaN)
- **Deterministic Analytics**: Mean, Median, 95th Percentile, Min, Max, Standard Deviation, and Quartile Trend.
- **Gemini AI Audit**: Plain-language executive explanations of anomalies and institutional recommendations.
- **One-Click Evaluator Button**: "Load Sample Messy Dataset" allows instant end-to-end testing.

### 3. Persistent Intervention Memory & Comparison Tracker
- Atomic persistence for committed civic actions.
- Real-time status management (`Proposed` ➔ `In Progress` ➔ `Completed` ➔ `Abandoned`).
- **Historical Comparison Engine**: Evaluates what improved, what deteriorated, and which interventions were completed.
- **Strict Scientific Guardrail**: Enforces **CORRELATION ≠ CAUSATION**, explaining that ambient airshed reductions cannot be casually credited to local actions without 90-day meteorological controls.

### 4. Civic Reports & Multilingual Advisories
- **Internal Civic Briefing**: Executive briefing formatted for municipal commissioners and environmental engineers.
- **Citizen Advisory**: Plain-language advisory in **English** and **हिंदी (Hindi)** with selectable reading levels (*Simple*, *Standard*, *Technical*) and explicit precautions for pediatric, elderly, and respiratory sensitive groups.
- Print-ready and exportable layout.

---

## ♿ Accessibility (WCAG 2.2 AA Compliant)

- **Keyboard Navigation**: Universal high-visibility `:focus-visible` ring across all interactive controls (`button`, `input`, `select`, `textarea`, `a`).
- **Screen Reader Support**: Semantic HTML5 landmarks (`header`, `main`, `section`, `footer`), explicit `<label for="...">` pairings for all inputs, `role="tablist"`/`role="tab"`, and `role="radiogroup"`/`role="radio"`.
- **Skip Link**: Accessible `<a href="#main-content">` jump link for keyboard power users.
- **Dynamic Announcements**: Real-time `aria-live="polite"` regions on reveal cards, AI directives, and data trust results.
- **Vestibular Motion Safety**: Comprehensive `@media (prefers-reduced-motion: reduce)` disabling all decorative animations.
- **Accessible Maps**: Accessible `role="application"` with descriptive text alternative of all mapped point sources.
- **Internationalization**: Genuine Devanagari Hindi generation with dynamic `lang="hi"` attribute tags.

---

## 🔒 Security & Hardening

- **Security Headers**: Integrated `helmet` with strict Content Security Policy (CSP), clickjacking defense, MIME-sniffing protection, and suppression of `X-Powered-By`.
- **CORS Origin Whitelisting**: Restricted to trusted frontend origins via `process.env.ALLOWED_ORIGINS` (no unrestricted wildcard `*`).
- **Rate Limiting**: Multi-tiered IP rate limiters on global API (150/15m), AI endpoints (40/15m), file analysis (30/15m), and citizen reporting (20/15m).
- **Strict Input Validation**: Boundary enforcement on geographical coordinates (validating latitude -90..90 and longitude -180..180, properly handling coordinate `0`), enum whitelist validation on report types/severity, and XSS sanitization.
- **File Upload Guardrails**: Multer file filter enforcing extension whitelist (`.csv`, `.tsv`, `.txt`, `.xlsx`, `.xls`), 10MB file size ceiling, and maximum 10,000 row / 50 column limits to prevent memory exhaustion attacks.

---

## ⚡ Efficiency & Caching

- **Freshness-Aware Caching**: In-memory cache for ambient AQI observations (10-minute TTL) with explicit `cached: true/false`, `cachedAt`, and `ageSeconds` transparency metadata.
- **Geocoding & AI Deduplication**: Caches geocoding results (24 hours) and identical role action plans (15 minutes) to eliminate redundant external network overhead and API quota consumption.
- **Network Timeouts**: Explicit 35-second abort controller timeouts on all external network and Gemini calls.

---

## 🛠️ Architecture & Stack

- **Backend**: Node.js, Express, Multer, XLSX, CORS, Dotenv, Helmet, Express-Rate-Limit
- **Frontend**: Single Page Application, Tailwind CSS, Leaflet.js, Lucide Icons, Chart.js
- **AI Core**: Google Gemini Generative Language API (`gemini-flash-latest`)
- **Live Data**: Open-Meteo Air Quality (Copernicus CAMS model) + Open-Meteo Geocoding
- **AQI Standard**: Central Pollution Control Board (CPCB) Indian National AQI formula
- **Storage**: Atomic persistent JSON store (`data/nirvair_db.json`)

---

## 🚀 Quickstart & Evaluator Guide

### 1. Install & Run
```bash
npm install
node server.js
```
The application will be live at:
👉 **http://localhost:3000**

### 2. Run Automated Test Suites
```bash
# Run Security, Efficiency & Accessibility Suite (28 passing checks)
node tests/security_and_a11y_tests.js

# Run End-to-End API Integration Suite (28 passing checks)
node test_e2e_endpoints.js

# Run Core Unit Verification Suite
node test_backend_units.js
```

### 3. Environment Variables
Stored securely in `.env`:
```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
PORT=3000
```
*(No external database or API key is exposed to the frontend browser bundle.)*

---

## 🛡️ Hackathon Evaluation Checklist
- [x] **Accessibility**: WCAG 2.2 AA compliant, visible focus indicators, skip link, labels, aria-live, prefers-reduced-motion.
- [x] **Security**: Helmet CSP, CORS origin whitelisting, rate limiting, strict coordinate validation (including 0), Multer extension filters.
- [x] **Efficiency**: In-memory TTL caching with provenance metadata, request deduplication, row-processing bounds.
- [x] **Scientific Integrity**: Station-level measurements explicitly separated from hyperlocal estimates; correlation never conflated with causation.
- [x] **No static / fake / simulated data**: Live atmospheric data retrieved via Open-Meteo & Copernicus; real calculations using CPCB NAQI standard.
- [x] **Working buttons**: Every single button, slider, and selector has real functional handlers and API integration.
