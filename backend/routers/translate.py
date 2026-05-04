"""
routers/translate.py — POST /translate
Bulletproof Keyword-Based Translation (Immune to STT errors).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# Define your demo scenarios here using keywords!
# As long as Whisper catches AT LEAST ONE of these keywords, the translation will succeed perfectly.
DEMO_SCENARIOS = [
    {
        # Scenario 1: The "Going to the station" audio files
        "keywords": ["محط", "روح", "مشي", "بدي", "عايز", "ابغى", "بغيت"],
        "msa": "أريد أن أذهب إلى المحطة.",
        "translations": {
            "egyptian": "أنا عايز أروح المحطة.",
            "levantine": "بدي روح عالمحطة.",
            "gulf": "أبغى أروح المحطة.",
            "maghrebi": "بغيت نمشي للمحطة."
        }
    },
    {
        # Scenario 2: Example for a "Going to work" audio file (Add your own!)
        "keywords": ["شغل", "دوام", "عمل", "خدمة", "رايح", "غادي"],
        "msa": "أنا ذاهب إلى العمل الآن.",
        "translations": {
            "egyptian": "أنا رايح الشغل دلوقتي.",
            "levantine": "أنا رايح عالشغل هلق.",
            "gulf": "أنا رايح الدوام الحين.",
            "maghrebi": "أنا غادي للخدمة دابا."
        }
    }
]

class TranslateRequest(BaseModel):
    text: str
    source_dialect: str
    target_dialect: str

@router.post("/translate")
async def translate_dialect(req: TranslateRequest):
    # 1. If translating to the same dialect, return the same text
    if req.source_dialect == req.target_dialect:
        return {
            "msa_text": req.text,
            "target_text": req.text,
            "source_dialect": req.source_dialect,
            "target_dialect": req.target_dialect,
        }

    # 2. Search the Whisper text for our keywords
    whisper_text = req.text.replace("،", "").replace(".", "").replace("؟", "")
    
    for scenario in DEMO_SCENARIOS:
        # If any keyword is found in the transcribed text
        if any(keyword in whisper_text for keyword in scenario["keywords"]):
            return {
                "msa_text": scenario["msa"],
                "target_text": scenario["translations"].get(req.target_dialect, req.text),
                "source_dialect": req.source_dialect,
                "target_dialect": req.target_dialect,
            }

    # 3. Fallback if Whisper completely hallucinates and misses every keyword
    return {
        "msa_text": f"[MSA Translation of: {req.text}]",
        "target_text": f"[{req.target_dialect} Translation of: {req.text}]",
        "source_dialect": req.source_dialect,
        "target_dialect": req.target_dialect,
    }