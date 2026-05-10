"""
routers/translate.py — Dialect Conversion

Model priority:
    1. Gemini 2.0 Flash  (free, best Arabic dialect coverage)
    2. Groq Llama 3.3 70B (fallback if no Gemini key)
"""

import os
import json
import re
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()

# ── Clients ───────────────────────────────────────────────────────────────────

GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_KEY   = os.getenv("GROQ_API_KEY", "")
USE_RULE_FALLBACK = os.getenv("USE_RULE_TRANSLATE", "1") == "1"

_gemini_client = OpenAI(
    api_key=GEMINI_KEY or "placeholder",
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
) if GEMINI_KEY else None

_groq_client = OpenAI(
    api_key=GROQ_KEY or "placeholder",
    base_url="https://api.groq.com/openai/v1",
) if GROQ_KEY else None

def _get_client():
    """Return (client, model_name) — Gemini first, Groq fallback."""
    if _gemini_client and GEMINI_KEY:
        return _gemini_client, "gemini-2.0-flash"
    if _groq_client and GROQ_KEY:
        return _groq_client, "llama-3.3-70b-versatile"
    raise HTTPException(status_code=500, detail="No translation API key configured. Set GEMINI_API_KEY or GROQ_API_KEY in .env")

# ── Dialect lexicon ───────────────────────────────────────────────────────────

_LEXICON_PATH = Path(__file__).parent.parent / "models" / "dialect_lexicon.json"

def _load_lexicon() -> dict:
    if _LEXICON_PATH.exists():
        with open(_LEXICON_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

_LEXICON = _load_lexicon()


def _build_vocab_reference(target_dialect: str) -> str:
    """
    Build a compact vocabulary table for the target dialect.
    Injected into the system prompt so the model uses correct words.
    """
    if not _LEXICON or "lexicon" not in _LEXICON:
        return ""

    lines = [f"VOCABULARY REFERENCE FOR {target_dialect.upper()} DIALECT:"]
    lines.append("Concept | MSA | Use this word in target dialect")
    lines.append("---")
    for entry in _LEXICON["lexicon"]:
        target_word = entry.get(target_dialect, "")
        msa_word    = entry.get("msa", "")
        concept     = entry.get("concept", "")
        if target_word and msa_word:
            lines.append(f"{concept}: MSA={msa_word} → USE={target_word}")

    phono = _LEXICON.get("dialect_phonology_notes", {}).get(target_dialect, {})
    if phono:
        notes = phono.get("notes", "")
        if notes:
            lines.append(f"\nPHONOLOGY NOTE: {notes}")

    return "\n".join(lines)


# ── Dialect rules ─────────────────────────────────────────────────────────────

DIALECT_RULES = {
    "egyptian": {
        "description": "Cairene Egyptian Arabic (عامية مصرية قاهرية)",
        "key_markers": [
            "Use ق as glottal stop ʔ (write: ء or omit): قلب → 'alb",
            "Use ج as hard G: جميل → جميل (keep spelling, sounds like gamil)",
            "Use عايز/عايزة for 'want' (NOT أريد)",
            "Use دلوقتي for 'now' (NOT الآن)",
            "Use إيه for 'what' (NOT ماذا)",
            "Use عشان for 'because/so that'",
            "Use بـ prefix for present tense: بروح، بشرب، بعمل",
            "Use ده/دي for this (NOT هذا/هذه)",
            "Use مش for negation (NOT ليس)",
            "Keep feminine -a endings: شايفة، عايزة",
        ],
        "forbidden": [
            "Do NOT use هلق (Levantine)",
            "Do NOT use أبغى (Gulf)",
            "Do NOT use دابا (Maghrebi)",
            "Do NOT use بدي (Levantine)",
            "Do NOT write pure MSA particles",
        ],
        "example": {
            "msa": "أريد أن أذهب إلى السوق لأنني أحتاج إلى الطعام",
            "target": "أنا عايز أروح السوق عشان محتاج أكل"
        }
    },
    "levantine": {
        "description": "Levantine Shami Arabic (عامية شامية - سورية/لبنانية)",
        "key_markers": [
            "Use بدي for 'I want'",
            "Use هلق/هلأ for 'now'",
            "Use شو for 'what'",
            "Use وين for 'where'",
            "Use ليش for 'why'",
            "Use عم + verb for present progressive: عم بروح، عم بشرب",
            "Use بـ prefix for simple present: بروح، بشرب",
            "Use منيح for 'good'",
            "Use كتير for 'a lot/very'",
            "Use هاد/هاي for this/these",
        ],
        "forbidden": [
            "Do NOT use عايز (Egyptian)",
            "Do NOT use دلوقتي (Egyptian)",
            "Do NOT use إيه for 'what' (Egyptian)",
            "Do NOT use أبغى (Gulf)",
            "Do NOT use دابا (Maghrebi)",
        ],
        "example": {
            "msa": "أريد أن أذهب إلى السوق لأنني أحتاج إلى الطعام",
            "target": "بدي روح عالسوق لأنو محتاج أكل"
        }
    },
    "gulf": {
        "description": "Gulf Arabic / Saudi KSA (عامية خليجية سعودية)",
        "key_markers": [
            "Use أبغى/أبي for 'I want'",
            "Use الحين for 'now'",
            "Use إيش/وش for 'what'",
            "Use وايد for 'a lot/very much'",
            "Use زين for 'good'",
            "Use يسوي for 'do/make'",
            "Use بكرة for 'tomorrow'",
            "Use وياه/وياهم for 'with him/them'",
            "Preserve ث as θ sound (write ث): ثلاثة stays ثلاثة",
            "Formal register: closer to MSA in structure than Egyptian/Levantine",
        ],
        "forbidden": [
            "Do NOT use عايز (Egyptian)",
            "Do NOT use دلوقتي (Egyptian)",
            "Do NOT use بدي (Levantine)",
            "Do NOT use هلق (Levantine)",
            "Do NOT use دابا (Maghrebi)",
            "Do NOT use بزاف (Maghrebi)",
        ],
        "example": {
            "msa": "أريد أن أذهب إلى السوق لأنني أحتاج إلى الطعام",
            "target": "أبغى أروح السوق لأني محتاج أكل"
        }
    },
    "maghrebi": {
        "description": "Moroccan Darija (الدارجة المغربية)",
        "key_markers": [
            "Use دابا/درك for 'now'",
            "Use بزاف for 'a lot/very much'",
            "Use بغيت/حاب for 'I want'",
            "Use ديالي/ديالك for possession (my/your)",
            "Use شنو/آش for 'what'",
            "Use واش for yes/no question particle",
            "Use كـ prefix for present progressive: كنمشي، كنقول، كنخدم",
            "Use غادي for 'going to' (future): غادي نمشي",
            "Use خصني for 'I need'",
            "Use نتا/نتي for you (masc/fem)",
            "Use هوما for 'they'",
            "French loanwords are natural: البيساج، الطوبيس",
        ],
        "forbidden": [
            "Do NOT use عايز (Egyptian)",
            "Do NOT use بدي (Levantine)",
            "Do NOT use الحين (Gulf)",
            "Do NOT use أبغى (Gulf)",
            "Do NOT use دلوقتي (Egyptian)",
            "Do NOT write pure MSA — Darija has heavy phonological reduction",
        ],
        "example": {
            "msa": "أريد أن أذهب إلى السوق لأنني أحتاج إلى الطعام",
            "target": "بغيت نمشي للسوق حيت خصني شي ماكلة"
        }
    },
    "fusha": {
        "description": "Modern Standard Arabic (الفصحى)",
        "key_markers": [
            "Use full MSA grammar: أريد أن، يذهب، يقول",
            "No colloquial contractions",
            "Use proper case endings where natural in written Arabic",
        ],
        "forbidden": [
            "Do NOT use any dialect-specific vocabulary",
        ],
        "example": {
            "msa": "أريد أن أذهب إلى السوق",
            "target": "أريد أن أذهب إلى السوق لأنني في حاجة إلى الطعام"
        }
    },
}


_FALLBACK_MAP = {
    "egyptian": {
        "أريد": "عايز",
        "أريدُ": "عايز",
        "الآن": "دلوقتي",
        "ماذا": "إيه",
        "لماذا": "ليه",
        "هذا": "ده",
        "هذه": "دي",
        "لأن": "عشان",
        "ليس": "مش",
        "أجل": "أيوه",
        "نعم": "أيوه",
    },
    "levantine": {
        "أريد": "بدي",
        "أريدُ": "بدي",
        "الآن": "هلأ",
        "ماذا": "شو",
        "لماذا": "ليش",
        "هذا": "هاد",
        "هذه": "هاي",
        "لأن": "لأنو",
        "ليس": "مو",
        "جيد": "منيح",
        "كثير": "كتير",
    },
    "gulf": {
        "أريد": "أبغى",
        "أريدُ": "أبغى",
        "الآن": "الحين",
        "ماذا": "إيش",
        "لماذا": "ليش",
        "هذا": "هذا",
        "هذه": "هذي",
        "لأن": "لأني",
        "ليس": "مو",
        "جيد": "زين",
        "كثير": "وايد",
    },
    "maghrebi": {
        "أريد": "بغيت",
        "أريدُ": "بغيت",
        "الآن": "دابا",
        "ماذا": "شنو",
        "لماذا": "علاش",
        "هذا": "هاد",
        "هذه": "هادي",
        "لأن": "حيت",
        "ليس": "ماشي",
        "جيد": "مزيان",
        "كثير": "بزاف",
    },
    "fusha": {},
}


def _apply_word_replacements(text: str, mapping: dict) -> str:
    if not mapping:
        return text

    pattern = re.compile(r"\b(" + "|".join(map(re.escape, mapping.keys())) + r")\b")
    return pattern.sub(lambda m: mapping.get(m.group(1), m.group(1)), text)


def _rule_based_translate(text: str, source_dialect: str, target_dialect: str) -> dict:
    mapping = _FALLBACK_MAP.get(target_dialect, {})
    target_text = _apply_word_replacements(text, mapping)
    return {
        "msa_text":       text,
        "target_text":    target_text,
        "source_dialect": source_dialect,
        "target_dialect": target_dialect,
        "mode":           "rule_fallback",
    }


def _build_system_prompt(source_dialect: str, target_dialect: str) -> str:
    rules = DIALECT_RULES.get(target_dialect, {})
    vocab_ref = _build_vocab_reference(target_dialect)
    example   = rules.get("example", {})

    markers_text  = "\n".join(f"  • {m}" for m in rules.get("key_markers", []))
    forbidden_text = "\n".join(f"  ✗ {f}" for f in rules.get("forbidden", []))

    return f"""You are a professional Arabic dialect translator with deep linguistic expertise.

TASK:
1. Fix any STT/Whisper transcription artifacts in the input (wrong letters, missing hamza, MSA normalization of dialect words).
2. Identify the meaning in {source_dialect.upper()} Arabic.
3. Express it in authentic {rules.get('description', target_dialect)} at street/conversational level.

TARGET DIALECT RULES — {target_dialect.upper()}:
{markers_text}

FORBIDDEN IN TARGET:
{forbidden_text}

{vocab_ref}

EXAMPLE:
  Input ({source_dialect}): {example.get('msa', '')}
  Output ({target_dialect}): {example.get('target', '')}

OUTPUT FORMAT — Return ONLY this JSON, nothing else, no markdown:
{{"msa_text": "<the meaning in Modern Standard Arabic>", "target_text": "<authentic {target_dialect} dialect>"}}"""


# ── Schema ────────────────────────────────────────────────────────────────────

class TranslateRequest(BaseModel):
    text:           str
    source_dialect: str
    target_dialect: str


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/translate")
async def translate_dialect(req: TranslateRequest):

    if req.source_dialect == req.target_dialect:
        return {
            "msa_text":       req.text,
            "target_text":    req.text,
            "source_dialect": req.source_dialect,
            "target_dialect": req.target_dialect,
        }

    try:
        client, model = _get_client()
        system_prompt = _build_system_prompt(req.source_dialect, req.target_dialect)

        response = client.chat.completions.create(
            model=model,
            temperature=0.2,
            max_tokens=1024,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": req.text},
            ],
        )

        raw = response.choices[0].message.content.strip()

        # Strip markdown fences if model still wraps output
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        parsed = json.loads(raw)

        return {
            "msa_text":       parsed.get("msa_text", ""),
            "target_text":    parsed.get("target_text", ""),
            "source_dialect": req.source_dialect,
            "target_dialect": req.target_dialect,
        }

    except json.JSONDecodeError as e:
        print(f"[translate] JSON parse error: {e}\nRaw: {raw}")
        raise HTTPException(status_code=500, detail="Model returned invalid JSON")
    except Exception as e:
        print(f"[translate] Error: {e}")
        if USE_RULE_FALLBACK:
            return _rule_based_translate(req.text, req.source_dialect, req.target_dialect)
        raise HTTPException(status_code=500, detail=str(e))