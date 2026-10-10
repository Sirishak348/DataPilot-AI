import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional

def get_histogram_data(df: pd.DataFrame, column: str, bins: int = 20) -> Dict[str, Any]:
    """Generates bin edges and frequency counts for a numeric column."""
    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}

    s = pd.to_numeric(df[column].dropna(), errors='coerce').dropna()
    if len(s) == 0:
        return {"error": f"Column '{column}' contains no valid numeric data"}

    counts, bin_edges = np.histogram(s, bins=max(5, min(100, bins)))
    bin_labels = [f"{bin_edges[i]:.2f} - {bin_edges[i+1]:.2f}" for i in range(len(counts))]
    bin_centers = [(bin_edges[i] + bin_edges[i+1]) / 2 for i in range(len(counts))]

    return {
        "column": column,
        "counts": counts.tolist(),
        "bin_edges": [float(x) for x in bin_edges],
        "bin_centers": [float(x) for x in bin_centers],
        "bin_labels": bin_labels,
        "mean": round(float(s.mean()), 4),
        "median": round(float(s.median()), 4),
        "std": round(float(s.std()), 4) if len(s) > 1 else 0.0,
        "min": round(float(s.min()), 4),
        "max": round(float(s.max()), 4),
        "total_count": len(s)
    }

def get_boxplot_data(df: pd.DataFrame, numeric_col: str, group_by_col: Optional[str] = None) -> Dict[str, Any]:
    """Generates boxplot summary (five-number summary + outliers) for numeric column, optionally grouped."""
    if numeric_col not in df.columns:
        return {"error": f"Column '{numeric_col}' not found"}

    if not group_by_col or group_by_col not in df.columns or group_by_col == numeric_col:
        s = pd.to_numeric(df[numeric_col].dropna(), errors='coerce').dropna()
        if len(s) == 0:
            return {"error": "No valid numeric data"}

        q1 = float(s.quantile(0.25))
        median = float(s.median())
        q3 = float(s.quantile(0.75))
        iqr = q3 - q1
        lower_whisker = float(max(s.min(), q1 - 1.5 * iqr))
        upper_whisker = float(min(s.max(), q3 + 1.5 * iqr))
        outliers = s[(s < lower_whisker) | (s > upper_whisker)].tolist()

        return {
            "numeric_column": numeric_col,
            "groups": [{
                "group_name": "Overall",
                "min": round(float(s.min()), 4),
                "q1": round(q1, 4),
                "median": round(median, 4),
                "q3": round(q3, 4),
                "max": round(float(s.max()), 4),
                "lower_whisker": round(lower_whisker, 4),
                "upper_whisker": round(upper_whisker, 4),
                "outliers": [round(float(x), 4) for x in outliers[:100]],
                "count": len(s)
            }]
        }

    # Grouped boxplots (limit to top 8 categories)
    top_categories = df[group_by_col].dropna().astype(str).value_counts().head(8).index.tolist()
    groups_data = []

    for cat in top_categories:
        sub_s = pd.to_numeric(df[df[group_by_col].astype(str) == cat][numeric_col].dropna(), errors='coerce').dropna()
        if len(sub_s) > 0:
            q1 = float(sub_s.quantile(0.25))
            median = float(sub_s.median())
            q3 = float(sub_s.quantile(0.75))
            iqr = q3 - q1
            lower_whisker = float(max(sub_s.min(), q1 - 1.5 * iqr))
            upper_whisker = float(min(sub_s.max(), q3 + 1.5 * iqr))
            outliers = sub_s[(sub_s < lower_whisker) | (sub_s > upper_whisker)].tolist()

            groups_data.append({
                "group_name": str(cat),
                "min": round(float(sub_s.min()), 4),
                "q1": round(q1, 4),
                "median": round(median, 4),
                "q3": round(q3, 4),
                "max": round(float(sub_s.max()), 4),
                "lower_whisker": round(lower_whisker, 4),
                "upper_whisker": round(upper_whisker, 4),
                "outliers": [round(float(x), 4) for x in outliers[:50]],
                "count": len(sub_s)
            })

    return {
        "numeric_column": numeric_col,
        "group_by_column": group_by_col,
        "groups": groups_data
    }

def get_violin_data(df: pd.DataFrame, numeric_col: str, group_by_col: Optional[str] = None) -> Dict[str, Any]:
    """Generates distribution samples for violin plot rendering."""
    if numeric_col not in df.columns:
        return {"error": f"Column '{numeric_col}' not found"}

    if not group_by_col or group_by_col not in df.columns or group_by_col == numeric_col:
        s = pd.to_numeric(df[numeric_col].dropna(), errors='coerce').dropna()
        if len(s) == 0:
            return {"error": "No valid numeric data"}
        sample = s.sample(min(500, len(s)), random_state=42).tolist() if len(s) > 500 else s.tolist()
        return {
            "numeric_column": numeric_col,
            "groups": [{
                "group_name": "Overall",
                "values": [round(float(x), 4) for x in sample],
                "median": round(float(s.median()), 4),
                "mean": round(float(s.mean()), 4),
                "q1": round(float(s.quantile(0.25)), 4),
                "q3": round(float(s.quantile(0.75)), 4)
            }]
        }

    top_categories = df[group_by_col].dropna().astype(str).value_counts().head(6).index.tolist()
    groups_data = []

    for cat in top_categories:
        sub_s = pd.to_numeric(df[df[group_by_col].astype(str) == cat][numeric_col].dropna(), errors='coerce').dropna()
        if len(sub_s) > 0:
            sample = sub_s.sample(min(300, len(sub_s)), random_state=42).tolist() if len(sub_s) > 300 else sub_s.tolist()
            groups_data.append({
                "group_name": str(cat),
                "values": [round(float(x), 4) for x in sample],
                "median": round(float(sub_s.median()), 4),
                "mean": round(float(sub_s.mean()), 4),
                "q1": round(float(sub_s.quantile(0.25)), 4),
                "q3": round(float(sub_s.quantile(0.75)), 4)
            })

    return {
        "numeric_column": numeric_col,
        "group_by_column": group_by_col,
        "groups": groups_data
    }

def get_correlation_matrix(df: pd.DataFrame) -> Dict[str, Any]:
    """Computes Pearson correlation matrix for all numeric columns."""
    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.empty or len(numeric_df.columns) < 2:
        return {"columns": [], "matrix": []}

    corr = numeric_df.corr().round(4).fillna(0)
    cols = corr.columns.tolist()
    matrix = corr.values.tolist()

    return {
        "columns": cols,
        "matrix": matrix
    }

def get_scatter_data(
    df: pd.DataFrame,
    x_col: str,
    y_col: str,
    color_col: Optional[str] = None,
    sample_size: int = 1000
) -> Dict[str, Any]:
    """Prepares sampled 2D scatter data with linear regression trendline."""
    if x_col not in df.columns or y_col not in df.columns:
        return {"error": "Specified columns not found in dataset"}

    cols = [x_col, y_col]
    if color_col and color_col in df.columns:
        cols.append(color_col)

    clean_subset = df[cols].dropna()
    clean_subset[x_col] = pd.to_numeric(clean_subset[x_col], errors='coerce')
    clean_subset[y_col] = pd.to_numeric(clean_subset[y_col], errors='coerce')
    clean_subset = clean_subset.dropna()

    if len(clean_subset) == 0:
        return {"error": "No valid numeric pairs for scatter plot"}

    # Calculate trendline
    slope = 0.0
    intercept = 0.0
    r_val = 0.0
    if len(clean_subset) > 2:
        try:
            x_arr = clean_subset[x_col].values
            y_arr = clean_subset[y_col].values
            poly = np.polyfit(x_arr, y_arr, 1)
            slope = float(poly[0])
            intercept = float(poly[1])
            r_val = float(np.corrcoef(x_arr, y_arr)[0, 1])
        except Exception:
            pass

    if len(clean_subset) > sample_size:
        sampled_df = clean_subset.sample(n=sample_size, random_state=42)
    else:
        sampled_df = clean_subset

    data_points = []
    for _, row in sampled_df.iterrows():
        pt = {
            "x": round(float(row[x_col]), 4),
            "y": round(float(row[y_col]), 4),
            "group": str(row[color_col]) if color_col and color_col in row else "All"
        }
        data_points.append(pt)

    return {
        "x_column": x_col,
        "y_column": y_col,
        "color_column": color_col,
        "points": data_points,
        "total_points": len(data_points),
        "trendline": {
            "slope": round(slope, 4),
            "intercept": round(intercept, 4),
            "r_correlation": round(r_val, 4)
        }
    }

def get_bubble_chart_data(
    df: pd.DataFrame,
    x_col: str,
    y_col: str,
    size_col: str,
    color_col: Optional[str] = None,
    sample_size: int = 500
) -> Dict[str, Any]:
    """Generates bubble chart dataset with x, y, and bubble radius."""
    for c in [x_col, y_col, size_col]:
        if c not in df.columns:
            return {"error": f"Column '{c}' not found"}

    cols = [x_col, y_col, size_col]
    if color_col and color_col in df.columns:
        cols.append(color_col)

    clean_df = df[cols].dropna()
    clean_df[x_col] = pd.to_numeric(clean_df[x_col], errors='coerce')
    clean_df[y_col] = pd.to_numeric(clean_df[y_col], errors='coerce')
    clean_df[size_col] = pd.to_numeric(clean_df[size_col], errors='coerce')
    clean_df = clean_df.dropna()

    if len(clean_df) > sample_size:
        clean_df = clean_df.sample(n=sample_size, random_state=42)

    bubbles = []
    for _, row in clean_df.iterrows():
        bubbles.append({
            "x": round(float(row[x_col]), 4),
            "y": round(float(row[y_col]), 4),
            "size": max(2.0, round(float(row[size_col]), 2)),
            "group": str(row[color_col]) if color_col and color_col in row else "All"
        })

    return {
        "x_column": x_col,
        "y_column": y_col,
        "size_column": size_col,
        "color_column": color_col,
        "bubbles": bubbles
    }

def get_scatter_matrix_data(df: pd.DataFrame, columns: List[str], sample_size: int = 300) -> Dict[str, Any]:
    """Generates pair-wise data matrix for multi-numeric column matrix exploration."""
    valid_cols = [c for c in columns if c in df.columns and pd.api.types.is_numeric_dtype(df[c])][:5]
    if len(valid_cols) < 2:
        return {"error": "Pair plot requires at least 2 valid numeric columns."}

    clean_df = df[valid_cols].dropna()
    if len(clean_df) > sample_size:
        clean_df = clean_df.sample(n=sample_size, random_state=42)

    records = clean_df.to_dict(orient="records")
    return {
        "columns": valid_cols,
        "records": records,
        "total_records": len(records)
    }

def get_categorical_bar_data(df: pd.DataFrame, column: str, top_n: int = 15) -> Dict[str, Any]:
    """Prepares bar chart frequencies for categorical variable."""
    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}

    s = df[column].dropna().astype(str)
    counts = s.value_counts().head(top_n)
    total = len(s)

    labels = [str(k) for k in counts.index]
    values = [int(v) for v in counts.values]
    percentages = [round((v / max(1, total)) * 100, 2) for v in values]

    return {
        "column": column,
        "labels": labels,
        "values": values,
        "percentages": percentages,
        "total_unique": int(s.nunique())
    }

def get_stacked_bar_data(df: pd.DataFrame, primary_col: str, secondary_col: str) -> Dict[str, Any]:
    """Computes cross-tabulation for stacked categorical comparison."""
    if primary_col not in df.columns or secondary_col not in df.columns:
        return {"error": "Specified categorical columns not found"}

    top_primary = df[primary_col].dropna().astype(str).value_counts().head(8).index.tolist()
    top_secondary = df[secondary_col].dropna().astype(str).value_counts().head(6).index.tolist()

    sub = df[df[primary_col].astype(str).isin(top_primary) & df[secondary_col].astype(str).isin(top_secondary)]
    ct = pd.crosstab(sub[primary_col].astype(str), sub[secondary_col].astype(str))

    categories = ct.index.tolist()
    sub_categories = ct.columns.tolist()
    series_data = []

    for sub_cat in sub_categories:
        series_data.append({
            "name": str(sub_cat),
            "values": ct[sub_cat].tolist()
        })

    return {
        "primary_column": primary_col,
        "secondary_column": secondary_col,
        "categories": categories,
        "series": series_data
    }

def get_timeseries_data(
    df: pd.DataFrame,
    date_col: str,
    value_col: str,
    agg_func: str = "mean"
) -> Dict[str, Any]:
    """Aggregates time-series data for line/area chart rendering."""
    if date_col not in df.columns or value_col not in df.columns:
        return {"error": "Date or Value column not found"}

    sub = df[[date_col, value_col]].dropna().copy()
    sub["datetime_parsed"] = pd.to_datetime(sub[date_col], errors='coerce')
    sub[value_col] = pd.to_numeric(sub[value_col], errors='coerce')
    sub = sub.dropna().sort_values("datetime_parsed")

    if len(sub) == 0:
        return {"error": "No valid datetime and numeric values"}

    # Resample or limit to 500 data points
    if len(sub) > 500:
        step = len(sub) // 500
        sub = sub.iloc[::step]

    dates = sub["datetime_parsed"].dt.strftime("%Y-%m-%d").tolist()
    values = [round(float(v), 4) for v in sub[value_col].tolist()]

    # Compute cumulative values for area chart option
    cum_values = np.cumsum(values).round(4).tolist()

    return {
        "date_column": date_col,
        "value_column": value_col,
        "dates": dates,
        "values": values,
        "cumulative_values": cum_values
    }

def get_missing_values_chart_data(df: pd.DataFrame) -> Dict[str, Any]:
    """Prepares missing value counts and percentages across all columns."""
    missing = df.isna().sum()
    total_rows = len(df)
    missing_sorted = missing[missing > 0].sort_values(ascending=False)
    
    columns = [str(k) for k in missing_sorted.index]
    counts = [int(v) for v in missing_sorted.values]
    percentages = [round((v / max(1, total_rows)) * 100, 2) for v in counts]

    return {
        "columns": columns,
        "counts": counts,
        "percentages": percentages,
        "total_missing_columns": len(columns),
        "total_columns": len(df.columns)
    }

def get_missing_matrix_data(df: pd.DataFrame, max_rows: int = 100) -> Dict[str, Any]:
    """Generates a binary missingness matrix for heatmap visualization."""
    sub = df.head(max_rows)
    cols = df.columns.tolist()
    matrix = sub.isna().astype(int).values.tolist()
    return {
        "columns": cols,
        "rows_count": len(sub),
        "matrix": matrix
    }

def get_distribution_comparison_data(df: pd.DataFrame, columns: List[str]) -> Dict[str, Any]:
    """Prepares density and histogram distributions across multiple numeric columns."""
    valid_cols = [c for c in columns if c in df.columns and pd.api.types.is_numeric_dtype(df[c])][:4]
    if not valid_cols:
        return {"error": "No valid numeric columns selected"}

    distributions = []
    for col in valid_cols:
        s = pd.to_numeric(df[col].dropna(), errors='coerce').dropna()
        if len(s) > 0:
            counts, edges = np.histogram(s, bins=25, density=True)
            centers = [(edges[i] + edges[i+1]) / 2 for i in range(len(counts))]
            distributions.append({
                "column": col,
                "centers": [round(float(c), 4) for c in centers],
                "densities": [round(float(d), 6) for d in counts],
                "mean": round(float(s.mean()), 4),
                "std": round(float(s.std()), 4) if len(s) > 1 else 0.0
            })

    return {
        "distributions": distributions
    }
