import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional
from app.schemas.schemas import CleaningOperation
from app.services.profiling_service import profile_dataset, infer_column_type

def detect_derived_columns(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Inspects dataset to detect if any column is demonstrably derived from other columns (e.g. Wind+Solar = Wind + Solar).
    Returns recommendations for recalculation after base feature cleaning.
    """
    recommendations = []
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    # Check common derived column names like 'Wind+Solar', 'Total', 'Sum', etc.
    for col in df.columns:
        if col in numeric_cols:
            if "+" in col:
                parts = [p.strip() for p in col.split("+")]
                if len(parts) == 2 and parts[0] in df.columns and parts[1] in df.columns:
                    # Test if col equals sum of parts on non-null rows
                    sub = df[[col, parts[0], parts[1]]].dropna()
                    if len(sub) > 0:
                        diff = (sub[col] - (sub[parts[0]] + sub[parts[1]])).abs()
                        if (diff < 1e-3).mean() > 0.95:
                            recommendations.append({
                                "derived_column": col,
                                "source_columns": parts,
                                "operation": "sum",
                                "formula": f"{col} = {parts[0]} + {parts[1]}",
                                "confidence": 1.0,
                                "message": f"Column '{col}' is mathematically equal to '{parts[0]}' + '{parts[1]}'. We recommend recalculating it after cleaning source columns."
                            })

    return recommendations

def validate_cleaning_operation(df: pd.DataFrame, op: CleaningOperation) -> Optional[str]:
    """
    Validates a cleaning operation against the DataFrame schema and types.
    Returns None if valid, or an error message string if invalid.
    """
    op_type = op.op_type
    params = op.params or {}

    if op_type == "drop_columns":
        cols = params.get("columns", [])
        if not cols:
            return "No columns specified to drop."
        remaining = [c for c in df.columns if c not in cols]
        if len(remaining) == 0:
            return "Invalid operation: Cannot drop all columns from the dataset."

    elif op_type == "rename_columns":
        mapping = params.get("mapping", {})
        if not mapping:
            return "No column rename mapping provided."
        for old_name, new_name in mapping.items():
            if old_name not in df.columns:
                return f"Column '{old_name}' does not exist in dataset."
            if not new_name or not new_name.strip():
                return f"New name for '{old_name}' cannot be empty."
            clean_new = new_name.strip()
            if clean_new in df.columns and clean_new != old_name:
                return f"Cannot rename '{old_name}' to '{clean_new}': a column with that name already exists."

    elif op_type == "impute_missing":
        col = params.get("column")
        if not col or col not in df.columns:
            return f"Column '{col}' not found in dataset."

        strategy = params.get("strategy", "mean").lower()
        col_type = infer_column_type(df[col])
        is_numeric = pd.api.types.is_numeric_dtype(df[col]) or col_type == "numeric"

        if strategy in ("mean", "median"):
            if not is_numeric or col_type in ("datetime", "categorical", "text", "boolean"):
                return f"Invalid strategy '{strategy}' for column '{col}' ({col_type}). Mean and Median imputation can only be applied to numeric columns."

        if strategy == "constant" and params.get("fill_value") is None:
            return f"Fill value must be specified for constant imputation on column '{col}'."

    elif op_type == "treat_outliers":
        col = params.get("column")
        if not col or col not in df.columns:
            return f"Column '{col}' not found in dataset."
        if not pd.api.types.is_numeric_dtype(df[col]):
            return f"Outlier treatment is only applicable to numeric columns. Column '{col}' is of non-numeric type."

    elif op_type == "convert_type":
        col = params.get("column")
        if not col or col not in df.columns:
            return f"Column '{col}' not found in dataset."
        target_type = params.get("target_type")
        valid_types = ["int", "float", "string", "datetime", "category", "boolean"]
        if target_type not in valid_types:
            return f"Unsupported target type '{target_type}'. Valid types are: {', '.join(valid_types)}."

    elif op_type == "recalculate_derived":
        target_col = params.get("target_column")
        sources = params.get("source_columns", [])
        if not target_col:
            return "Target column is required for derived calculation."
        for s in sources:
            if s not in df.columns:
                return f"Source column '{s}' not found in dataset."

    return None

def apply_cleaning_operation(df: pd.DataFrame, op: CleaningOperation) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Applies a validated cleaning operation on a DataFrame copy.
    Returns: (transformed_df, audit_log_entry)
    """
    df = df.copy()
    op_type = op.op_type
    params = op.params or {}
    log = {"action": op_type, "params": params, "status": "success", "message": "", "rows_affected": 0, "columns_affected": []}

    # Pre-validation check
    val_error = validate_cleaning_operation(df, op)
    if val_error:
        log["status"] = "error"
        log["message"] = val_error
        return df, log

    if op_type == "remove_duplicates":
        subset = params.get("subset")
        valid_subset = [c for c in subset if c in df.columns] if (subset and isinstance(subset, list)) else None
        before_cnt = len(df)
        df = df.drop_duplicates(subset=valid_subset)
        dropped = before_cnt - len(df)
        log["message"] = f"Removed {dropped:,} duplicate rows."
        log["rows_affected"] = dropped

    elif op_type == "drop_missing_rows":
        strategy = params.get("strategy", "any")
        thresh = params.get("thresh")
        subset = params.get("columns")
        valid_subset = [c for c in subset if c in df.columns] if subset else None

        before_cnt = len(df)
        if thresh is not None:
            min_non_null = int(thresh) if thresh > 1 else int(thresh * len(df.columns))
            df = df.dropna(thresh=min_non_null, subset=valid_subset)
        else:
            df = df.dropna(how=strategy, subset=valid_subset)
        dropped = before_cnt - len(df)
        log["message"] = f"Dropped {dropped:,} rows containing missing values."
        log["rows_affected"] = dropped

    elif op_type == "drop_columns":
        columns_to_drop = [c for c in params.get("columns", []) if c in df.columns]
        if columns_to_drop:
            df = df.drop(columns=columns_to_drop)
            log["message"] = f"Dropped {len(columns_to_drop)} columns: {', '.join(columns_to_drop)}."
            log["columns_affected"] = columns_to_drop

    elif op_type == "impute_missing":
        col = params.get("column")
        strategy = params.get("strategy", "mean").lower()
        fill_val = params.get("fill_value")

        if col in df.columns:
            missing_count = int(df[col].isna().sum())
            if missing_count > 0:
                if strategy == "mean" and pd.api.types.is_numeric_dtype(df[col]):
                    m = float(df[col].mean())
                    df[col] = df[col].fillna(m)
                    log["message"] = f"Imputed {missing_count:,} missing values in '{col}' with mean ({m:.2f})."
                elif strategy == "median" and pd.api.types.is_numeric_dtype(df[col]):
                    m = float(df[col].median())
                    df[col] = df[col].fillna(m)
                    log["message"] = f"Imputed {missing_count:,} missing values in '{col}' with median ({m:.2f})."
                elif strategy == "mode":
                    mode_val = df[col].mode()
                    if not mode_val.empty:
                        df[col] = df[col].fillna(mode_val[0])
                        log["message"] = f"Imputed {missing_count:,} missing values in '{col}' with mode ('{mode_val[0]}')."
                elif strategy == "constant":
                    if pd.api.types.is_numeric_dtype(df[col]):
                        try:
                            val = float(fill_val)
                        except Exception:
                            val = 0.0
                    else:
                        val = str(fill_val) if fill_val is not None else "Unknown"
                    df[col] = df[col].fillna(val)
                    log["message"] = f"Imputed {missing_count:,} missing values in '{col}' with constant '{val}'."
                elif strategy in ("forward_fill", "ffill"):
                    df[col] = df[col].ffill()
                    log["message"] = f"Forward-filled {missing_count:,} missing values in '{col}'."
                elif strategy in ("backward_fill", "bfill"):
                    df[col] = df[col].bfill()
                    log["message"] = f"Backward-filled {missing_count:,} missing values in '{col}'."
                elif strategy == "unknown_category":
                    df[col] = df[col].fillna("Unknown")
                    log["message"] = f"Imputed {missing_count:,} missing values in '{col}' with category 'Unknown'."
                log["rows_affected"] = missing_count
            else:
                log["message"] = f"Column '{col}' has no missing values."

    elif op_type == "rename_columns":
        mapping = params.get("mapping", {})
        valid_map = {k: v.strip() for k, v in mapping.items() if k in df.columns and v and v.strip()}
        if valid_map:
            df = df.rename(columns=valid_map)
            log["message"] = f"Renamed columns: {', '.join([f'{k} -> {v}' for k, v in valid_map.items()])}."
            log["columns_affected"] = list(valid_map.keys())

    elif op_type == "convert_type":
        col = params.get("column")
        target_type = params.get("target_type")
        if col in df.columns:
            try:
                if target_type == "int":
                    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)
                elif target_type == "float":
                    df[col] = pd.to_numeric(df[col], errors='coerce').astype(float)
                elif target_type == "string":
                    df[col] = df[col].astype(str)
                elif target_type == "datetime":
                    df[col] = pd.to_datetime(df[col], errors='coerce')
                elif target_type == "category":
                    df[col] = df[col].astype('category')
                elif target_type == "boolean":
                    df[col] = df[col].astype(bool)
                log["message"] = f"Converted column '{col}' to {target_type}."
                log["columns_affected"] = [col]
            except Exception as e:
                log["status"] = "error"
                log["message"] = f"Failed to convert '{col}' to {target_type}: {str(e)}"

    elif op_type == "treat_outliers":
        col = params.get("column")
        method = params.get("method", "cap_iqr")
        threshold = float(params.get("threshold", 1.5))

        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            s = df[col].dropna()
            if len(s) > 0:
                if "iqr" in method:
                    q1 = float(s.quantile(0.25))
                    q3 = float(s.quantile(0.75))
                    iqr = q3 - q1
                    lower = q1 - threshold * iqr
                    upper = q3 + threshold * iqr

                    if method == "cap_iqr":
                        capped_count = int(((df[col] < lower) | (df[col] > upper)).sum())
                        df[col] = df[col].clip(lower=lower, upper=upper)
                        log["message"] = f"Winsorized {capped_count:,} outliers in '{col}' to IQR range [{lower:.2f}, {upper:.2f}]."
                        log["rows_affected"] = capped_count
                    elif method == "remove_iqr":
                        before_cnt = len(df)
                        df = df[(df[col] >= lower) & (df[col] <= upper) | df[col].isna()]
                        dropped = before_cnt - len(df)
                        log["message"] = f"Removed {dropped:,} outlier rows outside IQR range [{lower:.2f}, {upper:.2f}]."
                        log["rows_affected"] = dropped
                elif method == "cap_zscore":
                    mean = float(s.mean())
                    std = float(s.std()) if len(s) > 1 else 0.0
                    z_thresh = threshold if threshold > 1.5 else 3.0
                    lower = mean - z_thresh * std
                    upper = mean + z_thresh * std
                    capped_count = int(((df[col] < lower) | (df[col] > upper)).sum())
                    df[col] = df[col].clip(lower=lower, upper=upper)
                    log["message"] = f"Capped {capped_count:,} outliers in '{col}' to Z-score range [{lower:.2f}, {upper:.2f}]."
                    log["rows_affected"] = capped_count

    elif op_type == "recalculate_derived":
        target_col = params.get("target_column")
        sources = params.get("source_columns", [])
        operation = params.get("operation", "sum")
        if target_col and len(sources) == 2:
            s1, s2 = sources[0], sources[1]
            if s1 in df.columns and s2 in df.columns:
                if operation == "sum":
                    df[target_col] = pd.to_numeric(df[s1], errors='coerce').fillna(0) + pd.to_numeric(df[s2], errors='coerce').fillna(0)
                    log["message"] = f"Recalculated derived column '{target_col}' as '{s1}' + '{s2}'."
                    log["columns_affected"] = [target_col]

    return df, log

def run_cleaning_pipeline(
    df: pd.DataFrame,
    operations: List[CleaningOperation],
    dataset_id: str,
    dataset_name: str
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Executes a sequence of cleaning operations and computes before/after metrics.
    """
    initial_rows = len(df)
    initial_cols = len(df.columns)
    initial_missing = int(df.isna().sum().sum())
    initial_dups = int(df.duplicated().sum())

    # Get initial quality score
    init_profile = profile_dataset(df, dataset_id, dataset_name)
    initial_quality = init_profile["quality"]["overall_score"]

    current_df = df.copy()
    applied_logs = []

    for op in operations:
        current_df, log_entry = apply_cleaning_operation(current_df, op)
        applied_logs.append(log_entry)

    final_rows = len(current_df)
    final_cols = len(current_df.columns)
    final_missing = int(current_df.isna().sum().sum())
    final_dups = int(current_df.duplicated().sum())

    # Get final profile
    final_profile = profile_dataset(current_df, dataset_id, dataset_name)
    final_quality = final_profile["quality"]["overall_score"]

    # Check for derived feature recommendations
    derived_recs = detect_derived_columns(current_df)

    diff_summary = {
        "original_row_count": initial_rows,
        "new_row_count": final_rows,
        "original_col_count": initial_cols,
        "new_col_count": final_cols,
        "duplicates_removed": max(0, initial_dups - final_dups),
        "missing_values_before": initial_missing,
        "missing_values_after": final_missing,
        "quality_score_before": initial_quality,
        "quality_score_after": final_quality,
        "applied_operations": applied_logs,
        "derived_recommendations": derived_recs,
        "final_profile": final_profile
    }

    return current_df, diff_summary
