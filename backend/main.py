"""
main.py — FastAPI application entry point

Startup: loads ML models via lifespan context manager
CORS: allows localhost:5173 (Vite dev server)
Routers: /classify, /transcribe, /translate, /synthesize, /blend
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from core.classifier import init_models
from routers import classify, transcribe, translate, synthesize, blend

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load ML models on startup
    init_models()
    yield
    # Cleanup on shutdown (models are global, GC handles it)


app = FastAPI(
    title="LahJa+ — Arabic Dialect Explorer",
    description="Arabic dialect identification using classical ML (GMM-UBM → I-vector → SVM)",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(classify.router)
app.include_router(transcribe.router)
app.include_router(translate.router)
app.include_router(synthesize.router)
app.include_router(blend.router)


@app.get("/")
async def root():
    return {
        "app": "LahJa+ — Arabic Dialect Explorer",
        "version": "1.0.0",
        "endpoints": ["/classify", "/transcribe", "/translate", "/synthesize", "/blend"],
    }
