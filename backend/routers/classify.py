"""
routers/classify.py — POST /classify

Accepts WAV audio, extracts features, runs ML classification.
Returns dialect, confidence scores, i-vector, and visualization data.
"""

import os
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException

from core.features import extract_all_features
from core.classifier import predict, dialect_profiles

router = APIRouter()


@router.post("/classify")
async def classify_audio(file: UploadFile = File(...)):
    """
    Classify the dialect of an Arabic audio clip.

    Accepts: multipart/form-data with 'file' field (WAV/MP3)
    Returns: dialect label, confidence scores, i-vector, feature data, spectrogram data
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    allowed_ext = ('.wav', '.mp3', '.ogg', '.flac', '.m4a')
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {ext}")

    # Save to temp file
    suffix = ext or '.wav'
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        contents = await file.read()
        tmp.write(contents)
        tmp.flush()
        tmp.close()

        # Extract features
        features = extract_all_features(tmp.name)

        # Classify
        result = predict(features["vector"])

        # Build response
        # Build response
        response = {
            "dialect": result["dialect"],
            "confidence": result["confidence"],
            "features": {
                "npvi": features["npvi"],
                "f0_mean": features["f0_mean"],
                "f0_std": features["f0_std"],
                "voiced_frac": features["voiced_frac"],
            },
            "spectrogram_data": {
                "mel_spectrogram": features["mel_spectrogram"],
                "mfcc_frames": features["mfcc_frames"],
                "f0_contour": features["f0_contour"],
                "duration_sec": features["duration_sec"],
                "sr": features["sr"],
                "hop_length": features["hop_length"],
            },
        }

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp.name)
        except OSError:
            pass
