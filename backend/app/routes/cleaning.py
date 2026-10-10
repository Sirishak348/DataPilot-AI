from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import json

from app.database import get_db
from app.models.models import Dataset, User, CleaningHistory
from app.schemas.schemas import CleaningPipelineRequest, CleaningDiffSummary
from app.services.auth_service import get_current_user
from app.services.storage_service import load_csv_dataframe, save_dataframe_to_csv
from app.services.cleaning_service import run_cleaning_pipeline, detect_derived_columns

router = APIRouter(prefix="/api/datasets", tags=["Data Cleaning"])

@router.get("/{dataset_id}/derived-recommendations")
def get_derived_feature_recommendations(
    dataset_id: str,
    use_cleaned: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Detects if any features are mathematically derived (e.g. Wind+Solar = Wind + Solar)
    and provides cleaning recommendations.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    path = dataset.cleaned_storage_path if (use_cleaned and dataset.cleaned_storage_path) else dataset.storage_path
    df = load_csv_dataframe(path)
    return detect_derived_columns(df)

@router.post("/{dataset_id}/preview-clean", response_model=CleaningDiffSummary)
def preview_cleaning_pipeline(
    dataset_id: str,
    req: CleaningPipelineRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Simulates cleaning transformations and returns a before-and-after audit diff without mutating stored files.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    df = load_csv_dataframe(dataset.storage_path)
    _, diff_summary = run_cleaning_pipeline(df, req.operations, dataset.id, dataset.name)
    return diff_summary

@router.post("/{dataset_id}/apply-clean")
def apply_cleaning_pipeline(
    dataset_id: str,
    req: CleaningPipelineRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Applies cleaning transformations, saves the cleaned dataset as an artifact,
    persists audit logs, and updates dataset records while preserving the original.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    df = load_csv_dataframe(dataset.storage_path)
    cleaned_df, diff_summary = run_cleaning_pipeline(df, req.operations, dataset.id, dataset.name)

    if req.save_as_new:
        # Save as a brand new dataset entry
        new_name = req.new_dataset_name or f"{dataset.name} (Cleaned)"
        new_path = save_dataframe_to_csv(cleaned_df, subfolder="datasets", prefix="cleaned_")
        
        new_dataset = Dataset(
            user_id=current_user.id,
            name=new_name,
            original_filename=f"cleaned_{dataset.original_filename}",
            storage_path=new_path,
            file_size_bytes=len(cleaned_df.to_csv(index=False).encode('utf-8')),
            row_count=len(cleaned_df),
            column_count=len(cleaned_df.columns),
            quality_score=diff_summary.get("quality_score_after", 0.0),
            profile_data=diff_summary.get("final_profile"),
            cleaning_stats=diff_summary
        )
        db.add(new_dataset)
        db.commit()
        db.refresh(new_dataset)
        return {
            "message": "Cleaned dataset saved as a new dataset successfully.",
            "dataset_id": new_dataset.id,
            "diff_summary": diff_summary
        }
    else:
        # Save as cleaned artifact for current dataset
        cleaned_path = save_dataframe_to_csv(cleaned_df, subfolder="cleaned", prefix="cleaned_")
        dataset.cleaned_storage_path = cleaned_path
        dataset.cleaning_stats = diff_summary
        dataset.quality_score = diff_summary.get("quality_score_after", dataset.quality_score)

        # Record audit history entries
        for op in req.operations:
            audit = CleaningHistory(
                dataset_id=dataset.id,
                user_id=current_user.id,
                action_type=op.op_type,
                details=op.params
            )
            db.add(audit)

        db.commit()
        db.refresh(dataset)

        return {
            "message": "Dataset cleaned successfully.",
            "dataset_id": dataset.id,
            "diff_summary": diff_summary
        }

@router.post("/{dataset_id}/reset-clean")
def reset_cleaned_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Resets dataset to original uploaded state."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    dataset.cleaned_storage_path = None
    dataset.cleaning_stats = None
    db.commit()
    return {"message": "Dataset reset to original state."}
