from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from app.database import get_db
from app.models.models import Dataset, User, ChatMessage, ModelRun
from app.schemas.schemas import ChatMessageRequest, ChatMessageResponse
from app.services.auth_service import get_current_user
from app.services.gemini_service import generate_ai_response, check_gemini_health
from app.services.storage_service import load_csv_dataframe

router = APIRouter(tags=["Gemini AI Assistant"])

@router.get("/api/ai/health")
def get_ai_service_health():
    """
    Returns the backend Google Gemini configuration and connectivity status.
    Distinguishes between missing key, invalid key, rate limits, network errors, and ready state.
    Never exposes API secrets.
    """
    return check_gemini_health()

@router.post("/api/datasets/{dataset_id}/chat", response_model=ChatMessageResponse)
def chat_with_gemini(
    dataset_id: str,
    req: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Interacts with the Google Gemini AI assistant grounded in actual calculated dataset statistics.
    Never exposes API keys to client.
    """
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    # Save user message
    user_msg = ChatMessage(
        dataset_id=dataset.id,
        user_id=current_user.id,
        role="user",
        content=req.message.strip()
    )
    db.add(user_msg)
    db.commit()

    # Get conversation history
    history_records = db.query(ChatMessage).filter(
        ChatMessage.dataset_id == dataset.id,
        ChatMessage.user_id == current_user.id
    ).order_by(ChatMessage.created_at.asc()).all()

    conv_history = [{"role": h.role, "content": h.content} for h in history_records]

    # Get model runs metadata
    model_runs = db.query(ModelRun).filter(
        ModelRun.dataset_id == dataset.id,
        ModelRun.user_id == current_user.id
    ).all()
    model_runs_data = [
        {"model_name": m.model_name, "task_type": m.task_type, "target_column": m.target_column, "metrics": m.metrics}
        for m in model_runs
    ]

    # Get 3 sample rows
    sample_rows = None
    try:
        df = load_csv_dataframe(dataset.cleaned_storage_path or dataset.storage_path)
        sample_rows = df.head(3).where(df.notnull(), None).to_dict(orient="records")
    except Exception:
        pass

    ai_text, is_active = generate_ai_response(
        user_prompt=req.message.strip(),
        dataset_name=dataset.name,
        profile_data=dataset.profile_data,
        conversation_history=conv_history,
        model_runs=model_runs_data,
        cleaning_stats=dataset.cleaning_stats,
        sample_rows=sample_rows
    )

    # Save assistant message
    ai_msg = ChatMessage(
        dataset_id=dataset.id,
        user_id=current_user.id,
        role="assistant",
        content=ai_text
    )
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)

    return ChatMessageResponse(
        id=ai_msg.id,
        role="assistant",
        content=ai_msg.content,
        created_at=ai_msg.created_at,
        gemini_active=is_active
    )

@router.get("/api/datasets/{dataset_id}/chat/history")
def get_chat_history(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    messages = db.query(ChatMessage).filter(
        ChatMessage.dataset_id == dataset.id,
        ChatMessage.user_id == current_user.id
    ).order_by(ChatMessage.created_at.asc()).all()

    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at
        }
        for m in messages
    ]

@router.delete("/api/datasets/{dataset_id}/chat/history")
def clear_chat_history(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")

    db.query(ChatMessage).filter(
        ChatMessage.dataset_id == dataset.id,
        ChatMessage.user_id == current_user.id
    ).delete()
    db.commit()

    return {"message": "Chat history cleared successfully."}
