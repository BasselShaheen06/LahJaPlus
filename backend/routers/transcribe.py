"""
routers/transcribe.py — Phase 1: The Ear

Uses openai-whisper with a dialect-specific initial_prompt to steer the
decoder toward the correct vocabulary register.

Model: whisper-medium (much better Arabic dialect accuracy than small).
       Falls back to small if medium is unavailable.

Word timestamps: enabled — drives the real-time highlight UI.
"""

import os
import tempfile
import whisper
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

router = APIRouter()

# ── Dialect initial prompts ───────────────────────────────────────────────────
# These strings are fed as "context" to the Whisper decoder before the audio.
# They bias the token probabilities toward dialect-specific vocabulary,
# dramatically reducing MSA-normalization errors on colloquial speech.

DIALECT_PROMPTS = {
    "egyptian": (
        "المتحدث يتكلم بالعامية المصرية القاهرية. "
        "استخدم الكلمات: عايز، دلوقتي، إيه، عشان، بقى، كده، زي، اللي، إنت، أنا، ده، دي، مش، لأ، أيوه، طب، يعني، بيتكلم، بعمل، بروح."
    ),
    "levantine": (
        "المتحدث يتكلم بالعامية الشامية (سورية/لبنانية/أردنية/فلسطينية). "
        "استخدم الكلمات: بدي، هلق، شو، هيك، كيف، وين، ليش، يلا، عم بحكي، منيح، كتير، هاد، بتعرف، فيني، لسا."
    ),
    "gulf": (
        "المتحدث يتكلم بالعامية الخليجية السعودية. "
        "استخدم الكلمات: أبغى، الحين، إيش، وش، وايد، زين، يسوي، كذا، هذا، بكرة، لازم، عندي، ما أدري، يالله."
    ),
    "maghrebi": (
        "المتحدث يتكلم بالدارجة المغربية. "
        "استخدم الكلمات: دابا، بزاف، بغيت، ديالي، شنو، واش، هاد، علاش، كنمشي، كنقول، نتا، هوما، خويا، غادي، كيفاش."
    ),
    "fusha": (
        "المتحدث يتكلم بالعربية الفصحى الحديثة."
    ),
}

# ── Model loading ─────────────────────────────────────────────────────────────
# Load at server startup — stays in RAM for instant inference.

def _load_best_whisper():
    """Try medium first (better accuracy), fall back to small."""
    for model_name in ["medium", "small"]:
        try:
            print(f"[transcribe] Loading Whisper {model_name}...")
            m = whisper.load_model(model_name)
            print(f"[transcribe] Whisper {model_name} loaded ✓")
            return m, model_name
        except Exception as e:
            print(f"[transcribe] Could not load {model_name}: {e}")
    raise RuntimeError("No Whisper model could be loaded.")


model, model_name = _load_best_whisper()


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    dialect: str = Form("egyptian"),
):
    """
    Transcribe Arabic audio with word-level timestamps.

    Args:
        file:    Audio file (WAV/MP3/OGG/FLAC/M4A)
        dialect: Detected dialect key — used to pick the initial_prompt
                 that steers decoder vocabulary

    Returns:
        {
            words:             [{word, start, end}, ...]
            full_text:         str
            detected_language: "ar"
            model_used:        str
        }
    """
    ext = os.path.splitext(file.filename or "")[1].lower() or ".wav"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)

    try:
        contents = await file.read()
        tmp.write(contents)
        tmp.flush()
        tmp.close()

        initial_prompt = DIALECT_PROMPTS.get(dialect, DIALECT_PROMPTS["egyptian"])

        result = model.transcribe(
            tmp.name,
            language="ar",
            word_timestamps=True,
            initial_prompt=initial_prompt,
            # Temperature schedule: try 0 first (greedy), fall back to beam if low confidence
            temperature=0.0,
            compression_ratio_threshold=2.4,
            no_speech_threshold=0.6,
        )

        words = []
        for segment in result.get("segments", []):
            for word_info in segment.get("words", []):
                w = word_info["word"].strip()
                if w:  # skip empty tokens
                    words.append({
                        "word":  w,
                        "start": round(word_info["start"], 3),
                        "end":   round(word_info["end"],   3),
                    })

        return {
            "words":             words,
            "full_text":         result.get("text", "").strip(),
            "detected_language": "ar",
            "model_used":        model_name,
        }

    except Exception as e:
        print(f"\n❌ WHISPER ERROR: {e}\n")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass