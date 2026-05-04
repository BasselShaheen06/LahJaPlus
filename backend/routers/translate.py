import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()

# ⚠️ TEMPORARY TEST: Replace 'YOUR_ACTUAL_KEY_HERE' with your real Groq key
# If this works, your .env file was the problem.
GROQ_KEY = os.getenv("GROQ_API_KEY") or "YOUR_ACTUAL_KEY_HERE"

client = OpenAI(
    api_key=GROQ_KEY,
    base_url="https://api.groq.com/openai/v1"
)

DIALECT_RULES = {
    "egyptian": "Use authentic Cairene Arabic (عايز، دلوقتي، إيه).",
    "levantine": "Use Shami Arabic (بدي، هلق، شو).",
    "gulf": "CRITICAL: Must sound like KSA Saudi. Use (أبغى، الحين، وشو، مرة). Use 'G' sound for 'Q'.",
    "maghrebi": "CRITICAL: Strictly Moroccan Darija. Use (دابا، بزاف، بغيت، ديالي، شنو). Use 'كـ' prefix for verbs (e.g., كنمشي).",
    "fusha": "Translate into pure Modern Standard Arabic."
}

class TranslateRequest(BaseModel):
    text: str
    source_dialect: str
    target_dialect: str

@router.post("/translate")
async def translate_dialect(req: TranslateRequest):
    if "YOUR_ACTUAL_KEY" in GROQ_KEY:
        raise HTTPException(status_code=500, detail="API Key not configured in translate.py")
        
    try:
        specific_rules = DIALECT_RULES.get(req.target_dialect, "Use natural colloquial Arabic.")

        system_prompt = (
            "You are a High-Fidelity Arabic Dialect Translator.\n"
            "1. Fix STT typos.\n"
            "2. Map meaning to Fusha (MSA).\n"
            f"3. Localize to authentic street-level {req.target_dialect}.\n"
            f"DIALECT CONSTRAINTS: {specific_rules}\n"
            "Return ONLY a JSON object: {\"msa_text\": \"...\", \"target_text\": \"...\"}"
        )

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            response_format={"type": "json_object"}, 
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.text}
            ],
        )

        return json.loads(response.choices[0].message.content.strip())

    except Exception as e:
        print(f"Translation Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))