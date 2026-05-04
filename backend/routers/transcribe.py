"""
routers/transcribe.py — Phase 1: The Ear
Loads Whisper into RAM at startup and processes incoming audio instantly.
"""

import os
import tempfile
import whisper
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

router = APIRouter()

# ⚠️ CRITICAL FOR SPEED: Load the model into memory at server startup.
print("Loading local Whisper model (Small)...")
model = whisper.load_model("small")
print("Whisper Model loaded and ready!")

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    dialect: str = Form("egyptian"), # Default context
):
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else '.wav'
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    
    try:
        # 1. Fast binary write to temp memory
        contents = await file.read()
        tmp.write(contents)
        tmp.flush()
        tmp.close()

        # 2. Transcribe immediately
        result = model.transcribe(
            tmp.name, 
            language="ar", 
            word_timestamps=True # Keeps your UI highlighting feature alive
        )

        words = []
        for segment in result.get("segments", []):
            for word_info in segment.get("words", []):
                words.append({
                    "word": word_info["word"].strip(),
                    "start": round(word_info["start"], 3),
                    "end": round(word_info["end"], 3),
                })

        return {
            "words": words,
            "full_text": result.get("text", "").strip(),
            "detected_language": "ar",
        }

    except Exception as e:
        print(f"\n❌ WHISPER ERROR: {str(e)}\n")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        # 3. Memory cleanup (prevents server crashes)
        try:
            os.unlink(tmp.name)
        except OSError:
            pass