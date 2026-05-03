"""
routers/transcribe.py — POST /transcribe

Sends audio to Whisper API for transcription with word-level timestamps.
Falls back to mock data when OPENAI_API_KEY is not set.
"""

import os
import tempfile
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

router = APIRouter()

MOCK_WORDS = [
    {"word": "أنا", "start": 0.0, "end": 0.42},
    {"word": "عايز", "start": 0.44, "end": 0.91},
    {"word": "أروح", "start": 0.93, "end": 1.34},
    {"word": "المحطة", "start": 1.36, "end": 1.89},
    {"word": "عشان", "start": 2.01, "end": 2.45},
    {"word": "لازم", "start": 2.48, "end": 2.91},
    {"word": "أوصل", "start": 2.94, "end": 3.37},
    {"word": "بدري", "start": 3.40, "end": 3.82},
    {"word": "النهارده", "start": 3.95, "end": 4.51},
    {"word": "الصبح", "start": 4.54, "end": 5.02},
    {"word": "وبعدين", "start": 5.15, "end": 5.63},
    {"word": "هروح", "start": 5.66, "end": 6.08},
    {"word": "الشغل", "start": 6.11, "end": 6.54},
    {"word": "على", "start": 6.70, "end": 6.98},
    {"word": "طول", "start": 7.01, "end": 7.38},
]


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    dialect: str = Form("egyptian"),
):
    api_key = os.getenv("OPENAI_API_KEY", "")

    if not api_key:
        # Mock mode
        full_text = " ".join(w["word"] for w in MOCK_WORDS)
        return {
            "words": MOCK_WORDS,
            "full_text": full_text,
            "detected_language": "ar",
            "_mock": True,
        }

    # Save temp file for Whisper
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    try:
        contents = await file.read()
        tmp.write(contents)
        tmp.flush()
        tmp.close()

        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        with open(tmp.name, "rb") as audio_file:
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["word"],
                language="ar",
            )

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
        try:
            os.unlink(tmp.name)
        except OSError:
            pass
