from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import List, Dict, Any, Optional
from datetime import datetime

# --- AUTH SCHEMAS ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: Optional[str] = None
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TokenData(BaseModel):
    user_id: Optional[str] = None

# --- DATASET SCHEMAS ---
class DatasetListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    original_filename: str
    file_size_bytes: int
    row_count: int
    column_count: int
    quality_score: float
    has_cleaned_version: bool = False
    created_at: datetime
    updated_at: datetime

class DatasetDetailResponse(DatasetListItem):
    storage_path: str
    cleaned_storage_path: Optional[str] = None
    profile_data: Optional[Dict[str, Any]] = None
    cleaning_stats: Optional[Dict[str, Any]] = None

class DatasetPreviewResponse(BaseModel):
    id: str
    name: str
    total_rows: int
    total_columns: int
    columns: List[str]
    dtypes: Dict[str, str]
    preview_rows: List[Dict[str, Any]]
    page: int
    page_size: int
    total_pages: int
    is_cleaned: bool = False

# --- PROFILING & QUALITY SCHEMAS ---
class ColumnSummary(BaseModel):
    name: str
    inferred_type: str  # numeric, categorical, datetime, boolean, text, constant
    dtype: str
    total_count: int
    missing_count: int
    missing_percentage: float
    unique_count: int
    unique_percentage: float
    is_constant: bool = False
    is_high_cardinality: bool = False
    stats: Optional[Dict[str, Any]] = None  # mean, std, min, 25%, 50%, 75%, max, skew, outliers_iqr
    top_categories: Optional[List[Dict[str, Any]]] = None # [{"value": "A", "count": 10, "percentage": 20.0}]

class QualityScoreDetail(BaseModel):
    overall_score: float # 0 - 100
    completeness_score: float
    uniqueness_score: float
    validity_score: float
    consistency_score: float
    grade: str # A, B, C, D, F
    breakdown_notes: List[str]

class DatasetProfile(BaseModel):
    dataset_id: str
    dataset_name: str
    row_count: int
    column_count: int
    memory_usage_mb: float
    duplicate_rows_count: int
    duplicate_rows_percentage: float
    missing_cells_count: int
    missing_cells_percentage: float
    numeric_columns_count: int
    categorical_columns_count: int
    datetime_columns_count: int
    constant_columns: List[str]
    highly_correlated_pairs: List[Dict[str, Any]]
    columns: List[ColumnSummary]
    quality: QualityScoreDetail

# --- CLEANING SCHEMAS ---
class CleaningOperation(BaseModel):
    op_type: str # 'remove_duplicates', 'drop_missing_rows', 'impute_missing', 'drop_columns', 'rename_columns', 'convert_type', 'treat_outliers', 'recalculate_derived'
    params: Dict[str, Any] = {}

class CleaningPipelineRequest(BaseModel):
    operations: List[CleaningOperation]
    save_as_new: bool = False
    new_dataset_name: Optional[str] = None

class CleaningDiffSummary(BaseModel):
    original_row_count: int
    new_row_count: int
    original_col_count: int
    new_col_count: int
    duplicates_removed: int
    missing_values_before: int
    missing_values_after: int
    quality_score_before: float
    quality_score_after: float
    applied_operations: List[Dict[str, Any]]
    derived_recommendations: Optional[List[Dict[str, Any]]] = None

# --- EDA SCHEMAS ---
class HistogramRequest(BaseModel):
    column: str
    bins: Optional[int] = 20

class BoxPlotRequest(BaseModel):
    numeric_column: str
    group_by_column: Optional[str] = None

class ScatterPlotRequest(BaseModel):
    x_column: str
    y_column: str
    color_column: Optional[str] = None
    sample_size: Optional[int] = 1000

class BarChartRequest(BaseModel):
    column: str
    top_n: Optional[int] = 15

# --- ML SCHEMAS ---
class MLTrainRequest(BaseModel):
    task_type: str # 'classification', 'regression', 'clustering'
    target_column: Optional[str] = None
    feature_columns: List[str]
    model_name: str
    test_size: Optional[float] = 0.2
    random_state: Optional[int] = 42
    chronological_split: Optional[bool] = False
    n_clusters: Optional[int] = 3
    eps: Optional[float] = 0.5
    min_samples: Optional[int] = 5
    hyperparameters: Optional[Dict[str, Any]] = None

class MLTrainResponse(BaseModel):
    model_run_id: str
    dataset_id: str
    task_type: str
    model_name: str
    target_column: Optional[str] = None
    feature_columns: List[str]
    metrics: Dict[str, Any]
    feature_importance: Optional[List[Dict[str, Any]]] = None
    confusion_matrix: Optional[List[List[int]]] = None
    class_labels: Optional[List[str]] = None
    cluster_centers: Optional[List[Dict[str, Any]]] = None
    cluster_counts: Optional[Dict[str, int]] = None
    cluster_visual_data: Optional[List[Dict[str, Any]]] = None
    warnings: Optional[List[str]] = None
    created_at: datetime

class SinglePredictRequest(BaseModel):
    features: Dict[str, Any]

class BatchPredictRequest(BaseModel):
    dataset_id: Optional[str] = None

class PredictResponse(BaseModel):
    predictions: List[Any]
    prediction_probabilities: Optional[List[Dict[str, float]]] = None
    download_url: Optional[str] = None

# --- AI / GEMINI CHAT SCHEMAS ---
class ChatMessageRequest(BaseModel):
    message: str
    include_context: bool = True

class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime
    gemini_active: bool = True
