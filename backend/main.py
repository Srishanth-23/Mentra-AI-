import os
import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from models.db import init_db
from routers import ingest, concepts, ask, quiz, mastery, recovery, privacy, misconceptions_router, global_concepts_router, personal_graph_router, teaching_router, speak_your_model_router

# Initialize SQLite database schema
init_db()

app = FastAPI(
    title="Mentra AI Backend API",
    description="Evidence-grounded, adaptive learning copilot API.",
    version="1.0.0"
)

# Global exception handler to ensure CORS headers are sent even on 500 errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Unhandled Exception on {request.url.path}: {exc}")
    traceback.print_exc()
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": origin if origin else "*",
            "Access-Control-Allow-Credentials": "true"
        }
    )

# CORS Middleware setup - allowing all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(ingest.router, tags=["Ingestion"])
app.include_router(concepts.router, tags=["Concept Graph"])
app.include_router(ask.router, tags=["Grounded Q&A"])
app.include_router(quiz.router, tags=["Adaptive Quiz"])
app.include_router(mastery.router, tags=["Mastery Engine"])
app.include_router(recovery.router, tags=["Recovery Plan"])
app.include_router(privacy.router, tags=["Privacy"])
app.include_router(misconceptions_router.router, tags=["Misconception Patterns"])
app.include_router(global_concepts_router.router, tags=["Global Concepts"])
app.include_router(personal_graph_router.router, tags=["Personal Concept Graph"])
app.include_router(teaching_router.router, tags=["Teach the Novice"])
app.include_router(speak_your_model_router.router, tags=["Speak Your Model"])

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": "Mentra AI Copilot API",
        "version": "1.0.0",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
