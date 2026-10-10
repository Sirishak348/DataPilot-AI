import os
import json
import math
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Dataset, User, ModelRun
from app.services.auth_service import get_current_user
from app.services.report_service import generate_pdf_report
from app.services.storage_service import sanitize_filename

router = APIRouter(prefix="/api/datasets", tags=["Reports & Exports"])

class SafeJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder to safely handle NaNs, infinities, numpy types, and datetimes."""
    def default(self, obj):
        if isinstance(obj, (np.integer, np.int64, np.int32)):
            return int(obj)
        elif isinstance(obj, (np.floating, np.float64, np.float32)):
            if math.isnan(obj) or math.isinf(obj):
                return None
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, (pd.Timestamp, np.datetime64)):
            return str(obj)
        return super().default(obj)

@router.get("/{dataset_id}/report/pdf")
def download_pdf_report(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generates and downloads a comprehensive executive PDF report with actual dataset analytics,
    schema breakdown, data quality audit, cleaning audit trail, and ML evaluation metrics.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    if not dataset.profile_data:
        raise HTTPException(status_code=400, detail="Dataset profile data not available to generate report.")

    model_runs = db.query(ModelRun).filter(
        ModelRun.dataset_id == dataset.id,
        ModelRun.user_id == current_user.id
    ).all()
    model_runs_data = [
        {"model_name": m.model_name, "task_type": m.task_type, "target_column": m.target_column, "metrics": m.metrics}
        for m in model_runs
    ]

    try:
        pdf_path = generate_pdf_report(
            dataset_name=dataset.name,
            profile_data=dataset.profile_data,
            cleaning_stats=dataset.cleaning_stats,
            model_runs=model_runs_data
        )

        clean_name = sanitize_filename(dataset.name).replace(" ", "_")
        filename = f"DataPilot_Report_{clean_name}.pdf"
        return FileResponse(
            path=pdf_path,
            filename=filename,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF report: {str(e)}")

@router.get("/{dataset_id}/export/json")
def export_dataset_json_profiling(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Exports full dataset profiling data, data quality metrics, and audit history as UTF-8 JSON.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    model_runs = db.query(ModelRun).filter(
        ModelRun.dataset_id == dataset.id,
        ModelRun.user_id == current_user.id
    ).all()
    model_runs_data = [
        {"model_name": m.model_name, "task_type": m.task_type, "target_column": m.target_column, "metrics": m.metrics}
        for m in model_runs
    ]

    export_payload = {
        "dataset_metadata": {
            "id": dataset.id,
            "name": dataset.name,
            "original_filename": dataset.original_filename,
            "file_size_bytes": dataset.file_size_bytes,
            "row_count": dataset.row_count,
            "column_count": dataset.column_count,
            "quality_score": dataset.quality_score,
            "has_cleaned_version": bool(dataset.cleaned_storage_path),
            "created_at": str(dataset.created_at),
            "updated_at": str(dataset.updated_at)
        },
        "profile_data": dataset.profile_data,
        "cleaning_stats": dataset.cleaning_stats,
        "model_runs": model_runs_data
    }

    clean_name = sanitize_filename(dataset.name).replace(" ", "_")
    filename = f"DataPilot_Profile_{clean_name}.json"
    json_bytes = json.dumps(export_payload, cls=SafeJSONEncoder, indent=2).encode('utf-8')

    return Response(
        content=json_bytes,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
