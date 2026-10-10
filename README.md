# DataPilot AI 🚀
### *From Raw Data to Intelligent Decisions*

DataPilot AI is an enterprise-grade, full-stack automated data analytics, exploratory visualization, and machine learning platform powered by **FastAPI**, **React 19**, **TypeScript**, **Scikit-Learn**, **ReportLab**, and **Google Gemini AI**.

---

## 🌟 Key Features

1. **Intelligent CSV Upload & Storage**:
   - Multi-encoding detection (`utf-8`, `latin1`, `iso-8859-1`, `cp1252`) and streaming size validation.
   - Secure UUID-based file storage and multi-tenant user ownership verification.
   - Pre-loaded benchmark datasets (Telecom Customer Churn, Real Estate Housing, Customer Segmentation).

2. **Automated Profiling & Data Quality Audit**:
   - Inferred semantic types (`numeric`, `categorical`, `datetime`, `boolean`, `constant`).
   - Comprehensive descriptive statistics (Mean, Median, Std Dev, Min, Max, Quartiles, Skewness).
   - IQR-based outlier detection and high-correlation pair identification ($|r| \ge 0.80$).
   - Composite **Data Quality Score (0–100)** with grade rating (`A`, `B`, `C`, `D`, `F`) and health notes.

3. **Interactive Data Cleaning Studio**:
   - Reproducible transformation queue: Deduplication, Null value imputation (mean, median, mode, custom constant), Outlier treatment (Winsorization/IQR capping, Z-score), Schema renaming, and Type casting.
   - Live **Before-and-After Audit Diff** preview.
   - Cleaned dataset version artifact preservation with one-click CSV export.

4. **Exploratory Data Analysis (EDA) Hub**:
   - Interactive Plotly visualizations:
     - Numeric distribution histograms with adjustable bin counts.
     - Grouped and single box plots with outlier whiskers.
     - Pearson correlation heatmaps with continuous color scales.
     - 2D scatter plots with color dimension groupings.
     - Categorical frequency bar charts.
     - Dataset missing-value distribution breakdown.

5. **Machine Learning Workspace**:
   - Supported tasks: **Classification**, **Regression**, and **Unsupervised Clustering (K-Means)**.
   - Leakage-free Scikit-Learn `ColumnTransformer` pipelines with standard scaling, median imputation, and one-hot encoding.
   - Performance evaluation: Accuracy, Precision, Recall, F1 Score, Confusion Matrix, R², RMSE, MAE, Silhouette Score, and Inertia.
   - Interactive **Single-Record Live Prediction Simulator** & **Batch CSV Prediction Runner**.

6. **Google Gemini AI Assistant (Co-Pilot)**:
   - Grounded context synthesis: Translates calculated dataset profiling and model metrics into domain-aware prompt summaries without raw data leaks.
   - Instant suggested prompt templates & conversation history.
   - Graceful offline fallback when `GEMINI_API_KEY` is not present.

7. **Executive PDF Reports & Artifacts Export**:
   - Downloadable ReportLab multi-page executive PDF report with styled tables, KPI badges, and audit trails.
   - Cleaned dataset CSV download.
   - Model predictions CSV export.
   - Machine-readable JSON profiling schema export.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Plotly (`react-plotly.js`), TanStack Query, React Router v7, Axios.
- **Backend**: Python 3.13, FastAPI, Uvicorn, Pydantic v2, SQLAlchemy 2.0, Pandas 2.2, NumPy, Scikit-Learn 1.6, SciPy, ReportLab 5.0, Google Gen AI SDK (`google-generativeai`).
- **Database**: SQLite (local zero-config) / PostgreSQL (production compatible via `DATABASE_URL`).

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.10+ installed
- Node.js 18+ and npm installed

---

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows:
.\venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Copy template and optionally add your Gemini API Key:
copy .env.example .env

# Run automated backend test suite
pytest -v tests/test_all.py

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```

FastAPI server runs at `http://127.0.0.1:8000` with interactive OpenAPI documentation at `http://127.0.0.1:8000/docs`.

---

### 3. Frontend Setup

```bash
# In a new terminal, navigate to frontend directory
cd frontend

# Install npm dependencies
npm install

# Run Vite dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🔑 Environment Variables Configuration (`backend/.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `APP_NAME` | `DataPilot AI` | Application branding name |
| `DATABASE_URL` | `sqlite:///./datapilot.db` | Database connection URI |
| `SECRET_KEY` | `your-secret-key` | JWT token encryption key |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | JWT expiration (24h) |
| `MAX_UPLOAD_SIZE_MB` | `50` | Maximum uploaded CSV file size |
| `GEMINI_API_KEY` | `""` | Google Gemini API Key for AI features |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model variant |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Allowed frontend origins |

---

## 🧪 Automated Testing

Run the full backend automated test suite:

```bash
cd backend
.\venv\Scripts\pytest -v tests/test_all.py
```

All 13 integration test suites verify:
- User registration, login & JWT auth verification
- CSV upload, validation & pagination
- Automated profiling & Data Quality Score calculation
- Data cleaning pipeline & audit diffs
- Exploratory data analysis (EDA) chart calculations
- Classification, Regression, and Clustering model training
- Single and batch predictions
- Gemini AI Assistant graceful offline fallback
- ReportLab PDF executive report generation
- Multi-tenancy & dataset ownership protection

To check the frontend TypeScript build:

```bash
cd frontend
npm run build
```

---

## 🛡️ Security Best Practices

- **Zero Raw Data Leaks**: Google Gemini queries only receive aggregated statistics and summary metrics.
- **Dataset Ownership Isolation**: Multi-tenant authorization prevents access to another user's dataset or reports.
- **Sanitized Storage**: User uploaded filenames are stripped and assigned unique UUIDs.
- **No Secrets in Source Control**: `.env` and SQLite database files are excluded via `.gitignore`.
