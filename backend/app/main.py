import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine, Base
from app.routes import auth, datasets, profiling, cleaning, eda, ml, ai, reports

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("DataPilotAI")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables
    logger.info("Initializing DataPilot AI database schema...")
    Base.metadata.create_all(bind=engine)
    
    # Pre-generate sample datasets if not already present
    sample_dir = os.path.join(settings.BASE_DIR, "sample_data")
    os.makedirs(sample_dir, exist_ok=True)
    try:
        import sys
        if str(settings.BASE_DIR) not in sys.path:
            sys.path.insert(0, str(settings.BASE_DIR))
        from sample_data.sample_generator import generate_samples
        generate_samples(sample_dir)
        logger.info("Sample datasets initialized successfully.")
    except Exception as e:
        logger.warning(f"Could not initialize sample datasets on startup: {e}")

    yield
    # Shutdown
    logger.info("Shutting down DataPilot AI backend.")

app = FastAPI(
    title=settings.APP_NAME,
    description="Automated Data Analytics and Machine Learning Platform with Gemini AI Assistant",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
if not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if "*" not in origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(datasets.router)
app.include_router(profiling.router)
app.include_router(cleaning.router)
app.include_router(eda.router)
app.include_router(ml.router)
app.include_router(ai.router)
app.include_router(reports.router)

@app.get("/api/health")
def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "gemini_configured": bool(settings.GEMINI_API_KEY.strip())
    }

# Path to built Vite frontend assets
FRONTEND_DIST_DIR = os.path.abspath(os.path.join(settings.BASE_DIR, "..", "frontend", "dist"))

# Mount /assets if frontend build exists
assets_dir = os.path.join(FRONTEND_DIST_DIR, "assets")
if os.path.isdir(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error on {request.method} {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again or check parameters."}
    )

# SPA fallback handler for React Router
@app.get("/{full_path:path}")
async def serve_spa_frontend(full_path: str):
    """
    Serves the static Vite frontend for single-service deployment.
    Non-API routes return the SPA index.html or matching static files (e.g., favicon, icons).
    Unmatched API paths return a 404 JSON instead of HTML.
    """
    if full_path.startswith("api/") or full_path == "api":
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": f"API endpoint '/{full_path}' not found."}
        )

    # Serve static root files if present (e.g. favicon.svg, icons.svg, manifest.json)
    if os.path.isdir(FRONTEND_DIST_DIR):
        file_path = os.path.join(FRONTEND_DIST_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)

        # SPA entrypoint for client-side routing
        index_file = os.path.join(FRONTEND_DIST_DIR, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)

    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": "Frontend build not found. Please build the frontend."}
    )
