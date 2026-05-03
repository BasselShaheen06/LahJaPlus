"""
routers/blend.py — POST /blend

Accepts two I-vectors and an alpha value, returns blended classification.
Lightweight endpoint (<10ms) called on every slider movement.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List

from core.classifier import blend_predict

router = APIRouter()


class BlendRequest(BaseModel):
    ivector_a: List[float] = Field(..., description="I-vector from File A (50 floats)")
    ivector_b: List[float] = Field(..., description="I-vector from File B (50 floats)")
    alpha: float = Field(..., ge=0.0, le=1.0, description="Blend weight: 1.0=File A, 0.0=File B")


@router.post("/blend")
async def blend_dialects(req: BlendRequest):
    """
    Blend two I-vectors and classify the result.

    At α=1.0, confidence matches File A's classification.
    At α=0.0, confidence matches File B's classification.
    At α=0.5, expect a proportional mix.
    """
    result = blend_predict(req.ivector_a, req.ivector_b, req.alpha)
    return result
