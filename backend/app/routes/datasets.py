import os
import shutil
import pandas as pd
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Dataset, User, CleaningHistory, ModelRun, ChatMessage
from app.schemas.schemas import DatasetListItem, DatasetDetailResponse, DatasetPreviewResponse
from app.services.auth_service import get_current_user
from app.services.storage_service import save_uploaded_file, load_csv_dataframe, sanitize_filename
from app.services.profiling_service import profile_dataset
from app.config import settings

router = APIRouter(prefix="/api/datasets", tags=["Datasets"])

SAMPLE_DATA_DIR = os.path.join(settings.BASE_DIR, "sample_data")

@router.post("/upload", response_model=DatasetDetailResponse, status_code=status.HTTP_201_CREATED)
def upload_dataset(
    file: UploadFile = File(...),
    name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Accepts CSV upload, validates format and size, stores file safely,
    computes automated profile and initial quality score, and saves metadata.
    """
    orig_name, storage_path, file_size = save_uploaded_file(file)
    dataset_name = (name.strip() if name and name.strip() else orig_name.rsplit(".", 1)[0])

    try:
        df = load_csv_dataframe(storage_path)
    except Exception as e:
        if os.path.exists(storage_path):
            os.remove(storage_path)
        raise HTTPException(status_code=400, detail=f"Failed to read CSV: {str(e)}")

    row_count = len(df)
    col_count = len(df.columns)

    # Automated Profiling
    profile_data = profile_dataset(df, dataset_id="temp", dataset_name=dataset_name)
    quality_score = profile_data.get("quality", {}).get("overall_score", 0.0)

    dataset_record = Dataset(
        user_id=current_user.id,
        name=dataset_name,
        original_filename=orig_name,
        storage_path=storage_path,
        file_size_bytes=file_size,
        row_count=row_count,
        column_count=col_count,
        quality_score=quality_score,
        profile_data=profile_data
    )
    db.add(dataset_record)
    db.commit()
    db.refresh(dataset_record)

    # Update profile with real dataset ID
    profile_data["dataset_id"] = dataset_record.id
    dataset_record.profile_data = profile_data
    db.commit()
    db.refresh(dataset_record)

    return dataset_record

@router.post("/sample/{sample_type}", response_model=DatasetDetailResponse, status_code=status.HTTP_201_CREATED)
def load_sample_dataset(
    sample_type: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Pre-loads a curated sample dataset (churn, housing, segmentation) for immediate testing.
    """
    sample_map = {
        "churn": ("Telecom Customer Churn.csv", "telecom_customer_churn.csv"),
        "housing": ("Real Estate Housing Prices.csv", "real_estate_housing.csv"),
        "segmentation": ("Customer Segmentation.csv", "customer_segmentation.csv")
    }

    if sample_type.lower() not in sample_map:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sample type '{sample_type}'. Choose from: {list(sample_map.keys())}"
        )

    display_name, filename = sample_map[sample_type.lower()]
    source_path = os.path.join(SAMPLE_DATA_DIR, filename)

    if not os.path.exists(source_path):
        # Generate samples if not already present
        try:
            import sys
            if settings.BASE_DIR not in sys.path:
                sys.path.insert(0, str(settings.BASE_DIR))
            from sample_data.sample_generator import generate_samples
            generate_samples(SAMPLE_DATA_DIR)
        except Exception as e:
            pass

    # Copy to user's dataset storage
    import uuid
    dest_filename = f"{uuid.uuid4()}_{filename}"
    dest_path = os.path.join(settings.STORAGE_DIR, "datasets", dest_filename)
    shutil.copyfile(source_path, dest_path)
    file_size = os.path.getsize(dest_path)

    df = load_csv_dataframe(dest_path)
    row_count = len(df)
    col_count = len(df.columns)

    profile_data = profile_dataset(df, dataset_id="temp", dataset_name=display_name)
    quality_score = profile_data.get("quality", {}).get("overall_score", 0.0)

    dataset_record = Dataset(
        user_id=current_user.id,
        name=display_name,
        original_filename=filename,
        storage_path=dest_path,
        file_size_bytes=file_size,
        row_count=row_count,
        column_count=col_count,
        quality_score=quality_score,
        profile_data=profile_data
    )
    db.add(dataset_record)
    db.commit()
    db.refresh(dataset_record)

    profile_data["dataset_id"] = dataset_record.id
    dataset_record.profile_data = profile_data
    db.commit()
    db.refresh(dataset_record)

    return dataset_record

@router.get("", response_model=List[DatasetListItem])
def list_user_datasets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists all datasets uploaded by the current user."""
    datasets = db.query(Dataset).filter(Dataset.user_id == current_user.id).order_by(Dataset.created_at.desc()).all()
    results = []
    for d in datasets:
        results.append(DatasetListItem(
            id=d.id,
            name=d.name,
            original_filename=d.original_filename,
            file_size_bytes=d.file_size_bytes,
            row_count=d.row_count,
            column_count=d.column_count,
            quality_score=d.quality_score,
            has_cleaned_version=bool(d.cleaned_storage_path),
            created_at=d.created_at,
            updated_at=d.updated_at
        ))
    return results

@router.get("/{dataset_id}", response_model=DatasetDetailResponse)
def get_dataset_details(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves dataset details with profile data, enforcing user ownership."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")
    return dataset

@router.get("/{dataset_id}/preview", response_model=DatasetPreviewResponse)
def get_dataset_preview(
    dataset_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    use_cleaned: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns paginated preview rows from either original or cleaned dataset."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    file_path = dataset.cleaned_storage_path if (use_cleaned and dataset.cleaned_storage_path) else dataset.storage_path
    df = load_csv_dataframe(file_path)

    if search and search.strip():
        q = search.strip().lower()
        mask = df.astype(str).apply(lambda row: row.str.lower().str.contains(q, regex=False)).any(axis=1)
        df = df[mask]

    total_rows = len(df)
    total_cols = len(df.columns)
    total_pages = max(1, (total_rows + page_size - 1) // page_size)

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    page_df = df.iloc[start_idx:end_idx].copy()

    # Convert NaNs to None for valid JSON serialization
    page_records = page_df.where(pd.notnull(page_df), None).to_dict(orient="records")
    dtypes_dict = {col: str(df[col].dtype) for col in df.columns}

    return DatasetPreviewResponse(
        id=dataset.id,
        name=dataset.name,
        total_rows=total_rows,
        total_columns=total_cols,
        columns=df.columns.tolist(),
        dtypes=dtypes_dict,
        preview_rows=page_records,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        is_cleaned=use_cleaned and bool(dataset.cleaned_storage_path)
    )

@router.get("/{dataset_id}/download")
def download_dataset_csv(
    dataset_id: str,
    version: str = Query("original", pattern="^(original|cleaned)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Downloads dataset CSV with validation of file existence and ownership."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    if version == "cleaned":
        if not dataset.cleaned_storage_path or not os.path.exists(dataset.cleaned_storage_path):
            raise HTTPException(status_code=400, detail="Cleaned version does not exist for this dataset.")
        file_path = dataset.cleaned_storage_path
        dl_filename = f"cleaned_{sanitize_filename(dataset.name)}.csv"
    else:
        file_path = dataset.storage_path
        dl_filename = sanitize_filename(dataset.original_filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found in storage.")

    return FileResponse(
        path=file_path,
        filename=dl_filename,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{dl_filename}"'}
    )

@router.delete("/{dataset_id}", status_code=status.HTTP_200_OK)
def delete_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deletes dataset, associated files, and cascading records."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    # Remove storage files safely
    for path in [dataset.storage_path, dataset.cleaned_storage_path]:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass

    db.delete(dataset)
    db.commit()
    return {"message": "Dataset deleted successfully", "dataset_id": dataset_id}
