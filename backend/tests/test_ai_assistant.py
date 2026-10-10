import os
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.services.gemini_service import (
    generate_ai_response,
    format_dataset_context_for_ai,
    get_effective_models
)

TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
Base.metadata.create_all(bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module")
def client():
    sample_dir = os.path.join(settings.BASE_DIR, "sample_data")
    try:
        from sample_data.sample_generator import generate_samples
        generate_samples(sample_dir)
    except Exception:
        pass
    return TestClient(app)

@pytest.fixture(scope="module")
def auth_headers(client):
    email = "ai_test_user@datapilot.ai"
    password = "TestPassword123!"
    resp = client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "AI Test User"
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_effective_models_ordering():
    models = get_effective_models()
    assert len(models) >= 3
    assert models[0] == (settings.GEMINI_MODEL or "gemini-3.5-flash")
    assert len(models) == len(set(models))

def test_format_dataset_context():
    dummy_profile = {
        "row_count": 500,
        "column_count": 4,
        "missing_cells_percentage": 1.2,
        "duplicate_rows_percentage": 0.0,
        "quality": {
            "overall_score": 94.5,
            "grade": "A",
            "completeness_score": 98.8,
            "uniqueness_score": 100,
            "validity_score": 96.0,
            "consistency_score": 97.0,
            "breakdown_notes": ["High quality data"]
        },
        "highly_correlated_pairs": [
            {"column_1": "MonthlyCharges", "column_2": "TotalCharges", "correlation": 0.85}
        ],
        "columns": [
            {
                "name": "Tenure",
                "inferred_type": "numeric",
                "missing_percentage": 0.0,
                "missing_count": 0,
                "unique_count": 72,
                "stats": {"mean": 32.4, "median": 29.0, "min": 1, "max": 72, "outlier_count": 0}
            }
        ]
    }
    context = format_dataset_context_for_ai(
        dataset_name="TestDataset.csv",
        profile_data=dummy_profile,
        model_runs=[{"model_name": "RandomForest", "task_type": "classification", "target_column": "Churn", "metrics": {"accuracy": 0.84}}],
        sample_rows=[{"Tenure": 12, "MonthlyCharges": 45.5}]
    )
    assert "TestDataset.csv" in context
    assert "500 rows" in context
    assert "94.5/100" in context
    assert "RandomForest" in context
    assert "MonthlyCharges & TotalCharges" in context

def test_ai_health_endpoint(client):
    resp = client.get("/api/ai/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "connected" in data
    assert "model" in data
    assert "message" in data
    # Ensure raw API key is never exposed in response
    assert settings.GEMINI_API_KEY not in str(data) or not settings.GEMINI_API_KEY

def test_ai_offline_fallback():
    dummy_profile = {
        "row_count": 250,
        "column_count": 3,
        "missing_cells_percentage": 0.0,
        "duplicate_rows_percentage": 0.0,
        "quality": {"overall_score": 98.0, "grade": "A"}
    }
    with patch("app.services.gemini_service.get_effective_gemini_key", return_value=""):
        resp_text, is_active = generate_ai_response(
            user_prompt="Explain data quality",
            dataset_name="demo.csv",
            profile_data=dummy_profile,
            conversation_history=[]
        )
        assert is_active is False
        assert "Offline Statistical Mode" in resp_text
        assert "demo.csv" in resp_text

def test_ai_chat_end_to_end(client, auth_headers):
    sample_resp = client.post("/api/datasets/sample/churn", headers=auth_headers)
    assert sample_resp.status_code == 201
    dataset_id = sample_resp.json()["id"]

    # Send first message
    chat_resp = client.post(
        f"/api/datasets/{dataset_id}/chat",
        headers=auth_headers,
        json={"message": "What is the primary target variable and what features correlate with it?"}
    )
    assert chat_resp.status_code == 200
    res_data = chat_resp.json()
    assert res_data["role"] == "assistant"
    assert len(res_data["content"]) > 30

    # Retrieve chat history
    history_resp = client.get(f"/api/datasets/{dataset_id}/chat/history", headers=auth_headers)
    assert history_resp.status_code == 200
    history = history_resp.json()
    assert len(history) >= 2
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "assistant"

    # Send second multi-turn message
    chat_resp_2 = client.post(
        f"/api/datasets/{dataset_id}/chat",
        headers=auth_headers,
        json={"message": "What model do you recommend for predicting churn?"}
    )
    assert chat_resp_2.status_code == 200
    assert len(chat_resp_2.json()["content"]) > 30

    # Clear chat history
    clear_resp = client.delete(f"/api/datasets/{dataset_id}/chat/history", headers=auth_headers)
    assert clear_resp.status_code == 200
    
    empty_history = client.get(f"/api/datasets/{dataset_id}/chat/history", headers=auth_headers).json()
    assert len(empty_history) == 0
