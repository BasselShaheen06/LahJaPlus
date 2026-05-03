"""
routers/translate.py — POST /translate

Two-step dialect conversion: source dialect → MSA → target dialect via GPT-4o.
Falls back to mock data when OPENAI_API_KEY is not set.
"""

import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

MOCK_TRANSLATIONS = {
    ("egyptian", "gulf"): {
        "msa_text": "أريد أن أذهب إلى المحطة",
        "target_text": "أبغى أروح المحطة",
    },
    ("egyptian", "levantine"): {
        "msa_text": "أريد أن أذهب إلى المحطة",
        "target_text": "بدي روح عالمحطة",
    },
    ("egyptian", "maghrebi"): {
        "msa_text": "أريد أن أذهب إلى المحطة",
        "target_text": "بغيت نمشي للمحطة",
    },
    ("gulf", "egyptian"): {
        "msa_text": "أريد أن أذهب إلى المحطة",
        "target_text": "أنا عايز أروح المحطة",
    },
}


class TranslateRequest(BaseModel):
    text: str
    source_dialect: str
    target_dialect: str


@router.post("/translate")
async def translate_dialect(req: TranslateRequest):
    if req.source_dialect == req.target_dialect:
        return {
            "msa_text": req.text,
            "target_text": req.text,
            "source_dialect": req.source_dialect,
            "target_dialect": req.target_dialect,
        }

    api_key = os.getenv("OPENAI_API_KEY", "")

    if not api_key:
        # Mock mode
        key = (req.source_dialect, req.target_dialect)
        mock = MOCK_TRANSLATIONS.get(key, {
            "msa_text": "أريد أن أذهب إلى المحطة",
            "target_text": req.text,
        })
        return {
            **mock,
            "source_dialect": req.source_dialect,
            "target_dialect": req.target_dialect,
            "_mock": True,
        }

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        dialect_names = {
            "egyptian": "Egyptian", "levantine": "Levantine",
            "gulf": "Gulf", "maghrebi": "Maghrebi/Moroccan",
        }
        src_name = dialect_names.get(req.source_dialect, req.source_dialect)
        tgt_name = dialect_names.get(req.target_dialect, req.target_dialect)

        # Step 1: Dialect → MSA
        msa_resp = client.chat.completions.create(
            model="gpt-4o",
            temperature=0.3,
            messages=[{
                "role": "user",
                "content": (
                    f"You are an Arabic linguistics expert. Translate the following "
                    f"{src_name} Arabic text into Modern Standard Arabic (Fusha). "
                    f"Preserve meaning exactly. Return only the MSA text, nothing else.\n\n"
                    f"Text: {req.text}"
                ),
            }],
        )
        msa_text = msa_resp.choices[0].message.content.strip()

        # Step 2: MSA → Target dialect
        tgt_resp = client.chat.completions.create(
            model="gpt-4o",
            temperature=0.3,
            messages=[{
                "role": "user",
                "content": (
                    f"You are an Arabic linguistics expert specializing in {tgt_name} "
                    f"Arabic dialect. Convert the following Modern Standard Arabic text "
                    f"into natural, spoken {tgt_name} Arabic. Use authentic dialectal "
                    f"vocabulary, morphology, and expressions. Return only the dialectal "
                    f"text, nothing else.\n\nText: {msa_text}"
                ),
            }],
        )
        target_text = tgt_resp.choices[0].message.content.strip()

        return {
            "msa_text": msa_text,
            "target_text": target_text,
            "source_dialect": req.source_dialect,
            "target_dialect": req.target_dialect,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")
