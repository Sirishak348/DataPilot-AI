import os
import io
import json
import pytest
from unittest.mock import patch, MagicMock
import pandas as pd
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models.models import User, Dataset, ModelRun
from app.services.auth_service import get_password_hash, create_access_token
from app.services.cleaning_service import detect_derived_columns, run_cleaning_pipeline, validate_cleaning_operation
from app.schemas.schemas import CleaningOperation

# Use a test SQLite in-memory database with StaticPool so all connections share the same memory DB
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Create tables in test db
Base.metadata.create_all(bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="session")
def client():
    # Ensure sample datasets exist
    sample_dir = os.path.join(settings.BASE_DIR, "sample_data")
    try:
        from sample_data.sample_generator import generate_samples
        generate_samples(sample_dir)
    except Exception:
        pass
    return TestClient(app)

@pytest.fixture(scope="session")
def auth_headers(client):
    # Register and login a test user
    email = "testuser@datapilot.ai"
    password = "SecurePassword123!"
    resp = client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Test Engineer"
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope="session")
def second_user_headers(client):
    # Register a second distinct user to test multi-tenancy & ownership
    email = "otheruser@datapilot.ai"
    password = "SecurePassword123!"
    resp = client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Other User"
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

# 1. AUTHENTICATION TESTS
def test_user_registration_and_login(client):
    email = "newauth@datapilot.ai"
    password = "StrongPassword99!"
    
    # Register
    reg_resp = client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Auth Tester"
    })
    assert reg_resp.status_code == 201
    assert "access_token" in reg_resp.json()
    assert reg_resp.json()["user"]["email"] == email

    # Login
    login_resp = client.post("/api/auth/login/json", json={
        "email": email,
        "password": password
    })
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()

    # Get Current User
    token = login_resp.json()["access_token"]
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == email

def test_demo_login(client):
    resp = client.post("/api/auth/demo-login")
    assert resp.status_code == 200
    assert "access_token" in resp.json()
    assert resp.json()["user"]["email"] == "demo@datapilot.ai"

# 2. DATASET UPLOAD & VALIDATION TESTS
def test_csv_upload_and_preview(client, auth_headers):
    csv_content = (
        "id,age,income,category,target\n"
        "1,25,50000,Retail,0\n"
        "2,35,75000,Finance,1\n"
        "3,45,120000,Tech,1\n"
        "4,50,90000,Finance,0\n"
        "5,23,45000,Retail,0\n"
        "6,31,68000,Tech,1\n"
        "7,60,150000,Tech,1\n"
        "8,28,52000,Retail,0\n"
        "9,42,88000,Finance,1\n"
        "10,38,79000,Tech,1\n"
        "11,29,54000,Retail,0\n"
        "12,55,135000,Finance,1\n"
    )
    files = {"file": ("test_dataset.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    upload_resp = client.post("/api/datasets/upload", headers=auth_headers, files=files)
    assert upload_resp.status_code == 201
    dataset = upload_resp.json()
    assert dataset["name"] == "test_dataset"
    assert dataset["row_count"] == 12
    assert dataset["column_count"] == 5
    assert dataset["quality_score"] > 0

    dataset_id = dataset["id"]

    # Preview
    preview_resp = client.get(f"/api/datasets/{dataset_id}/preview", headers=auth_headers)
    assert preview_resp.status_code == 200
    preview = preview_resp.json()
    assert preview["total_rows"] == 12
    assert len(preview["preview_rows"]) == 12
    assert "age" in preview["columns"]

# 3. SAMPLE DATASET LOADER TEST
def test_sample_dataset_loader(client, auth_headers):
    resp = client.post("/api/datasets/sample/churn", headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert "Churn" in data["name"] or "Telecom" in data["name"]
    assert data["row_count"] > 100
    assert data["quality_score"] > 50

# 4. PROFILING & DATA QUALITY TEST
def test_dataset_profiling(client, auth_headers):
    sample_resp = client.post("/api/datasets/sample/housing", headers=auth_headers)
    dataset_id = sample_resp.json()["id"]

    profile_resp = client.get(f"/api/datasets/{dataset_id}/profile", headers=auth_headers)
    assert profile_resp.status_code == 200
    profile = profile_resp.json()
    assert "quality" in profile
    assert profile["quality"]["overall_score"] >= 0
    assert profile["quality"]["grade"] in ["A", "B", "C", "D", "F"]
    assert len(profile["columns"]) > 0

    # Verify numeric columns stats
    num_cols = [c for c in profile["columns"] if c["inferred_type"] == "numeric"]
    assert len(num_cols) > 0
    assert "mean" in num_cols[0]["stats"]

# 5. DATA CLEANING VALIDATION & TRANSFORMATION TESTS
def test_data_cleaning_pipeline_and_validation(client, auth_headers):
    csv_dirty = (
        "id,salary,dept,join_date\n"
        "1,50000,Sales,2021-01-01\n"
        "2,60000,IT,2021-02-01\n"
        "1,50000,Sales,2021-01-01\n" # Duplicate row
        "3,,IT,2021-03-01\n"         # Missing salary
        "4,80000,,2021-04-01\n"       # Missing dept
        "5,90000,HR,\n"              # Missing join_date
        "6,55000,HR,2021-06-01\n"
        "7,70000,IT,2021-07-01\n"
    )
    files = {"file": ("dirty.csv", io.BytesIO(csv_dirty.encode("utf-8")), "text/csv")}
    upload_resp = client.post("/api/datasets/upload", headers=auth_headers, files=files)
    dataset_id = upload_resp.json()["id"]

    # Test Validation: Attempting Mean imputation on non-numeric date column must fail validation
    df_sample = pd.DataFrame({
        "date_col": pd.date_range("2020-01-01", periods=5),
        "cat_col": ["A", "B", "C", "D", "E"],
        "num_col": [1.0, 2.0, 3.0, 4.0, 5.0]
    })
    invalid_op = CleaningOperation(op_type="impute_missing", params={"column": "date_col", "strategy": "mean"})
    val_err = validate_cleaning_operation(df_sample, invalid_op)
    assert val_err is not None
    assert "Mean and Median imputation can only be applied to numeric columns" in val_err

    # Test Validation: Dropping all columns must fail validation
    drop_all_op = CleaningOperation(op_type="drop_columns", params={"columns": ["date_col", "cat_col", "num_col"]})
    drop_err = validate_cleaning_operation(df_sample, drop_all_op)
    assert drop_err is not None
    assert "Cannot drop all columns" in drop_err

    # Test Valid Pipeline Preview
    clean_payload = {
        "operations": [
            {"op_type": "remove_duplicates", "params": {}},
            {"op_type": "impute_missing", "params": {"column": "salary", "strategy": "mean"}},
            {"op_type": "impute_missing", "params": {"column": "dept", "strategy": "mode"}},
            {"op_type": "impute_missing", "params": {"column": "join_date", "strategy": "forward_fill"}},
            {"op_type": "treat_outliers", "params": {"column": "salary", "method": "cap_iqr", "threshold": 1.5}}
        ],
        "save_as_new": False
    }
    prev_resp = client.post(f"/api/datasets/{dataset_id}/preview-clean", headers=auth_headers, json=clean_payload)
    assert prev_resp.status_code == 200
    diff = prev_resp.json()
    assert diff["duplicates_removed"] == 1
    assert diff["missing_values_before"] == 3
    assert diff["missing_values_after"] == 0

    # Apply cleaning
    apply_resp = client.post(f"/api/datasets/{dataset_id}/apply-clean", headers=auth_headers, json=clean_payload)
    assert apply_resp.status_code == 200
    assert apply_resp.json()["diff_summary"]["missing_values_after"] == 0

    # Download cleaned CSV
    dl_resp = client.get(f"/api/datasets/{dataset_id}/download?version=cleaned", headers=auth_headers)
    assert dl_resp.status_code == 200
    assert "text/csv" in dl_resp.headers["content-type"]
    assert "attachment" in dl_resp.headers["content-disposition"]

# 6. DERIVED COLUMN DETECTION & RECALCULATION (Wind+Solar)
def test_derived_columns_wind_solar(client, auth_headers):
    # Create dataset with Wind, Solar, and Wind+Solar
    df_energy = pd.DataFrame({
        "Date": pd.date_range("2020-01-01", periods=10).astype(str),
        "Consumption": [1000, 1100, 1200, 1050, 950, 1150, 1250, 1300, 1100, 1000],
        "Wind": [100.0, 150.0, 200.0, 120.0, None, 180.0, 210.0, 140.0, 160.0, 190.0],
        "Solar": [50.0, 60.0, 70.0, 80.0, 90.0, 55.0, 65.0, 75.0, None, 85.0],
    })
    df_energy["Wind+Solar"] = df_energy["Wind"] + df_energy["Solar"]

    csv_buf = io.BytesIO()
    df_energy.to_csv(csv_buf, index=False)
    csv_buf.seek(0)

    files = {"file": ("energy_sample.csv", csv_buf, "text/csv")}
    upload_resp = client.post("/api/datasets/upload", headers=auth_headers, files=files)
    dataset_id = upload_resp.json()["id"]

    # Verify detection
    recs = detect_derived_columns(df_energy)
    assert len(recs) == 1
    assert recs[0]["derived_column"] == "Wind+Solar"
    assert recs[0]["source_columns"] == ["Wind", "Solar"]

    # Test API endpoint
    rec_resp = client.get(f"/api/datasets/{dataset_id}/derived-recommendations", headers=auth_headers)
    assert rec_resp.status_code == 200
    assert len(rec_resp.json()) == 1
    assert rec_resp.json()[0]["derived_column"] == "Wind+Solar"

    # Execute cleaning pipeline: impute Wind, impute Solar, then recalculate Wind+Solar
    clean_payload = {
        "operations": [
            {"op_type": "impute_missing", "params": {"column": "Wind", "strategy": "median"}},
            {"op_type": "impute_missing", "params": {"column": "Solar", "strategy": "median"}},
            {"op_type": "recalculate_derived", "params": {"target_column": "Wind+Solar", "source_columns": ["Wind", "Solar"], "operation": "sum"}}
        ]
    }
    apply_resp = client.post(f"/api/datasets/{dataset_id}/apply-clean", headers=auth_headers, json=clean_payload)
    assert apply_resp.status_code == 200
    assert apply_resp.json()["diff_summary"]["missing_values_after"] == 0

# 7. EXPLORATORY DATA ANALYSIS (EDA) TESTS (Histogram, Box, Violin, Correlations, Scatter, Bubble, ScatterMatrix, Missing, Timeseries)
def test_all_eda_chart_endpoints(client, auth_headers):
    sample_resp = client.post("/api/datasets/sample/churn", headers=auth_headers)
    dataset_id = sample_resp.json()["id"]

    # 1. Histogram
    hist_resp = client.get(f"/api/datasets/{dataset_id}/eda/histogram?column=MonthlyCharges&bins=15", headers=auth_headers)
    assert hist_resp.status_code == 200
    assert len(hist_resp.json()["counts"]) == 15

    # 2. Boxplot
    box_resp = client.get(f"/api/datasets/{dataset_id}/eda/boxplot?numeric_column=MonthlyCharges&group_by=Contract", headers=auth_headers)
    assert box_resp.status_code == 200
    assert len(box_resp.json()["groups"]) > 0

    # 3. Violin
    violin_resp = client.get(f"/api/datasets/{dataset_id}/eda/violin?numeric_column=MonthlyCharges", headers=auth_headers)
    assert violin_resp.status_code == 200
    assert len(violin_resp.json()["groups"]) > 0

    # 4. Correlation matrix
    corr_resp = client.get(f"/api/datasets/{dataset_id}/eda/correlations", headers=auth_headers)
    assert corr_resp.status_code == 200
    assert len(corr_resp.json()["columns"]) > 0

    # 5. Scatter with trendline
    scat_resp = client.get(f"/api/datasets/{dataset_id}/eda/scatter?x=TenureMonths&y=MonthlyCharges", headers=auth_headers)
    assert scat_resp.status_code == 200
    assert "trendline" in scat_resp.json()

    # 6. Bubble chart
    bubble_resp = client.get(f"/api/datasets/{dataset_id}/eda/bubble?x=TenureMonths&y=MonthlyCharges&size=TotalCharges", headers=auth_headers)
    assert bubble_resp.status_code == 200
    assert len(bubble_resp.json()["bubbles"]) > 0

    # 7. Scatter matrix
    sm_resp = client.get(f"/api/datasets/{dataset_id}/eda/scatter-matrix?columns=TenureMonths,MonthlyCharges,TotalCharges", headers=auth_headers)
    assert sm_resp.status_code == 200
    assert len(sm_resp.json()["records"]) > 0

    # 8. Missing Values
    miss_resp = client.get(f"/api/datasets/{dataset_id}/eda/missing", headers=auth_headers)
    assert miss_resp.status_code == 200

    # 9. Missing Matrix
    mmat_resp = client.get(f"/api/datasets/{dataset_id}/eda/missing-matrix", headers=auth_headers)
    assert mmat_resp.status_code == 200
    assert "matrix" in mmat_resp.json()

    # 10. Categorical Bar
    bar_resp = client.get(f"/api/datasets/{dataset_id}/eda/barchart?column=Contract", headers=auth_headers)
    assert bar_resp.status_code == 200

    # 11. Stacked Bar
    sbar_resp = client.get(f"/api/datasets/{dataset_id}/eda/stacked-bar?primary_column=Contract&secondary_column=InternetService", headers=auth_headers)
    assert sbar_resp.status_code == 200

# 8. MACHINE LEARNING TESTS (Classification, Regression, Clustering, Decision Trees, DBSCAN, Inference)
def test_ml_classification_decision_tree_and_prediction(client, auth_headers):
    sample_resp = client.post("/api/datasets/sample/churn", headers=auth_headers)
    dataset_id = sample_resp.json()["id"]

    # Train Decision Tree Classification
    train_payload = {
        "task_type": "classification",
        "target_column": "Churn",
        "feature_columns": ["TenureMonths", "MonthlyCharges", "Contract"],
        "model_name": "DecisionTreeClassifier",
        "test_size": 0.2,
        "random_state": 42
    }
    train_resp = client.post(f"/api/datasets/{dataset_id}/train", headers=auth_headers, json=train_payload)
    assert train_resp.status_code == 200
    res = train_resp.json()
    assert res["task_type"] == "classification"
    assert "accuracy" in res["metrics"]
    assert "baseline_accuracy" in res["metrics"]
    assert len(res["confusion_matrix"]) > 0

    model_id = res["model_run_id"]

    # Single Prediction
    pred_resp = client.post(f"/api/models/{model_id}/predict-single", headers=auth_headers, json={
        "features": {
            "TenureMonths": 24,
            "MonthlyCharges": 70.0,
            "Contract": "One year"
        }
    })
    assert pred_resp.status_code == 200
    assert len(pred_resp.json()["predictions"]) == 1

def test_ml_regression_with_baselines(client, auth_headers):
    sample_resp = client.post("/api/datasets/sample/housing", headers=auth_headers)
    dataset_id = sample_resp.json()["id"]

    train_payload = {
        "task_type": "regression",
        "target_column": "Price",
        "feature_columns": ["SquareFootage", "Bedrooms", "Bathrooms", "Neighborhood"],
        "model_name": "DecisionTreeRegressor",
        "test_size": 0.2,
        "chronological_split": True,
        "random_state": 42
    }
    train_resp = client.post(f"/api/datasets/{dataset_id}/train", headers=auth_headers, json=train_payload)
    assert train_resp.status_code == 200
    res = train_resp.json()
    assert res["task_type"] == "regression"
    assert "r2_score" in res["metrics"]
    assert "baseline_mae" in res["metrics"]
    assert len(res["metrics"]["residuals_sample"]) > 0

def test_ml_clustering_dbscan(client, auth_headers):
    sample_resp = client.post("/api/datasets/sample/segmentation", headers=auth_headers)
    dataset_id = sample_resp.json()["id"]

    train_payload = {
        "task_type": "clustering",
        "feature_columns": ["Age", "AnnualIncome", "SpendingScore"],
        "model_name": "DBSCAN",
        "eps": 0.8,
        "min_samples": 5,
        "random_state": 42
    }
    train_resp = client.post(f"/api/datasets/{dataset_id}/train", headers=auth_headers, json=train_payload)
    assert train_resp.status_code == 200
    res = train_resp.json()
    assert res["task_type"] == "clustering"
    assert "silhouette_score" in res["metrics"]
    assert len(res["cluster_visual_data"]) > 0

# 9. GEMINI AI ASSISTANT HEALTH & GROUNDED CHAT TEST
def test_gemini_ai_health_and_grounded_response(client, auth_headers):
    # Health check endpoint
    health_resp = client.get("/api/ai/health")
    assert health_resp.status_code == 200
    health = health_resp.json()
    assert "status" in health
    assert "model" in health
    assert "connected" in health

    sample_resp = client.post("/api/datasets/sample/churn", headers=auth_headers)
    dataset_id = sample_resp.json()["id"]

    # Test chat with offline fallback
    chat_resp = client.post(f"/api/datasets/{dataset_id}/chat", headers=auth_headers, json={
        "message": "What is the data quality score and what are the main features?"
    })
    assert chat_resp.status_code == 200
    chat = chat_resp.json()
    assert chat["role"] == "assistant"
    assert len(chat["content"]) > 50

    # Test mocked Google Gemini API call
    with patch("requests.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [{"text": "Grounded Gemini Analysis: Based on the 500 rows in Telecom Customer Churn, the quality score is 89.2."}]
                    }
                }
            ]
        }
        mock_post.return_value = mock_resp

        # Set fake key temporarily
        with patch.object(settings, "GEMINI_API_KEY", "AIzaSyTestMockKey123"):
            chat_online = client.post(f"/api/datasets/{dataset_id}/chat", headers=auth_headers, json={
                "message": "Evaluate the customer churn patterns."
            })
            assert chat_online.status_code == 200
            assert "Grounded Gemini Analysis" in chat_online.json()["content"]

# 10. PDF & JSON EXPORT TESTS
def test_pdf_and_json_exports(client, auth_headers):
    sample_resp = client.post("/api/datasets/sample/churn", headers=auth_headers)
    dataset_id = sample_resp.json()["id"]

    # PDF download
    pdf_resp = client.get(f"/api/datasets/{dataset_id}/report/pdf", headers=auth_headers)
    assert pdf_resp.status_code == 200
    assert "application/pdf" in pdf_resp.headers["content-type"]
    assert "attachment" in pdf_resp.headers["content-disposition"]
    assert len(pdf_resp.content) > 1000

    # JSON Profiling export
    json_resp = client.get(f"/api/datasets/{dataset_id}/export/json", headers=auth_headers)
    assert json_resp.status_code == 200
    assert "application/json" in json_resp.headers["content-type"]
    assert "attachment" in json_resp.headers["content-disposition"]
    parsed = json.loads(json_resp.content.decode("utf-8"))
    assert "dataset_metadata" in parsed
    assert "profile_data" in parsed
    assert parsed["dataset_metadata"]["id"] == dataset_id

# 11. MULTI-TENANCY & OWNERSHIP SECURITY TEST
def test_dataset_ownership_security(client, auth_headers, second_user_headers):
    sample_resp = client.post("/api/datasets/sample/churn", headers=auth_headers)
    dataset_id = sample_resp.json()["id"]

    # User 2 attempts to read User 1's dataset -> must receive 404 / access denied
    forbidden_get = client.get(f"/api/datasets/{dataset_id}", headers=second_user_headers)
    assert forbidden_get.status_code == 404

    forbidden_preview = client.get(f"/api/datasets/{dataset_id}/preview", headers=second_user_headers)
    assert forbidden_preview.status_code == 404

    forbidden_pdf = client.get(f"/api/datasets/{dataset_id}/report/pdf", headers=second_user_headers)
    assert forbidden_pdf.status_code == 404

    forbidden_delete = client.delete(f"/api/datasets/{dataset_id}", headers=second_user_headers)
    assert forbidden_delete.status_code == 404
