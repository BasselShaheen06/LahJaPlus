"""
routers/transcribe.py — POST /transcribe

Sends audio to Whisper API for transcription with word-level timestamps.
"""

import os
import tempfile
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    dialect: str = Form("egyptian"),
):
    # 1. We must save the uploaded memory buffer to a temporary file
    # because the OpenAI SDK requires a physical file object.
    allowed_ext = ('.wav', '.mp3', '.ogg', '.flac', '.m4a')
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else '.wav'
    
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    try:
        contents = await file.read()
        tmp.write(contents)
        tmp.flush()
        tmp.close()

        # 2. Call OpenAI Whisper API
        with open(tmp.name, "rb") as audio_file:
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["word"], # CRITICAL for real-time highlighting
                language="ar", # Forcing Arabic context
            )

        # 3. Parse the verbose JSON response
        words = []
        if hasattr(response, "words") and response.words:
            for w in response.words:
                words.append({
                    "word": w.word.strip(),
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                })

        full_text = response.text if hasattr(response, "text") else ""

        return {
            "words": words,
            "full_text": full_text,
            "detected_language": "ar",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        # 4. Always clean up temporary files to prevent server memory leaks
        try:
            os.unlink(tmp.name)
        except OSError:
            pass