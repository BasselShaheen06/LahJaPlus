"""
routers/blend.py — POST /blend

Accepts two raw audio files and an alpha weight via multipart form-data.
Mixes the audio in the time domain (α·A + (1−α)·B), classifies the blend,
and returns both classification results and the blended audio as base64-encoded WAV.
"""

import os
import io
import base64
import tempfile

import numpy as np
import librosa
import soundfile as sf
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from core.features import extract_all_features
from core.classifier import predict

router = APIRouter()

SR = 16000  # must match features.py


@router.post("/blend")
async def blend_dialects(
    file_a: UploadFile = File(..., description="First audio file (File A)"),
    file_b: UploadFile = File(..., description="Second audio file (File B)"),
    alpha: float = Form(..., ge=0.0, le=1.0, description="Blend weight: 1.0 = 100% File A, 0.0 = 100% File B"),
):
    """
    Blend two audio files in the time domain and classify the result.

    Computes: blended = α·A + (1−α)·B
    Returns the dialect classification + the blended audio as base64 WAV.
    """
    allowed_ext = ('.wav', '.mp3', '.ogg', '.flac', '.m4a')

    ext_a = os.path.splitext(file_a.filename or '')[1].lower() or '.wav'
    ext_b = os.path.splitext(file_b.filename or '')[1].lower() or '.wav'

    if ext_a not in allowed_ext:
        raise HTTPException(status_code=400, detail=f"Unsupported format for File A: {ext_a}")
    if ext_b not in allowed_ext:
        raise HTTPException(status_code=400, detail=f"Unsupported format for File B: {ext_b}")

    tmp_a = tempfile.NamedTemporaryFile(delete=False, suffix=ext_a)
    tmp_b = tempfile.NamedTemporaryFile(delete=False, suffix=ext_b)
    tmp_blend_path = None

    try:
        # Write uploaded files to disk
        tmp_a.write(await file_a.read())
        tmp_a.flush()
        tmp_a.close()

        tmp_b.write(await file_b.read())
        tmp_b.flush()
        tmp_b.close()

        # Load both audio clips, resampled to 16 kHz mono
        audio_a, _ = librosa.load(tmp_a.name, sr=SR, mono=True)
        audio_b, _ = librosa.load(tmp_b.name, sr=SR, mono=True)

        # Pad the shorter clip with zeros so lengths match
        len_a, len_b = len(audio_a), len(audio_b)
        target_len = max(len_a, len_b)
        audio_a = np.pad(audio_a, (0, target_len - len_a))
        audio_b = np.pad(audio_b, (0, target_len - len_b))

        # Weighted time-domain blend
        blended = alpha * audio_a + (1.0 - alpha) * audio_b

        # Normalize to prevent clipping
        peak = np.max(np.abs(blended))
        if peak > 1e-6:
            blended = blended / peak * 0.9

        # Write blended audio to temp WAV for feature extraction
        tmp_blend = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        tmp_blend_path = tmp_blend.name
        sf.write(tmp_blend_path, blended, SR)
        tmp_blend.close()

        # Extract features and classify
        features = extract_all_features(tmp_blend_path)
        result = predict(features["vector"])

        # Encode blended WAV as base64 for the frontend to play
        buf = io.BytesIO()
        sf.write(buf, blended, SR, format='WAV', subtype='PCM_16')
        buf.seek(0)
        blended_b64 = base64.b64encode(buf.read()).decode('utf-8')

        return {
            "dialect": result["dialect"],
            "confidence": result["confidence"],
            "alpha": alpha,
            "blended_audio_b64": blended_b64,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blend failed: {str(e)}")
    finally:
        for path in [tmp_a.name, tmp_b.name, tmp_blend_path]:
            if path:
                try:
                    os.unlink(path)
                except OSError:
                    pass
