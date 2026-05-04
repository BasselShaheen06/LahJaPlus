"""
routers/synthesize.py — POST /synthesize

Text normalization pipeline (runs before every TTS call):
  1. Arabic-Indic → Western digits  (٣ → 3)
  2. Multi-digit numbers → Arabic words  (2024 → ألفان وأربعة وعشرون)
  3. Symbol/abbreviation expansion  (% → بالمئة)
  4. Collapse whitespace

Requires: pip install num2words
"""

import os
import re
import httpx
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from dotenv import load_dotenv

try:
    from num2words import num2words
    HAS_NUM2WORDS = True
except ImportError:
    HAS_NUM2WORDS = False
    print("[synthesize] num2words not installed. Run: pip install num2words")

load_dotenv()
router = APIRouter()

DIALECT_VOICE_PROFILES = {
    "egyptian":  {"voice_id": "pNInz6obpgDQGcFmaJgB", "stability": 0.55, "similarity_boost": 0.65, "style": 0.15},
    "levantine": {"voice_id": "EXAVITQu4vr4xnSDxMaL", "stability": 0.58, "similarity_boost": 0.60, "style": 0.20},
    "gulf":      {"voice_id": "pNInz6obpgDQGcFmaJgB", "stability": 0.60, "similarity_boost": 0.62, "style": 0.10},
    "maghrebi":  {"voice_id": "9BWtsmkyCfEU9m8uXm0X", "stability": 0.52, "similarity_boost": 0.65, "style": 0.25},
    "fusha":     {"voice_id": "pNInz6obpgDQGcFmaJgB", "stability": 0.65, "similarity_boost": 0.60, "style": 0.05},
}

_ARABIC_INDIC = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')

_SYMBOL_MAP = {
    'km²':' كيلومتر مربع ', 'm²':' متر مربع ', '°C':' درجة مئوية ',
    '°F':' درجة فهرنهايت ', '%':' بالمئة ', '٪':' بالمئة ',
    '$':' دولار ', '€':' يورو ', '£':' جنيه ',
    'km':' كيلومتر ', 'kg':' كيلوغرام ', 'cm':' سنتيمتر ',
    '°':' درجة ', '+':' زائد ', '=':' يساوي ', '×':' في ', '÷':' مقسوم على ',
}

def _n2w(n: int) -> str:
    if HAS_NUM2WORDS:
        try:
            return num2words(n, lang='ar')
        except Exception:
            pass
    singles = {0:'صفر',1:'واحد',2:'اثنان',3:'ثلاثة',4:'أربعة',
               5:'خمسة',6:'ستة',7:'سبعة',8:'ثمانية',9:'تسعة'}
    return singles.get(n, str(n))

def _replace_number(m: re.Match) -> str:
    raw = m.group(0)
    if '.' in raw:
        i, d = raw.split('.', 1)
        return f'{_n2w(int(i))} فاصلة {_n2w(int(d))}' if d else _n2w(int(i))
    return _n2w(int(raw))

def normalize_arabic_for_tts(text: str) -> str:
    text = text.translate(_ARABIC_INDIC)
    for sym, rep in sorted(_SYMBOL_MAP.items(), key=lambda x: -len(x[0])):
        text = text.replace(sym, rep)
    text = re.sub(r'-?\d+(?:\.\d+)?', _replace_number, text)
    return re.sub(r'\s+', ' ', text).strip()


@router.post("/synthesize")
async def synthesize_speech(
    text:           str        = Form(...),
    target_dialect: str        = Form("egyptian"),
    voice_ref:      UploadFile = File(...),
):
    api_key = os.getenv("ELEVENLABS_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY not set in .env")

    normalized = normalize_arabic_for_tts(text)
    print(f"[synthesize] {text[:60]!r} → {normalized[:60]!r}")

    profile  = DIALECT_VOICE_PROFILES.get(target_dialect, DIALECT_VOICE_PROFILES["egyptian"])

    payload = {
        "text":          normalized,
        "model_id":      "eleven_turbo_v2_5",
        "language_code": "ar",
        "voice_settings": {
            "stability":         profile["stability"],
            "similarity_boost":  profile["similarity_boost"],
            "style":             profile["style"],
            "use_speaker_boost": True,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as http:
            resp = await http.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{profile['voice_id']}",
                headers={"xi-api-key": api_key, "Content-Type": "application/json"},
                json=payload,
            )

        if resp.status_code == 200:
            return Response(content=resp.content, media_type="audio/mpeg")

        try:
            detail = resp.json().get("detail", {})
            msg = detail.get("message", resp.text) if isinstance(detail, dict) else str(detail)
        except Exception:
            msg = resp.text

        if resp.status_code == 401: raise HTTPException(status_code=500, detail="ElevenLabs: invalid API key")
        if resp.status_code == 429: raise HTTPException(status_code=429, detail="ElevenLabs: quota exceeded")
        if resp.status_code == 422: raise HTTPException(status_code=500, detail=f"ElevenLabs bad request: {msg}")
        raise HTTPException(status_code=500, detail=f"ElevenLabs {resp.status_code}: {msg}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")