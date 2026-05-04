"""
routers/synthesize.py — POST /synthesize
Uses ElevenLabs Free Tier with OFFICIAL Premade Voices to avoid payment restrictions.
"""

import os
import httpx
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()

# Mapping to ElevenLabs' official PREMADE voices (guaranteed to work on free tier)
# backend/routers/synthesize.py

# backend/routers/synthesize.py

DIALECT_VOICES = {
    "egyptian": "pNInz6obpgDQGcFmaJgB",   # Adam (Solid for Egyptian)
    "levantine": "EXAVITQu4vr4xnSDxMaL",  # Bella (Solid for Shami)
    "gulf": "pNInz6obpgDQGcFmaJgB",       # Adam (Deep tone for KSA)
    "maghrebi": "9BWtsmkyCfEU9m8uXm0X",    # Aria (Universal ID - Works for Maghrebi)
    "fusha": "pNInz6obpgDQGcFmaJgB"        # Adam
}

@router.post("/synthesize")
async def synthesize_speech(
    text: str = Form(...),
    target_dialect: str = Form("egyptian"),
    voice_ref: UploadFile = File(...), # We accept but ignore this file
):
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing ElevenLabs API Key in .env")

    # Look up the specific voice, fallback to Adam if something goes wrong
    voice_id = DIALECT_VOICES.get(target_dialect, "pNInz6obpgDQGcFmaJgB")

    try:
        async with httpx.AsyncClient() as client:
            synth_resp = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                headers={"xi-api-key": api_key, "Content-Type": "application/json"},
                json={
                    "text": text,
                    "model_id": "eleven_multilingual_v2", 
                    "voice_settings": {
                        "stability": 0.4, 
                        "similarity_boost": 0.8
                    },
                },
                timeout=60.0,
            )

            if synth_resp.status_code != 200:
                print(f"\n❌ ELEVENLABS SYNTH ERROR: {synth_resp.text}\n")
                raise HTTPException(status_code=500, detail=f"Synthesis failed: {synth_resp.text}")

            return Response(content=synth_resp.content, media_type="audio/mpeg")

    except Exception as e:
        print(f"\n❌ SYNTHESIS EXCEPTION: {str(e)}\n")
        raise HTTPException(status_code=500, detail=str(e))