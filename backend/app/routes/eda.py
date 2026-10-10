from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Dataset, User
from app.services.auth_service import get_current_user
from app.services.storage_service import load_csv_dataframe
from app.services.eda_service import (
    get_histogram_data, get_boxplot_data, get_violin_data, get_correlation_matrix,
    get_scatter_data, get_bubble_chart_data, get_scatter_matrix_data,
    get_categorical_bar_data, get_stacked_bar_data, get_timeseries_data,
    get_missing_values_chart_data, get_missing_matrix_data, get_distribution_comparison_data
)

router = APIRouter(prefix="/api/datasets", tags=["Exploratory Data Analysis"])

@router.get("/{dataset_id}/eda/histogram")
def get_column_histogram(
    dataset_id: str,
    column: str = Query(..., description="Numeric column name"),
    bins: int = Query(20, ge=5, le=100),
    use_cleaned: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    path = dataset.cleaned_storage_path if (use_cleaned and dataset.cleaned_storage_path) else dataset.storage_path
    df = load_csv_dataframe(path)
    res = get_histogram_data(df, column=column, bins=bins)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.get("/{dataset_id}/eda/boxplot")
def get_column_boxplot(
    dataset_id: str,
    numeric_column: str = Query(..., description="Target numeric column"),
    group_by: Optional[str] = Query(None, description="Optional categorical column for grouping"),
    use_cleaned: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    path = dataset.cleaned_storage_path if (use_cleaned and dataset.cleaned_storage_path) else dataset.storage_path
    df = load_csv_dataframe(path)
    res = get_boxplot_data(df, numeric_col=numeric_column, group_by_col=group_by)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.get("/{dataset_id}/eda/violin")
def get_column_violin(
    dataset_id: str,
    numeric_column: str = Query(..., description="Target numeric column"),
    group_by: Optional[str] = Query(None, description="Optional categorical column for grouping"),
    use_cleaned: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    path = dataset.cleaned_storage_path if (use_cleaned and dataset.cleaned_storage_path) else dataset.storage_path
    df = load_csv_dataframe(path)
    res = get_violin_data(df, numeric_col=numeric_column, group_by_col=group_by)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.get("/{dataset_id}/eda/correlations")
def get_correlations(
    dataset_id: str,
    use_cleaned: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    path = dataset.cleaned_storage_path if (use_cleaned and dataset.cleaned_storage_path) else dataset.storage_path
    df = load_csv_dataframe(path)
    return get_correlation_matrix(df)

@router.get("/{dataset_id}/eda/scatter")
def get_scatter_plot(
    dataset_id: str,
    x: str = Query(..., description="X-axis numeric column"),
    y: str = Query(..., description="Y-axis numeric column"),
    color: Optional[str] = Query(None, description="Optional color categorical column"),
    sample_size: int = Query(1000, ge=10, le=5000),
    use_cleaned: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    path = dataset.cleaned_storage_path if (use_cleaned and dataset.cleaned_storage_path) else dataset.storage_path
    df = load_csv_dataframe(path)
    res = get_scatter_data(df, x_col=x, y_col=y, color_col=color, sample_size=sample_size)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.get("/{dataset_id}/eda/bubble")
def get_bubble_plot(
    dataset_id: str,
    x: str = Query(..., description="X-axis numeric column"),
    y: str = Query(..., description="Y-axis numeric column"),
    size: str = Query(..., description="Size numeric column"),
    color: Optional[str] = Query(None, description="Optional color column"),
    use_cleaned: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    path = dataset.cleaned_storage_path if (use_cleaned and dataset.cleaned_storage_path) else dataset.storage_path
    df = load_csv_dataframe(path)
    res = get_bubble_chart_data(df, x_col=x, y_col=y, size_col=size, color_col=color)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.get("/{dataset_id}/eda/scatter-matrix")
def get_scatter_matrix(
    dataset_id: str,
    columns: str = Query(..., description="Comma-separated list of numeric columns"),
    use_cleaned: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    path = dataset.cleaned_storage_path if (use_cleaned and dataset.cleaned_storage_path) else dataset.storage_path
    df = load_csv_dataframe(path)
    col_list = [c.strip() for c in columns.split(",") if c.strip()]
    res = get_scatter_matrix_data(df, columns=col_list)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.get("/{dataset_id}/eda/barchart")
def get_categorical_bar(
    dataset_id: str,
    column: str = Query(..., description="Categorical column name"),
    top_n: int = Query(15, ge=2, le=50),
    use_cleaned: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    path = dataset.cleaned_storage_path if (use_cleaned and dataset.cleaned_storage_path) else dataset.storage_path
    df = load_csv_dataframe(path)
    res = get_categorical_bar_data(df, column=column, top_n=top_n)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.get("/{dataset_id}/eda/stacked-bar")
def get_stacked_bar(
    dataset_id: str,
    primary_column: str = Query(..., description="Primary categorical column"),
    secondary_column: str = Query(..., description="Secondary categorical column"),
    use_cleaned: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    path = dataset.cleaned_storage_path if (use_cleaned and dataset.cleaned_storage_path) else dataset.storage_path
    df = load_csv_dataframe(path)
    res = get_stacked_bar_data(df, primary_col=primary_column, secondary_col=secondary_column)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.get("/{dataset_id}/eda/timeseries")
def get_timeseries_plot(
    dataset_id: str,
    date_column: str = Query(..., description="Date/Datetime column"),
    value_column: str = Query(..., description="Numeric value column"),
    use_cleaned: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    path = dataset.cleaned_storage_path if (use_cleaned and dataset.cleaned_storage_path) else dataset.storage_path
    df = load_csv_dataframe(path)
    res = get_timeseries_data(df, date_col=date_column, value_col=value_column)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.get("/{dataset_id}/eda/missing")
def get_missing_chart(
    dataset_id: str,
    use_cleaned: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    path = dataset.cleaned_storage_path if (use_cleaned and dataset.cleaned_storage_path) else dataset.storage_path
    df = load_csv_dataframe(path)
    return get_missing_values_chart_data(df)

@router.get("/{dataset_id}/eda/missing-matrix")
def get_missing_matrix(
    dataset_id: str,
    use_cleaned: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    path = dataset.cleaned_storage_path if (use_cleaned and dataset.cleaned_storage_path) else dataset.storage_path
    df = load_csv_dataframe(path)
    return get_missing_matrix_data(df)

@router.get("/{dataset_id}/eda/distribution-comparison")
def get_distribution_comparison(
    dataset_id: str,
    columns: str = Query(..., description="Comma-separated list of numeric columns"),
    use_cleaned: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    path = dataset.cleaned_storage_path if (use_cleaned and dataset.cleaned_storage_path) else dataset.storage_path
    df = load_csv_dataframe(path)
    col_list = [c.strip() for c in columns.split(",") if c.strip()]
    res = get_distribution_comparison_data(df, columns=col_list)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res
