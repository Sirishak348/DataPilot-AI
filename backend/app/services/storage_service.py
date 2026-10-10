import os
import uuid
import pandas as pd
from typing import Tuple, Optional
from fastapi import UploadFile, HTTPException
from app.config import settings

ALLOWED_EXTENSIONS = {".csv"}
MAX_FILE_SIZE_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

def sanitize_filename(filename: str) -> str:
    """Strip dangerous characters and keep base name."""
    clean = os.path.basename(filename)
    clean = "".join(c for c in clean if c.isalnum() or c in (".", "-", "_", " ")).strip()
    return clean if clean else "dataset.csv"

def save_uploaded_file(upload_file: UploadFile) -> Tuple[str, str, int]:
    """
    Validates and saves uploaded CSV file securely to the storage directory.
    Returns: (sanitized_original_filename, stored_relative_or_abs_path, file_size_bytes)
    """
    original_name = sanitize_filename(upload_file.filename or "upload.csv")
    ext = os.path.splitext(original_name)[1].lower()
    
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file format '{ext}'. Only CSV files are allowed.")
    
    unique_id = str(uuid.uuid4())
    stored_filename = f"{unique_id}_{original_name}"
    target_path = os.path.join(settings.STORAGE_DIR, "datasets", stored_filename)

    # Read and write in chunks, validating file size
    size_accumulated = 0
    try:
        with open(target_path, "wb") as f:
            while True:
                chunk = upload_file.file.read(1024 * 1024) # 1MB chunks
                if not chunk:
                    break
                size_accumulated += len(chunk)
                if size_accumulated > MAX_FILE_SIZE_BYTES:
                    f.close()
                    if os.path.exists(target_path):
                        os.remove(target_path)
                    raise HTTPException(status_code=413, detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB.")
                f.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(target_path):
            os.remove(target_path)
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    if size_accumulated == 0:
        if os.path.exists(target_path):
            os.remove(target_path)
        raise HTTPException(status_code=400, detail="The uploaded CSV file is empty.")

    return original_name, target_path, size_accumulated

def load_csv_dataframe(file_path: str) -> pd.DataFrame:
    """
    Loads a CSV file into a pandas DataFrame with automatic fallback for multiple encodings.
    """
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset file not found in storage.")

    encodings = ["utf-8", "utf-8-sig", "latin1", "iso-8859-1", "cp1252"]
    df = None
    last_err = None

    for enc in encodings:
        try:
            df = pd.read_csv(file_path, encoding=enc, on_bad_lines="skip")
            break
        except UnicodeDecodeError as err:
            last_err = err
            continue
        except Exception as err:
            last_err = err
            break

    if df is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to parse CSV file with standard encodings: {str(last_err)}"
        )

    if df.empty:
        raise HTTPException(status_code=400, detail="The CSV file contains no data rows.")

    # Clean column names (strip whitespace)
    df.columns = [str(c).strip() for c in df.columns]
    
    # Handle duplicate column names
    seen = {}
    new_cols = []
    for col in df.columns:
        if col in seen:
            seen[col] += 1
            new_cols.append(f"{col}_{seen[col]}")
        else:
            seen[col] = 0
            new_cols.append(col)
    df.columns = new_cols

    return df

def save_dataframe_to_csv(df: pd.DataFrame, subfolder: str, prefix: str = "cleaned_") -> str:
    """Saves DataFrame as CSV in storage subfolder and returns the path."""
    unique_id = str(uuid.uuid4())
    filename = f"{prefix}{unique_id}.csv"
    folder_path = os.path.join(settings.STORAGE_DIR, subfolder)
    os.makedirs(folder_path, exist_ok=True)
    target_path = os.path.join(folder_path, filename)
    df.to_csv(target_path, index=False)
    return target_path
