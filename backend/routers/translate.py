import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

# Reverted to standard broad dialects for better stability
DIALECT_RULES = {
    "egyptian": "Use authentic Cairene Arabic. Use (عايز, دلوقتي, إيه, عشان). Keep it very colloquial and natural.",
    "levantine": "Use Shami Arabic (Syrian/Lebanese). Use (بدي, هلق, شو, كتير). Use 'عم' for present continuous.",
    "gulf": "Use Khaleeji Arabic. Use (أبي/أبغى, الحين, وش, وايد/مرة). Focus on authentic Saudi/Emirati phrasing.",
    "maghrebi": "Use Moroccan Darija. Use (بغيت, دابا, شنو, بزاف). Use authentic Moroccan vocabulary.",
    "fusha": "Translate into clear, grammatically correct Modern Standard Arabic."
}

class TranslateRequest(BaseModel):
    text: str
    source_dialect: str
    target_dialect: str

@router.post("/translate")
async def translate_dialect(req: TranslateRequest):
    try:
        specific_rules = DIALECT_RULES.get(req.target_dialect, "Use natural colloquial Arabic.")

        system_prompt = (
            "You are an expert Arabic linguist and dictionary. "
            "1. Clean up any Speech-to-Text typos from the input.\n"
            "2. Map the meaning to perfect Modern Standard Arabic (Fusha).\n"
            f"3. Localize that meaning into natural {req.target_dialect}.\n"
            f"DIALECT RULES: {specific_rules}\n"
            "Return ONLY a JSON object: {\"msa_text\": \"...\", \"target_text\": \"...\"}"
        )

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.3, # Balanced for accuracy
            response_format={"type": "json_object"}, 
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.text}
            ],
        )

        result_json = json.loads(response.choices[0].message.content.strip())
        return {
            "msa_text": result_json.get("msa_text", ""),
            "target_text": result_json.get("target_text", ""),
            "source_dialect": req.source_dialect,
            "target_dialect": req.target_dialect,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))