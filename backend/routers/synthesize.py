"""
routers/synthesize.py — POST /synthesize

Sends text + voice reference to ElevenLabs for voice-cloned synthesis.
Returns audio/mpeg binary stream.
Falls back to error JSON when ELEVENLABS_API_KEY is not set.
"""

import os
import tempfile
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response

router = APIRouter()


@router.post("/synthesize")
async def synthesize_speech(
    text: str = Form(...),
    target_dialect: str = Form("egyptian"),
    voice_ref: UploadFile = File(...),
):
    api_key = os.getenv("ELEVENLABS_API_KEY", "")

    if not api_key:
        return {
            "error": "no_api_key",
            "fallback_text": text,
            "_mock": True,
            "message": "ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env",
        }

    # Save voice reference to temp file
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    try:
        ref_contents = await voice_ref.read()
        tmp.write(ref_contents)
        tmp.flush()
        tmp.close()

        import httpx

        # Use ElevenLabs speech-to-speech or text-to-speech with voice cloning
        # First, add the voice reference as an instant voice clone
        async with httpx.AsyncClient() as client:
            # Create instant voice clone
            clone_resp = await client.post(
                "https://api.elevenlabs.io/v1/voices/add",
                headers={"xi-api-key": api_key},
                files={"files": ("voice_ref.wav", open(tmp.name, "rb"), "audio/wav")},
                data={
                    "name": f"lahja_clone_{target_dialect}",
                    "description": "Temporary clone for dialect synthesis",
                },
                timeout=30.0,
            )

            if clone_resp.status_code != 200:
                return {
                    "error": "clone_failed",
                    "fallback_text": text,
                    "detail": clone_resp.text,
                }

            voice_id = clone_resp.json().get("voice_id")

            # Synthesize with the cloned voice
            synth_resp = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                headers={
                    "xi-api-key": api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "text": text,
                    "model_id": "eleven_multilingual_v2",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.8,
                    },
                },
                timeout=60.0,
            )

            if synth_resp.status_code != 200:
                return {
                    "error": "synthesis_failed",
                    "fallback_text": text,
                    "detail": synth_resp.text,
                }

            # Clean up: delete the temporary voice clone
            await client.delete(
                f"https://api.elevenlabs.io/v1/voices/{voice_id}",
                headers={"xi-api-key": api_key},
                timeout=10.0,
            )

            return Response(
                content=synth_resp.content,
                media_type="audio/mpeg",
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass
