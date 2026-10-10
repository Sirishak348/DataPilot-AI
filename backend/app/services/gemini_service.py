import os
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
import requests

from app.config import settings, get_effective_gemini_key

logger = logging.getLogger("DataPilotAI.Gemini")

SUPPORTED_FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.7-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
]

def get_effective_models() -> List[str]:
    """
    Returns an ordered list of candidate models starting with the configured model.
    """
    configured = (settings.GEMINI_MODEL or os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")).strip()
    models = [configured]
    for m in SUPPORTED_FALLBACK_MODELS:
        if m not in models:
            models.append(m)
    return models

def check_gemini_health() -> Dict[str, Any]:
    """
    Performs a backend health and configuration check for Google Gemini.
    Distinguishes between missing key, invalid key, quota limit, network error, and connected.
    Never exposes the raw API key.
    """
    api_key = get_effective_gemini_key()
    candidate_models = get_effective_models()
    primary_model = candidate_models[0]

    if not api_key:
        return {
            "status": "missing_key",
            "connected": False,
            "model": primary_model,
            "message": "Gemini API key is not configured in backend environment (.env). AI Assistant is running in offline statistical mode."
        }

    # Test connection across candidate models
    last_error_status = "api_error"
    last_error_message = "Unknown error"

    for model_name in candidate_models:
        try:
            probe_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": "Ping"}]}],
                "generationConfig": {"maxOutputTokens": 5}
            }
            resp = requests.post(probe_url, json=payload, timeout=6)
            
            if resp.status_code == 200:
                return {
                    "status": "ready",
                    "connected": True,
                    "model": model_name,
                    "message": f"Successfully connected to Google Gemini ({model_name})."
                }
            elif resp.status_code in (400, 401, 403):
                err_msg = resp.json().get("error", {}).get("message", "Authentication or permission error")
                if "API_KEY_INVALID" in str(err_msg).upper() or "API key not valid" in str(err_msg):
                    return {
                        "status": "invalid_key",
                        "connected": False,
                        "model": model_name,
                        "message": "Configured Gemini API key is invalid or expired. Please check your credentials in backend/.env."
                    }
                last_error_status = "auth_error"
                last_error_message = f"Gemini API authentication failed: {err_msg}"
            elif resp.status_code == 404:
                # Model not found or deprecated; continue loop to try fallback model
                last_error_status = "model_not_found"
                last_error_message = f"Model {model_name} is no longer available."
                continue
            elif resp.status_code == 429:
                last_error_status = "quota_exceeded"
                last_error_message = f"Model {model_name} rate limit or quota exceeded. Trying fallback models..."
                logger.info(f"Model {model_name} returned HTTP 429 (quota exceeded). Checking fallback model...")
                continue
            elif resp.status_code == 503:
                last_error_status = "service_unavailable"
                last_error_message = f"Model {model_name} temporarily busy (HTTP 503)."
                continue
            else:
                last_error_status = "api_error"
                last_error_message = f"Gemini API returned HTTP status {resp.status_code}."
        except requests.exceptions.Timeout:
            last_error_status = "network_timeout"
            last_error_message = "Connection to Google Gemini API timed out. Network latency or firewall restriction."
        except requests.exceptions.RequestException as re:
            last_error_status = "network_error"
            last_error_message = f"Network error reaching Google Gemini API: {str(re)}"
        except Exception as e:
            last_error_status = "error"
            last_error_message = f"Unexpected error checking Gemini service: {str(e)}"

    return {
        "status": last_error_status,
        "connected": False,
        "model": primary_model,
        "message": last_error_message
    }

def format_dataset_context_for_ai(
    dataset_name: str,
    profile_data: Optional[Dict[str, Any]],
    model_runs: Optional[List[Dict[str, Any]]] = None,
    cleaning_stats: Optional[Dict[str, Any]] = None,
    sample_rows: Optional[List[Dict[str, Any]]] = None
) -> str:
    """
    Builds a concise, structured context summary of calculated statistics for the Gemini assistant.
    Never sends full raw dataset rows unnecessarily.
    """
    lines = [f"### DATASET SUMMARY: {dataset_name}"]

    if profile_data:
        lines.append(f"- Dimensions: {profile_data.get('row_count', 0):,} rows, {profile_data.get('column_count', 0)} columns")
        lines.append(f"- Missing Cells: {profile_data.get('missing_cells_count', 0):,} ({profile_data.get('missing_cells_percentage', 0)}%)")
        lines.append(f"- Duplicate Rows: {profile_data.get('duplicate_rows_count', 0):,} ({profile_data.get('duplicate_rows_percentage', 0)}%)")
        
        quality = profile_data.get("quality", {})
        if quality:
            lines.append(f"- Data Quality Score: {quality.get('overall_score', 'N/A')}/100 (Grade: {quality.get('grade', 'N/A')})")
            lines.append(f"  * Completeness: {quality.get('completeness_score', 'N/A')}% | Uniqueness: {quality.get('uniqueness_score', 'N/A')}% | Validity: {quality.get('validity_score', 'N/A')}% | Consistency: {quality.get('consistency_score', 'N/A')}%")
            notes = quality.get("breakdown_notes", [])
            if notes:
                lines.append("  * Quality Notes: " + "; ".join(notes))

        corr = profile_data.get("highly_correlated_pairs", [])
        if corr:
            pairs_str = ", ".join([f"{p['column_1']} & {p['column_2']} (r={p['correlation']})" for p in corr[:6]])
            lines.append(f"- Notable Correlations: {pairs_str}")

        cols = profile_data.get("columns", [])
        if cols:
            lines.append("\n### COLUMNS & ATTRIBUTES:")
            for col in cols[:30]:  # limit to top 30 columns to conserve context
                name = col.get("name")
                itype = col.get("inferred_type")
                null_pct = col.get("missing_percentage", 0)
                null_cnt = col.get("missing_count", 0)
                uniq = col.get("unique_count", 0)
                stats = col.get("stats")
                
                stat_desc = ""
                if stats:
                    stat_desc = f" | mean={stats.get('mean')}, median={stats.get('median')}, min={stats.get('min')}, max={stats.get('max')}, outliers={stats.get('outlier_count')}"
                
                top_c = col.get("top_categories")
                top_desc = ""
                if top_c:
                    top_vals = [f"{c['value']} ({c['percentage']}%)" for c in top_c[:3]]
                    top_desc = f" | top: {', '.join(top_vals)}"

                lines.append(f"- `{name}` ({itype}, {uniq} unique, {null_cnt} ({null_pct}%) null){stat_desc}{top_desc}")

    if sample_rows:
        lines.append("\n### SAMPLE DATA (First 3 Records):")
        for i, row in enumerate(sample_rows[:3], 1):
            lines.append(f"Record {i}: {json.dumps(row, default=str)}")

    if cleaning_stats:
        lines.append("\n### DATA CLEANING ACTIONS APPLIED:")
        applied = cleaning_stats.get("applied_operations", [])
        for op in applied:
            lines.append(f"- {op.get('message', op.get('action'))}")

    if model_runs:
        lines.append("\n### MACHINE LEARNING EXPERIMENTS:")
        for mr in model_runs[-4:]:
            task = mr.get("task_type")
            mname = mr.get("model_name")
            target = mr.get("target_column")
            metrics = mr.get("metrics", {})
            lines.append(f"- Model: {mname} ({task}) | Target: {target}")
            lines.append(f"  Metrics: {json.dumps(metrics)}")

    return "\n".join(lines)

def generate_ai_response(
    user_prompt: str,
    dataset_name: str,
    profile_data: Optional[Dict[str, Any]],
    conversation_history: List[Dict[str, str]],
    model_runs: Optional[List[Dict[str, Any]]] = None,
    cleaning_stats: Optional[Dict[str, Any]] = None,
    sample_rows: Optional[List[Dict[str, Any]]] = None
) -> Tuple[str, bool]:
    """
    Generates an AI response using Google Gemini grounded strictly in dataset context.
    Falls back gracefully to an automated factual summary if the API key is not configured or fails.
    Returns: (response_text, is_gemini_active)
    """
    api_key = get_effective_gemini_key()
    candidate_models = get_effective_models()

    context_str = format_dataset_context_for_ai(
        dataset_name=dataset_name,
        profile_data=profile_data,
        model_runs=model_runs,
        cleaning_stats=cleaning_stats,
        sample_rows=sample_rows
    )

    if not api_key:
        # Statistical Fallback clearly labelled as offline factual analysis
        fallback_msg = (
            f"### DataPilot AI Assistant — Automated Statistical Summary\n\n"
            f"> **Note:** Running in **Offline Statistical Mode** because `GEMINI_API_KEY` is not configured in `backend/.env`.\n"
            f"> To enable generative conversational intelligence, provide your Gemini API key in `backend/.env`.\n\n"
            f"**Dataset Facts for `{dataset_name}`:**\n"
            f"- **Dimensions:** {profile_data.get('row_count', 'N/A') if profile_data else 'N/A':,} rows × {profile_data.get('column_count', 'N/A') if profile_data else 'N/A'} columns\n"
            f"- **Overall Quality Score:** {profile_data.get('quality', {}).get('overall_score', 'N/A') if profile_data else 'N/A'}/100 (Grade: {profile_data.get('quality', {}).get('grade', 'N/A') if profile_data else 'N/A'})\n"
            f"- **Missing Value Density:** {profile_data.get('missing_cells_percentage', '0') if profile_data else '0'}% of total cells\n"
            f"- **Duplicates:** {profile_data.get('duplicate_rows_percentage', '0') if profile_data else '0'}% duplicate rows\n\n"
            f"**Key Recommendations:**\n"
            f"1. **Cleaning:** Address missing data in the Cleaning Studio using type-specific imputation (median for numeric, mode for categorical).\n"
            f"2. **Outliers:** Check skewed distributions in EDA box plots and winsorize if necessary.\n"
            f"3. **Modeling:** Select relevant features in the ML Lab, ensuring target columns are excluded to prevent data leakage."
        )
        return fallback_msg, False

    system_instruction = (
        "You are DataPilot AI, an elite Senior Data Analyst and Machine Learning Consultant.\n"
        "You help users understand their real dataset, assess data quality, evaluate machine learning models, and make data-driven decisions.\n"
        "Strict Grounding Rules:\n"
        "1. Base your answers strictly on the supplied dataset summary context and actual calculated statistics.\n"
        "2. Never hallucinate values or claim to have computed numbers that are not in the context.\n"
        "3. If specific requested information is missing from the context, state that it is not available in the dataset profile.\n"
        "4. Emphasize that correlation does not imply causation.\n"
        "5. Recommend appropriate cleaning steps, feature transformations, or model choices based on the real dataset types.\n"
        "6. Provide structured, concise Markdown with bullet points, bold headers, and code tags where appropriate."
    )

    # First attempt: Try Google Gen AI SDK (google.genai) across candidate models
    for model_name in candidate_models:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)

            # Build multi-turn contents list
            sdk_contents = []
            for msg in conversation_history[-6:]:
                role = "user" if msg.get("role") == "user" else "model"
                text = (msg.get("content") or "").strip()
                if text:
                    sdk_contents.append(types.Content(role=role, parts=[types.Part.from_text(text=text)]))

            current_turn = f"Dataset Context & Profile Summary:\n{context_str}\n\nUser Question:\n{user_prompt}"
            sdk_contents.append(types.Content(role="user", parts=[types.Part.from_text(text=current_turn)]))

            response = client.models.generate_content(
                model=model_name,
                contents=sdk_contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.3
                )
            )
            if response and response.text:
                return response.text, True
        except Exception as sdk_err:
            logger.debug(f"google.genai SDK attempt for model {model_name} encountered: {sdk_err}")
            # Try next model in candidate list (e.g. if 429 quota on primary model)
            continue

    # Second attempt: Direct Google Gen AI REST API (supports multi-turn context and resilient fallback)
    for model_name in candidate_models:
        try:
            rest_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            
            contents = []
            for msg in conversation_history[-6:]:
                role = "user" if msg.get("role") == "user" else "model"
                text = (msg.get("content") or "").strip()
                if text:
                    contents.append({"role": role, "parts": [{"text": text}]})
            
            contents.append({
                "role": "user",
                "parts": [{
                    "text": f"Context:\n{context_str}\n\nUser Question:\n{user_prompt}"
                }]
            })

            payload = {
                "contents": contents,
                "systemInstruction": {
                    "parts": [{"text": system_instruction}]
                },
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 2048
                }
            }

            resp = requests.post(rest_url, json=payload, timeout=20)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    if parts:
                        return parts[0].get("text", ""), True
            elif resp.status_code in (404, 429, 503):
                # Try next candidate model on 404 (not found), 429 (quota), or 503 (busy)
                continue
            else:
                error_detail = resp.json().get("error", {}).get("message", f"HTTP {resp.status_code}")
                logger.warning(f"Gemini REST error ({model_name}): {error_detail}")
        except Exception as e:
            logger.warning(f"Gemini connection error on {model_name}: {e}")

    # Factual Fallback if network or all models fail
    return (
        f"### DataPilot AI Assistant — Automated Statistical Summary\n\n"
        f"> **Notice:** Running in fallback mode because Google Gemini is currently unavailable or quota limits were reached.\n\n"
        f"**Computed Dataset Profile for `{dataset_name}`:**\n"
        f"- **Rows × Columns:** {profile_data.get('row_count', 'N/A') if profile_data else 'N/A':,} × {profile_data.get('column_count', 'N/A') if profile_data else 'N/A'}\n"
        f"- **Quality Score:** {profile_data.get('quality', {}).get('overall_score', 'N/A') if profile_data else 'N/A'}/100\n"
        f"- **Missing Value Density:** {profile_data.get('missing_cells_percentage', '0') if profile_data else '0'}%\n"
        f"- **Duplicates:** {profile_data.get('duplicate_rows_percentage', '0') if profile_data else '0'}%",
        False
    )
