import numpy as np
import pandas as pd
from typing import Dict, Any, List, Tuple

def infer_column_type(series: pd.Series) -> str:
    """
    Infers the high-level semantic type of a pandas Series.
    Returns: 'numeric', 'categorical', 'datetime', 'boolean', 'constant', 'text'
    """
    non_null = series.dropna()
    if len(non_null) == 0:
        return "empty"
    
    # Check if constant
    if non_null.nunique() == 1:
        return "constant"

    # Check boolean
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if non_null.nunique() == 2 and set(non_null.astype(str).str.lower()).issubset({"true", "false", "0", "1", "yes", "no"}):
        return "boolean"

    # Check numeric
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"

    # Try datetime parse if object or string
    if pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series):
        # Sample first 50 values to test datetime quickly
        sample = non_null.head(50)
        try:
            pd.to_datetime(sample, format='mixed', errors='raise')
            # If successful on sample, test the rest without raising
            converted = pd.to_datetime(series, format='mixed', errors='coerce')
            if converted.notna().sum() / len(non_null) > 0.85:
                return "datetime"
        except Exception:
            pass

    # Categorical vs Text based on cardinality
    unique_count = non_null.nunique()
    if unique_count <= 50 or (unique_count / len(non_null) < 0.2):
        return "categorical"

    return "text"

def calculate_numeric_stats(series: pd.Series) -> Dict[str, Any]:
    """Calculates comprehensive descriptive statistics for numeric column including IQR outliers."""
    s = pd.to_numeric(series.dropna(), errors='coerce').dropna()
    if len(s) == 0:
        return {}

    q1 = float(s.quantile(0.25))
    q2 = float(s.median())
    q3 = float(s.quantile(0.75))
    iqr = q3 - q1
    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr

    outliers = s[(s < lower_bound) | (s > upper_bound)]
    outlier_count = int(len(outliers))
    outlier_percentage = round((outlier_count / len(s)) * 100, 2) if len(s) > 0 else 0.0

    # Calculate skewness if enough samples
    skewness = float(s.skew()) if len(s) > 2 and not pd.isna(s.skew()) else 0.0

    return {
        "count": int(len(s)),
        "mean": round(float(s.mean()), 4),
        "std": round(float(s.std()), 4) if len(s) > 1 and not pd.isna(s.std()) else 0.0,
        "min": round(float(s.min()), 4),
        "q25": round(q1, 4),
        "median": round(q2, 4),
        "q75": round(q3, 4),
        "max": round(float(s.max()), 4),
        "skewness": round(skewness, 4),
        "iqr": round(iqr, 4),
        "lower_bound": round(lower_bound, 4),
        "upper_bound": round(upper_bound, 4),
        "outlier_count": outlier_count,
        "outlier_percentage": outlier_percentage
    }

def calculate_categorical_stats(series: pd.Series, top_n: int = 10) -> List[Dict[str, Any]]:
    """Calculates top value counts and percentages for categorical column."""
    s = series.dropna().astype(str)
    if len(s) == 0:
        return []
    
    total = len(s)
    counts = s.value_counts().head(top_n)
    result = []
    for val, count in counts.items():
        result.append({
            "value": str(val),
            "count": int(count),
            "percentage": round((count / total) * 100, 2)
        })
    return result

def calculate_quality_score(
    df: pd.DataFrame,
    missing_cells_pct: float,
    duplicate_rows_pct: float,
    constant_cols_count: int,
    total_outliers_pct: float
) -> Dict[str, Any]:
    """
    Computes a composite data quality score (0 - 100) and breakdown notes.
    Formulas:
    - Completeness (weight 35%): 100 - missing_cells_pct
    - Uniqueness (weight 25%): 100 - duplicate_rows_pct
    - Validity / Outlier Health (weight 20%): max(0, 100 - (total_outliers_pct * 1.5))
    - Schema Integrity (weight 20%): max(0, 100 - (constant_cols_count / max(1, len(df.columns)) * 100))
    """
    completeness = max(0.0, min(100.0, 100.0 - missing_cells_pct))
    uniqueness = max(0.0, min(100.0, 100.0 - duplicate_rows_pct))
    validity = max(0.0, min(100.0, 100.0 - (total_outliers_pct * 1.2)))
    constant_penalty = (constant_cols_count / max(1, len(df.columns))) * 100
    integrity = max(0.0, min(100.0, 100.0 - constant_penalty))

    overall = round((completeness * 0.35) + (uniqueness * 0.25) + (validity * 0.20) + (integrity * 0.20), 1)

    if overall >= 90:
        grade = "A"
    elif overall >= 80:
        grade = "B"
    elif overall >= 70:
        grade = "C"
    elif overall >= 60:
        grade = "D"
    else:
        grade = "F"

    notes = []
    if missing_cells_pct > 5.0:
        notes.append(f"Missing values detected across {missing_cells_pct:.1f}% of total cells. Consider imputation or dropping high-null features.")
    else:
        notes.append("High completeness: minimal or no missing values.")

    if duplicate_rows_pct > 0.0:
        notes.append(f"{duplicate_rows_pct:.1f}% duplicate rows present. Deduplication recommended.")
    else:
        notes.append("Zero duplicate rows detected.")

    if total_outliers_pct > 3.0:
        notes.append(f"Statistically significant outliers detected in numeric distributions (~{total_outliers_pct:.1f}% of values).")
    
    if constant_cols_count > 0:
        notes.append(f"{constant_cols_count} constant column(s) with zero variance detected.")

    return {
        "overall_score": overall,
        "completeness_score": round(completeness, 1),
        "uniqueness_score": round(uniqueness, 1),
        "validity_score": round(validity, 1),
        "consistency_score": round(integrity, 1),
        "grade": grade,
        "breakdown_notes": notes
    }

def profile_dataset(df: pd.DataFrame, dataset_id: str, dataset_name: str) -> Dict[str, Any]:
    """
    Performs full automated profiling of the DataFrame.
    """
    total_rows = int(len(df))
    total_cols = int(len(df.columns))
    total_cells = total_rows * total_cols if total_rows > 0 and total_cols > 0 else 1

    # Missing & Duplicate calculations
    missing_cells = int(df.isna().sum().sum())
    missing_cells_pct = round((missing_cells / total_cells) * 100, 2)
    duplicate_rows = int(df.duplicated().sum())
    duplicate_rows_pct = round((duplicate_rows / max(1, total_rows)) * 100, 2)

    memory_mb = round(df.memory_usage(deep=True).sum() / (1024 * 1024), 2)

    columns_summary = []
    constant_cols = []
    numeric_cols = []
    categorical_cols = []
    datetime_cols = []
    total_outlier_count = 0
    total_numeric_values_count = 0

    for col in df.columns:
        series = df[col]
        inferred = infer_column_type(series)
        dtype_str = str(series.dtype)
        col_missing = int(series.isna().sum())
        col_missing_pct = round((col_missing / max(1, total_rows)) * 100, 2)
        unique_cnt = int(series.nunique())
        unique_pct = round((unique_cnt / max(1, total_rows)) * 100, 2)
        is_const = (unique_cnt <= 1 and col_missing < total_rows) or inferred == "constant"
        is_high_card = (unique_cnt > 50 and inferred == "categorical")

        stats_data = None
        top_cats = None

        if is_const:
            constant_cols.append(col)

        if inferred == "numeric":
            numeric_cols.append(col)
            stats_data = calculate_numeric_stats(series)
            if stats_data:
                total_outlier_count += stats_data.get("outlier_count", 0)
                total_numeric_values_count += stats_data.get("count", 0)
        elif inferred in ("categorical", "boolean", "text"):
            categorical_cols.append(col)
            top_cats = calculate_categorical_stats(series)
        elif inferred == "datetime":
            datetime_cols.append(col)

        columns_summary.append({
            "name": col,
            "inferred_type": inferred,
            "dtype": dtype_str,
            "total_count": total_rows,
            "missing_count": col_missing,
            "missing_percentage": col_missing_pct,
            "unique_count": unique_cnt,
            "unique_percentage": unique_pct,
            "is_constant": is_const,
            "is_high_cardinality": is_high_card,
            "stats": stats_data,
            "top_categories": top_cats
        })

    # Total outlier percentage across numeric columns
    total_outliers_pct = round((total_outlier_count / max(1, total_numeric_values_count)) * 100, 2) if total_numeric_values_count > 0 else 0.0

    # High correlation pairs (> 0.85)
    high_corr_pairs = []
    if len(numeric_cols) >= 2:
        try:
            corr_df = df[numeric_cols].corr()
            cols_list = corr_df.columns.tolist()
            for i in range(len(cols_list)):
                for j in range(i + 1, len(cols_list)):
                    val = corr_df.iloc[i, j]
                    if not pd.isna(val) and abs(val) >= 0.80:
                        high_corr_pairs.append({
                            "column_1": cols_list[i],
                            "column_2": cols_list[j],
                            "correlation": round(float(val), 4)
                        })
        except Exception:
            pass

    quality = calculate_quality_score(
        df=df,
        missing_cells_pct=missing_cells_pct,
        duplicate_rows_pct=duplicate_rows_pct,
        constant_cols_count=len(constant_cols),
        total_outliers_pct=total_outliers_pct
    )

    return {
        "dataset_id": dataset_id,
        "dataset_name": dataset_name,
        "row_count": total_rows,
        "column_count": total_cols,
        "memory_usage_mb": memory_mb,
        "duplicate_rows_count": duplicate_rows,
        "duplicate_rows_percentage": duplicate_rows_pct,
        "missing_cells_count": missing_cells,
        "missing_cells_percentage": missing_cells_pct,
        "numeric_columns_count": len(numeric_cols),
        "categorical_columns_count": len(categorical_cols),
        "datetime_columns_count": len(datetime_cols),
        "constant_columns": constant_cols,
        "highly_correlated_pairs": high_corr_pairs,
        "columns": columns_summary,
        "quality": quality
    }
