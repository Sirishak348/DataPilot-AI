import os
import uuid
import shutil
import pandas as pd
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Dataset, User, ModelRun
from app.schemas.schemas import (
    MLTrainRequest, MLTrainResponse, SinglePredictRequest, PredictResponse
)
from app.services.auth_service import get_current_user
from app.services.storage_service import load_csv_dataframe, save_dataframe_to_csv, sanitize_filename
from app.services.ml_service import (
    train_classification_model, train_regression_model, train_clustering_model, run_predictions
)
from app.config import settings

router = APIRouter(tags=["Machine Learning"])

@router.post("/api/datasets/{dataset_id}/train", response_model=MLTrainResponse)
def train_model(
    dataset_id: str,
    req: MLTrainRequest,
    use_cleaned: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Trains a Scikit-Learn Pipeline (Classification, Regression, or Clustering) with preprocessors,
    calculates performance metrics & baselines, persists the model artifact, and records metadata.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    path = dataset.cleaned_storage_path if (use_cleaned and dataset.cleaned_storage_path) else dataset.storage_path
    df = load_csv_dataframe(path)

    # Validate feature columns exist in dataset
    missing_features = [f for f in req.feature_columns if f not in df.columns]
    if missing_features:
        raise HTTPException(status_code=400, detail=f"Feature columns not found: {missing_features}")

    try:
        if req.task_type == "classification":
            if not req.target_column:
                raise HTTPException(status_code=400, detail="Target column is required for classification.")
            result = train_classification_model(
                df=df,
                target_column=req.target_column,
                feature_columns=req.feature_columns,
                model_name=req.model_name,
                test_size=req.test_size or 0.2,
                random_state=req.random_state or 42,
                hyperparams=req.hyperparameters,
                chronological_split=bool(req.chronological_split)
            )
        elif req.task_type == "regression":
            if not req.target_column:
                raise HTTPException(status_code=400, detail="Target column is required for regression.")
            result = train_regression_model(
                df=df,
                target_column=req.target_column,
                feature_columns=req.feature_columns,
                model_name=req.model_name,
                test_size=req.test_size or 0.2,
                random_state=req.random_state or 42,
                hyperparams=req.hyperparameters,
                chronological_split=bool(req.chronological_split)
            )
        elif req.task_type == "clustering":
            result = train_clustering_model(
                df=df,
                feature_columns=req.feature_columns,
                model_name=req.model_name or "KMeans",
                n_clusters=req.n_clusters or 3,
                eps=float(req.eps or 0.5),
                min_samples=int(req.min_samples or 5),
                random_state=req.random_state or 42
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported task type '{req.task_type}'.")

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")

    # Persist model run in database
    model_run = ModelRun(
        id=result["model_run_id"],
        dataset_id=dataset.id,
        user_id=current_user.id,
        task_type=result["task_type"],
        model_name=result["model_name"],
        target_column=result.get("target_column"),
        feature_columns=result["feature_columns"],
        hyperparameters=req.hyperparameters,
        metrics=result["metrics"],
        artifact_path=result["artifact_path"],
        feature_importance=result.get("feature_importance")
    )
    db.add(model_run)
    db.commit()
    db.refresh(model_run)

    return MLTrainResponse(
        model_run_id=model_run.id,
        dataset_id=dataset.id,
        task_type=model_run.task_type,
        model_name=model_run.model_name,
        target_column=model_run.target_column,
        feature_columns=model_run.feature_columns,
        metrics=model_run.metrics,
        feature_importance=result.get("feature_importance"),
        confusion_matrix=result.get("confusion_matrix"),
        class_labels=result.get("class_labels"),
        cluster_centers=result.get("cluster_centers"),
        cluster_counts=result.get("cluster_counts"),
        cluster_visual_data=result.get("cluster_visual_data"),
        warnings=result.get("warnings"),
        created_at=model_run.created_at
    )

@router.get("/api/datasets/{dataset_id}/models")
def list_dataset_model_runs(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    runs = db.query(ModelRun).filter(ModelRun.dataset_id == dataset_id, ModelRun.user_id == current_user.id).order_by(ModelRun.created_at.desc()).all()
    return runs

@router.get("/api/models/{model_run_id}")
def get_model_details(
    model_run_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    model_run = db.query(ModelRun).filter(ModelRun.id == model_run_id, ModelRun.user_id == current_user.id).first()
    if not model_run:
        raise HTTPException(status_code=404, detail="Model run not found or access denied.")
    return model_run

@router.post("/api/models/{model_run_id}/predict-single", response_model=PredictResponse)
def predict_single_instance(
    model_run_id: str,
    req: SinglePredictRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    model_run = db.query(ModelRun).filter(ModelRun.id == model_run_id, ModelRun.user_id == current_user.id).first()
    if not model_run:
        raise HTTPException(status_code=404, detail="Model run not found or access denied.")

    input_df = pd.DataFrame([req.features])
    try:
        preds, probs = run_predictions(model_run.artifact_path, input_df)
        return PredictResponse(
            predictions=preds,
            prediction_probabilities=probs,
            download_url=None
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Prediction error: {str(e)}")

@router.post("/api/models/{model_run_id}/predict-batch")
def predict_batch_csv(
    model_run_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    model_run = db.query(ModelRun).filter(ModelRun.id == model_run_id, ModelRun.user_id == current_user.id).first()
    if not model_run:
        raise HTTPException(status_code=404, detail="Model run not found or access denied.")

    # Save temporary CSV to predict
    unique_pred_id = str(uuid.uuid4())
    temp_path = os.path.join(settings.STORAGE_DIR, "predictions", f"input_{unique_pred_id}.csv")
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        input_df = load_csv_dataframe(temp_path)
        preds, probs = run_predictions(model_run.artifact_path, input_df)

        result_df = input_df.copy()
        result_df["Predicted_Output"] = preds
        
        if probs and len(probs) == len(result_df):
            for k in probs[0].keys():
                result_df[f"Prob_{k}"] = [p.get(k, 0.0) for p in probs]

        output_path = os.path.join(settings.STORAGE_DIR, "predictions", f"output_{unique_pred_id}.csv")
        result_df.to_csv(output_path, index=False)

        preview_rows = result_df.head(20).to_dict(orient="records")

        return {
            "prediction_job_id": unique_pred_id,
            "total_rows": len(result_df),
            "preview": preview_rows,
            "download_url": f"/api/models/{model_run.id}/predictions/{unique_pred_id}/download"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Batch prediction error: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@router.get("/api/models/{model_run_id}/predictions/{pred_id}/download")
def download_prediction_results(
    model_run_id: str,
    pred_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    model_run = db.query(ModelRun).filter(ModelRun.id == model_run_id, ModelRun.user_id == current_user.id).first()
    if not model_run:
        raise HTTPException(status_code=404, detail="Model run not found or access denied.")

    file_path = os.path.join(settings.STORAGE_DIR, "predictions", f"output_{pred_id}.csv")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Prediction file not found.")

    return FileResponse(
        path=file_path,
        filename=f"predictions_{sanitize_filename(model_run.model_name)}_{pred_id[:8]}.csv",
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="predictions_{sanitize_filename(model_run.model_name)}_{pred_id[:8]}.csv"'}
    )
