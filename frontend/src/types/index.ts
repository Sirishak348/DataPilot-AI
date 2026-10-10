export interface User {
  id: string;
  email: string;
  full_name?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ColumnSummary {
  name: string;
  inferred_type: 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'constant' | 'text' | 'empty';
  dtype: string;
  total_count: number;
  missing_count: number;
  missing_percentage: number;
  unique_count: number;
  unique_percentage: number;
  is_constant: boolean;
  is_high_cardinality: boolean;
  stats?: {
    count: number;
    mean: number;
    std: number;
    min: number;
    q25: number;
    median: number;
    q75: number;
    max: number;
    skewness: number;
    iqr: number;
    lower_bound: number;
    upper_bound: number;
    outlier_count: number;
    outlier_percentage: number;
  };
  top_categories?: Array<{
    value: string;
    count: number;
    percentage: number;
  }>;
}

export interface QualityScoreDetail {
  overall_score: number;
  completeness_score: number;
  uniqueness_score: number;
  validity_score: number;
  consistency_score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown_notes: string[];
}

export interface DatasetProfile {
  dataset_id: string;
  dataset_name: string;
  row_count: number;
  column_count: number;
  memory_usage_mb: number;
  duplicate_rows_count: number;
  duplicate_rows_percentage: number;
  missing_cells_count: number;
  missing_cells_percentage: number;
  numeric_columns_count: number;
  categorical_columns_count: number;
  datetime_columns_count: number;
  constant_columns: string[];
  highly_correlated_pairs: Array<{
    column_1: string;
    column_2: string;
    correlation: number;
  }>;
  columns: ColumnSummary[];
  quality: QualityScoreDetail;
}

export interface DatasetItem {
  id: string;
  name: string;
  original_filename: string;
  file_size_bytes: number;
  row_count: number;
  column_count: number;
  quality_score: number;
  has_cleaned_version: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatasetPreview {
  id: string;
  name: string;
  total_rows: number;
  total_columns: number;
  columns: string[];
  dtypes: Record<string, string>;
  preview_rows: Array<Record<string, any>>;
  page: number;
  page_size: number;
  total_pages: number;
  is_cleaned: boolean;
}

export interface DerivedRecommendation {
  derived_column: string;
  source_columns: string[];
  operation: string;
  formula: string;
  confidence: number;
  message: string;
}

export interface CleaningOperation {
  op_type: 'remove_duplicates' | 'drop_missing_rows' | 'impute_missing' | 'drop_columns' | 'rename_columns' | 'convert_type' | 'treat_outliers' | 'recalculate_derived';
  params: Record<string, any>;
}

export interface DiffSummary {
  original_row_count: number;
  new_row_count: number;
  original_col_count: number;
  new_col_count: number;
  duplicates_removed: number;
  missing_values_before: number;
  missing_values_after: number;
  quality_score_before: number;
  quality_score_after: number;
  applied_operations: Array<Record<string, any>>;
  derived_recommendations?: DerivedRecommendation[];
  final_profile?: DatasetProfile;
}

export interface MLTrainRequest {
  task_type: 'classification' | 'regression' | 'clustering';
  target_column?: string;
  feature_columns: string[];
  model_name: string;
  test_size?: number;
  random_state?: number;
  chronological_split?: boolean;
  n_clusters?: number;
  eps?: number;
  min_samples?: number;
  hyperparameters?: Record<string, any>;
}

export interface MLTrainResponse {
  model_run_id: string;
  dataset_id: string;
  task_type: 'classification' | 'regression' | 'clustering';
  model_name: string;
  target_column?: string;
  feature_columns: string[];
  metrics: Record<string, any>;
  feature_importance?: Array<{ feature: string; importance: number }>;
  confusion_matrix?: number[][];
  class_labels?: string[];
  cluster_centers?: Array<Record<string, any>>;
  cluster_counts?: Record<string, number>;
  cluster_visual_data?: Array<{ pca_x: number; pca_y: number; cluster: string }>;
  warnings?: string[];
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  gemini_active?: boolean;
}

export interface AIHealthStatus {
  status: 'ready' | 'missing_key' | 'invalid_key' | 'quota_exceeded' | 'network_error' | 'error';
  connected: boolean;
  model: string;
  message: string;
}
