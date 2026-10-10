from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Dataset, User
from app.schemas.schemas import DatasetProfile
from app.services.auth_service import get_current_user
from app.services.storage_service import load_csv_dataframe
from app.services.profiling_service import profile_dataset

router = APIRouter(prefix="/api/datasets", tags=["Profiling & Quality"])

@router.get("/{dataset_id}/profile", response_model=DatasetProfile)
def get_dataset_profiling(
    dataset_id: str,
    refresh: bool = False,
    use_cleaned: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns or recalculates the full automated profile and data quality assessment for the dataset.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    file_path = dataset.cleaned_storage_path if (use_cleaned and dataset.cleaned_storage_path) else dataset.storage_path

    # If profile data is cached and not refreshing/cleaned, return it
    if not refresh and not use_cleaned and dataset.profile_data:
        return dataset.profile_data

    df = load_csv_dataframe(file_path)
    profile = profile_dataset(df, dataset_id=dataset.id, dataset_name=dataset.name)

    if not use_cleaned:
        dataset.profile_data = profile
        dataset.quality_score = profile.get("quality", {}).get("overall_score", dataset.quality_score)
        db.commit()

    return profile
