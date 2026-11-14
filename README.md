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
- SQLite/JSON atomic persistence for committed civic actions.
- Real-time status management (`Proposed` ➔ `In Progress` ➔ `Completed` ➔ `Abandoned`).
- **Historical Comparison Engine**: Evaluates what improved, what deteriorated, and which interventions were completed.
- **Strict Scientific Guardrail**: Enforces **CORRELATION ≠ CAUSATION**, explaining that ambient airshed reductions cannot be casually credited to local actions without 90-day meteorological controls.

### 4. Civic Reports & Multilingual Advisories
- **Internal Civic Briefing**: Executive briefing formatted for municipal commissioners and environmental engineers.
- **Citizen Advisory**: Plain-language advisory in **English** and **हिंदी (Hindi)** with selectable reading levels (*Simple*, *Standard*, *Technical*) and explicit precautions for pediatric, elderly, and respiratory sensitive groups.
- Print-ready and exportable layout.

---

## 🛠️ Architecture & Stack

- **Backend**: Node.js, Express, Multer, XLSX, CORS, Dotenv
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
# Run End-to-End API Suite (28 assertions)
node test_e2e_endpoints.js

# Run Unit Verification Suite
node test_backend_units.js
```

### 3. Environment Variables
Stored securely in `.env`:
```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
PORT=3000
```
*(No external database or API key is exposed to the frontend browser bundle.)*

---

## 🛡️ Hackathon Evaluation Checklist
- [x] **No static / fake / simulated data**: Live atmospheric data retrieved via Open-Meteo & Copernicus; real calculations using CPCB NAQI standard.
- [x] **Working buttons**: Every single button, slider, and selector has real functional handlers and API integration.
- [x] **Server-side AI**: Gemini calls handled securely server-side with structured JSON formatting and timeouts.
- [x] **Messy table handling**: Ingests real CSVs and Excel workbooks, handles messy aliases, missing rows, negative spikes, and duplicate records.
- [x] **Scientific integrity**: Clear distinction between station measurements and doorstep microclimates; correlation explicitly distinguished from causation.
