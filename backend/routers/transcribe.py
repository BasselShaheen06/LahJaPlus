"""
routers/transcribe.py — POST /transcribe
Runs Whisper LOCALLY (Free) for transcription with word-level timestamps.
"""

import os
import tempfile
import whisper
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

router = APIRouter()

# Load the local model into memory when the server starts
print("Loading local Whisper model (Small)...")
model = whisper.load_model("small")
print("Whisper Model loaded!")

# Dialect context prompts to prevent Whisper from translating everything into Fusha
DIALECT_PROMPTS = {
    "egyptian": "يا باشا، إزيك؟ عامل إيه؟ أنا عايز أروح المحطة دلوقتي.",
    "levantine": "كيفك يا زلمة؟ شو أخبارك؟ بدي روح عالمحطة هلق.",
    "gulf": "شلونك طال عمرك؟ شخبارك؟ أبغى أروح المحطة الحين.",
    "maghrebi": "لاباس عليك؟ واش راك؟ بغيت نمشي للمحطة دابا."
}

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    dialect: str = Form("egyptian"),
):
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else '.wav'
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    
    try:
        contents = await file.read()
        tmp.write(contents)
        tmp.flush()
        tmp.close()

        prompt_context = DIALECT_PROMPTS.get(dialect, "")
        
        # Run the local model! No API keys required.
        result = model.transcribe(
            tmp.name, 
            language="ar", 
            word_timestamps=True,
            initial_prompt=prompt_context
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
        raise HTTPException(status_code=500, detail=f"Local transcription failed: {str(e)}")
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass