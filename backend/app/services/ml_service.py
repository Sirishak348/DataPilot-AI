import os
import joblib
import uuid
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.decomposition import PCA
from sklearn.base import BaseEstimator, TransformerMixin

# Classification models & baselines
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.dummy import DummyClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_auc_score
)

# Regression models & baselines
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.tree import DecisionTreeRegressor
from sklearn.dummy import DummyRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Clustering
from sklearn.cluster import KMeans, DBSCAN
from sklearn.metrics import silhouette_score, davies_bouldin_score

from app.config import settings
from app.services.profiling_service import infer_column_type

class DateFeatureExtractor(BaseEstimator, TransformerMixin):
    """Decomposes datetime columns into numeric components (year, month, day, dayofweek)."""
    def __init__(self, date_cols: Optional[List[str]] = None):
        self.date_cols = date_cols or []

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        if not isinstance(X, pd.DataFrame):
            X = pd.DataFrame(X)
        X = X.copy()
        for col in self.date_cols:
            if col in X.columns:
                dt_series = pd.to_datetime(X[col], errors='coerce')
                X[f"{col}_year"] = dt_series.dt.year.fillna(2000).astype(int)
                X[f"{col}_month"] = dt_series.dt.month.fillna(1).astype(int)
                X[f"{col}_day"] = dt_series.dt.day.fillna(1).astype(int)
                X[f"{col}_dayofweek"] = dt_series.dt.dayofweek.fillna(0).astype(int)
                X = X.drop(columns=[col])
        return X

def detect_leakage_and_validate_features(
    df: pd.DataFrame,
    target_column: Optional[str],
    feature_columns: List[str]
) -> Tuple[List[str], List[str]]:
    """
    Validates features and checks for potential data leakage or invalid columns.
    Returns: (clean_features, warning_messages)
    """
    clean_features = []
    warnings = []

    for f in feature_columns:
        if f not in df.columns:
            continue
        if target_column and f == target_column:
            warnings.append(f"Target column '{f}' was removed from features to prevent 100% data leakage.")
            continue
        
        # Check if feature has all missing values
        if df[f].isna().all():
            warnings.append(f"Feature '{f}' excluded: column contains 100% missing values.")
            continue

        # Check if feature is a direct duplicate of target
        if target_column and df[f].equals(df[target_column]):
            warnings.append(f"Potential leakage detected: Feature '{f}' is an exact duplicate of the target column.")
            continue

        # Check perfect correlation for numeric target
        if target_column and pd.api.types.is_numeric_dtype(df[f]) and pd.api.types.is_numeric_dtype(df[target_column]):
            sub = df[[f, target_column]].dropna()
            if len(sub) > 5:
                corr = sub[f].corr(sub[target_column])
                if not pd.isna(corr) and abs(corr) >= 0.9999:
                    warnings.append(f"Potential leakage detected: Feature '{f}' has near-perfect correlation (r={corr:.4f}) with target.")

        clean_features.append(f)

    return clean_features, warnings

def preprocess_dataframe_dates(df: pd.DataFrame, feature_columns: List[str]) -> Tuple[pd.DataFrame, List[str]]:
    """
    Extracts date features into numeric components before building the pipeline preprocessor.
    """
    df = df.copy()
    new_features = []
    
    for col in feature_columns:
        if col not in df.columns:
            continue
        col_type = infer_column_type(df[col])
        if col_type == "datetime" or pd.api.types.is_datetime64_any_dtype(df[col]):
            dt_series = pd.to_datetime(df[col], errors='coerce')
            df[f"{col}_year"] = dt_series.dt.year.fillna(2000).astype(int)
            df[f"{col}_month"] = dt_series.dt.month.fillna(1).astype(int)
            df[f"{col}_day"] = dt_series.dt.day.fillna(1).astype(int)
            df[f"{col}_dayofweek"] = dt_series.dt.dayofweek.fillna(0).astype(int)
            new_features.extend([f"{col}_year", f"{col}_month", f"{col}_day", f"{col}_dayofweek"])
        else:
            new_features.append(col)

    return df, new_features

def build_preprocessor(df: pd.DataFrame, feature_columns: List[str]) -> Tuple[ColumnTransformer, List[str], List[str]]:
    """Builds a scikit-learn ColumnTransformer for numeric and categorical features."""
    num_cols = []
    cat_cols = []

    for col in feature_columns:
        if col not in df.columns:
            continue
        if pd.api.types.is_numeric_dtype(df[col]):
            num_cols.append(col)
        else:
            cat_cols.append(col)

    transformers = []
    if num_cols:
        num_pipeline = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler())
        ])
        transformers.append(("num", num_pipeline, num_cols))

    if cat_cols:
        cat_pipeline = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
        ])
        transformers.append(("cat", cat_pipeline, cat_cols))

    preprocessor = ColumnTransformer(transformers=transformers, remainder="drop")
    return preprocessor, num_cols, cat_cols

def train_classification_model(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: List[str],
    model_name: str = "RandomForestClassifier",
    test_size: float = 0.2,
    random_state: int = 42,
    hyperparams: Optional[Dict[str, Any]] = None,
    chronological_split: bool = False
) -> Dict[str, Any]:
    """Trains and evaluates a classification pipeline with baseline comparisons and leakage prevention."""
    clean_features, warnings = detect_leakage_and_validate_features(df, target_column, feature_columns)
    if not clean_features:
        raise ValueError("No valid input feature columns selected for classification training.")

    clean_df = df.dropna(subset=[target_column]).copy()
    if len(clean_df) < 10:
        raise ValueError("Dataset has too few rows for classification training (minimum 10 rows required).")

    y = clean_df[target_column]
    if y.nunique() < 2:
        raise ValueError(f"Target column '{target_column}' has only 1 unique class. Classification requires at least 2 distinct classes.")
    if y.nunique() > 50:
        raise ValueError(f"Target '{target_column}' has {y.nunique()} unique values. Classification is suited for categorical targets (≤ 50 classes). Did you mean Regression?")

    # Date feature handling
    processed_df, transformed_features = preprocess_dataframe_dates(clean_df, clean_features)
    X = processed_df[transformed_features]
    preprocessor, num_cols, cat_cols = build_preprocessor(processed_df, transformed_features)

    # Initialize model
    params = hyperparams or {}
    if model_name == "LogisticRegression":
        clf = LogisticRegression(max_iter=1000, random_state=random_state, C=float(params.get("C", 1.0)))
    elif model_name == "GradientBoostingClassifier":
        clf = GradientBoostingClassifier(
            random_state=random_state,
            n_estimators=int(params.get("n_estimators", 100)),
            learning_rate=float(params.get("learning_rate", 0.1))
        )
    elif model_name == "DecisionTreeClassifier":
        clf = DecisionTreeClassifier(
            random_state=random_state,
            max_depth=int(params.get("max_depth")) if params.get("max_depth") else None
        )
    else:
        model_name = "RandomForestClassifier"
        clf = RandomForestClassifier(
            n_estimators=int(params.get("n_estimators", 100)),
            random_state=random_state,
            max_depth=int(params.get("max_depth")) if params.get("max_depth") else None
        )

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", clf)
    ])

    # Split dataset
    stratify = y if (not chronological_split and y.value_counts().min() >= 2) else None
    shuffle = not chronological_split

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=stratify, shuffle=shuffle
    )

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    # Baseline Dummy Classifier
    dummy = DummyClassifier(strategy="most_frequent")
    dummy.fit(X_train, y_train)
    dummy_pred = dummy.predict(X_test)
    dummy_acc = float(accuracy_score(y_test, dummy_pred))

    # Metrics
    labels = [str(c) for c in sorted(y.unique())]
    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
    rec = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
    f1 = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))
    cm = confusion_matrix(y_test, y_pred, labels=sorted(y.unique())).tolist()

    # ROC AUC if binary or probabilities available
    roc_auc = None
    if hasattr(pipeline, "predict_proba") and len(labels) == 2:
        try:
            proba = pipeline.predict_proba(X_test)[:, 1]
            roc_auc = round(float(roc_auc_score(y_test == sorted(y.unique())[1], proba)), 4)
        except Exception:
            pass

    # Feature importances
    feature_importances = []
    try:
        model_step = pipeline.named_steps["classifier"]
        if hasattr(model_step, "feature_importances_"):
            prep = pipeline.named_steps["preprocessor"]
            feature_names = []
            if num_cols:
                feature_names.extend(num_cols)
            if cat_cols and hasattr(prep.named_transformers_.get("cat", None), "named_steps"):
                cat_encoder = prep.named_transformers_["cat"].named_steps["encoder"]
                cat_names = cat_encoder.get_feature_names_out(cat_cols)
                feature_names.extend(list(cat_names))

            importances = model_step.feature_importances_
            for name, imp in zip(feature_names[:len(importances)], importances):
                feature_importances.append({"feature": str(name), "importance": round(float(imp), 4)})
            feature_importances.sort(key=lambda x: x["importance"], reverse=True)
            feature_importances = feature_importances[:20]
    except Exception:
        pass

    # Save model artifact
    model_run_id = str(uuid.uuid4())
    artifact_path = os.path.join(settings.STORAGE_DIR, "models", f"{model_run_id}.joblib")
    joblib.dump(pipeline, artifact_path)

    # Check if model performs poorly
    if acc <= dummy_acc:
        warnings.append(f"Model accuracy ({acc:.1%}) does not outperform the baseline majority class predictor ({dummy_acc:.1%}). Consider feature engineering or tuning.")

    return {
        "model_run_id": model_run_id,
        "model_name": model_name,
        "task_type": "classification",
        "target_column": target_column,
        "feature_columns": clean_features,
        "metrics": {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "roc_auc": roc_auc,
            "baseline_accuracy": round(dummy_acc, 4),
            "train_samples": len(X_train),
            "test_samples": len(X_test),
            "class_distribution": {str(k): int(v) for k, v in y.value_counts().items()}
        },
        "feature_importance": feature_importances,
        "confusion_matrix": cm,
        "class_labels": labels,
        "warnings": warnings,
        "artifact_path": artifact_path
    }

def train_regression_model(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: List[str],
    model_name: str = "RandomForestRegressor",
    test_size: float = 0.2,
    random_state: int = 42,
    hyperparams: Optional[Dict[str, Any]] = None,
    chronological_split: bool = False
) -> Dict[str, Any]:
    """Trains and evaluates a regression pipeline with baseline comparisons and actual vs predicted points."""
    clean_features, warnings = detect_leakage_and_validate_features(df, target_column, feature_columns)
    if not clean_features:
        raise ValueError("No valid input feature columns selected for regression training.")

    clean_df = df.dropna(subset=[target_column]).copy()
    clean_df[target_column] = pd.to_numeric(clean_df[target_column], errors='coerce')
    clean_df = clean_df.dropna(subset=[target_column])

    if len(clean_df) < 10:
        raise ValueError("Too few valid numeric rows for regression training (minimum 10 required).")

    y = clean_df[target_column]
    processed_df, transformed_features = preprocess_dataframe_dates(clean_df, clean_features)
    X = processed_df[transformed_features]
    preprocessor, num_cols, cat_cols = build_preprocessor(processed_df, transformed_features)

    params = hyperparams or {}
    if model_name == "LinearRegression":
        reg = LinearRegression()
    elif model_name == "Ridge":
        reg = Ridge(alpha=float(params.get("alpha", 1.0)), random_state=random_state)
    elif model_name == "GradientBoostingRegressor":
        reg = GradientBoostingRegressor(
            random_state=random_state,
            n_estimators=int(params.get("n_estimators", 100)),
            learning_rate=float(params.get("learning_rate", 0.1))
        )
    elif model_name == "DecisionTreeRegressor":
        reg = DecisionTreeRegressor(
            random_state=random_state,
            max_depth=int(params.get("max_depth")) if params.get("max_depth") else None
        )
    else:
        model_name = "RandomForestRegressor"
        reg = RandomForestRegressor(
            n_estimators=int(params.get("n_estimators", 100)),
            random_state=random_state,
            max_depth=int(params.get("max_depth")) if params.get("max_depth") else None
        )

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("regressor", reg)
    ])

    shuffle = not chronological_split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, shuffle=shuffle
    )

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    # Baseline Dummy Regressor (predicts mean of y_train)
    dummy = DummyRegressor(strategy="mean")
    dummy.fit(X_train, y_train)
    dummy_pred = dummy.predict(X_test)
    dummy_mae = float(mean_absolute_error(y_test, dummy_pred))
    dummy_rmse = float(np.sqrt(mean_squared_error(y_test, dummy_pred)))

    mae = float(mean_absolute_error(y_test, y_pred))
    mse = float(mean_squared_error(y_test, y_pred))
    rmse = float(np.sqrt(mse))
    r2 = float(r2_score(y_test, y_pred))

    # Feature importances
    feature_importances = []
    try:
        model_step = pipeline.named_steps["regressor"]
        if hasattr(model_step, "feature_importances_"):
            importances = model_step.feature_importances_
            for name, imp in zip(transformed_features[:len(importances)], importances):
                feature_importances.append({"feature": str(name), "importance": round(float(imp), 4)})
            feature_importances.sort(key=lambda x: x["importance"], reverse=True)
            feature_importances = feature_importances[:20]
        elif hasattr(model_step, "coef_"):
            coefs = np.abs(model_step.coef_)
            for name, imp in zip(transformed_features[:len(coefs)], coefs):
                feature_importances.append({"feature": str(name), "importance": round(float(imp), 4)})
            feature_importances.sort(key=lambda x: x["importance"], reverse=True)
    except Exception:
        pass

    # Actual vs Predicted data points for plotting
    residuals_data = []
    for actual, predicted in zip(y_test.iloc[:150], y_pred[:150]):
        residuals_data.append({
            "actual": round(float(actual), 4),
            "predicted": round(float(predicted), 4),
            "residual": round(float(actual - predicted), 4)
        })

    if r2 < 0.0:
        warnings.append(f"Model R² score ({r2:.4f}) is negative. This indicates that the chosen features/model fit worse than a horizontal mean baseline.")

    model_run_id = str(uuid.uuid4())
    artifact_path = os.path.join(settings.STORAGE_DIR, "models", f"{model_run_id}.joblib")
    joblib.dump(pipeline, artifact_path)

    return {
        "model_run_id": model_run_id,
        "model_name": model_name,
        "task_type": "regression",
        "target_column": target_column,
        "feature_columns": clean_features,
        "metrics": {
            "mae": round(mae, 4),
            "mse": round(mse, 4),
            "rmse": round(rmse, 4),
            "r2_score": round(r2, 4),
            "baseline_mae": round(dummy_mae, 4),
            "baseline_rmse": round(dummy_rmse, 4),
            "train_samples": len(X_train),
            "test_samples": len(X_test),
            "target_mean": round(float(y.mean()), 4),
            "target_std": round(float(y.std()), 4) if len(y) > 1 else 0.0,
            "residuals_sample": residuals_data
        },
        "feature_importance": feature_importances,
        "warnings": warnings,
        "artifact_path": artifact_path
    }

def train_clustering_model(
    df: pd.DataFrame,
    feature_columns: List[str],
    model_name: str = "KMeans",
    n_clusters: int = 3,
    eps: float = 0.5,
    min_samples: int = 5,
    random_state: int = 42
) -> Dict[str, Any]:
    """Trains a clustering model (KMeans or DBSCAN) with 2D PCA visual projections."""
    clean_df = df[feature_columns].dropna().copy()
    if len(clean_df) < 5:
        raise ValueError("Too few valid samples for clustering (minimum 5 required).")

    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(clean_df.select_dtypes(include=[np.number]))
    if scaled_data.shape[1] == 0:
        raise ValueError("Clustering requires at least one numeric feature column.")

    if model_name == "DBSCAN":
        clusterer = DBSCAN(eps=eps, min_samples=min_samples)
        labels = clusterer.fit_predict(scaled_data)
        inertia = None
        unique_labels = set(labels) - {-1}
        sil_score = float(silhouette_score(scaled_data, labels)) if len(unique_labels) > 1 else 0.0
        db_score = float(davies_bouldin_score(scaled_data, labels)) if len(unique_labels) > 1 else 0.0
        effective_clusters = len(unique_labels)
    else:
        model_name = "KMeans"
        clusterer = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=10)
        labels = clusterer.fit_predict(scaled_data)
        inertia = float(clusterer.inertia_)
        sil_score = float(silhouette_score(scaled_data, labels)) if len(clean_df) > n_clusters else 0.0
        db_score = float(davies_bouldin_score(scaled_data, labels)) if len(clean_df) > n_clusters else 0.0
        effective_clusters = n_clusters

    counts = pd.Series(labels).value_counts().to_dict()
    cluster_counts = {("Noise" if k == -1 else f"Cluster {k}"): int(v) for k, v in counts.items()}

    # 2D PCA for visual mapping
    pca = PCA(n_components=min(2, scaled_data.shape[1]))
    pca_coords = pca.fit_transform(scaled_data)

    visual_data = []
    for i in range(min(500, len(clean_df))):
        lbl = "Noise" if labels[i] == -1 else f"Cluster {labels[i]}"
        visual_data.append({
            "pca_x": round(float(pca_coords[i, 0]), 4),
            "pca_y": round(float(pca_coords[i, 1]), 4) if pca_coords.shape[1] > 1 else 0.0,
            "cluster": lbl
        })

    clean_df["cluster"] = [("Noise" if l == -1 else f"Cluster {l}") for l in labels]
    cluster_centers = []
    numeric_cols = clean_df.select_dtypes(include=[np.number]).columns.tolist()
    for cluster_name, grp in clean_df.groupby("cluster"):
        center_dict = {"cluster": str(cluster_name), "size": len(grp)}
        for c in numeric_cols:
            center_dict[c] = round(float(grp[c].mean()), 2)
        cluster_centers.append(center_dict)

    pipeline = Pipeline([
        ("scaler", scaler),
        ("clusterer", clusterer)
    ])

    model_run_id = str(uuid.uuid4())
    artifact_path = os.path.join(settings.STORAGE_DIR, "models", f"{model_run_id}.joblib")
    joblib.dump(pipeline, artifact_path)

    return {
        "model_run_id": model_run_id,
        "model_name": model_name,
        "task_type": "clustering",
        "target_column": None,
        "feature_columns": feature_columns,
        "metrics": {
            "n_clusters": effective_clusters,
            "inertia": round(inertia, 4) if inertia is not None else None,
            "silhouette_score": round(sil_score, 4),
            "davies_bouldin_score": round(db_score, 4),
            "total_samples": len(clean_df)
        },
        "cluster_counts": cluster_counts,
        "cluster_centers": cluster_centers,
        "cluster_visual_data": visual_data,
        "artifact_path": artifact_path
    }

def run_predictions(
    artifact_path: str,
    input_df: pd.DataFrame
) -> Tuple[List[Any], Optional[List[Dict[str, float]]]]:
    """Loads a trained model pipeline and computes predictions for input data."""
    if not os.path.exists(artifact_path):
        raise FileNotFoundError("Trained model artifact not found.")

    pipeline = joblib.load(artifact_path)
    
    # Check if preprocessor contains date components
    predictions = pipeline.predict(input_df)

    probs = None
    if hasattr(pipeline, "predict_proba"):
        try:
            proba = pipeline.predict_proba(input_df)
            classes = [str(c) for c in pipeline.classes_]
            probs = [
                {classes[i]: round(float(p), 4) for i, p in enumerate(row)}
                for row in proba
            ]
        except Exception:
            pass

    return predictions.tolist(), probs
