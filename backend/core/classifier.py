"""
core/classifier.py — ML Inference using pipeline.pkl

pipeline.pkl is a self-contained sklearn Pipeline:
  StandardScaler(135) → SelectKBest(k=60) → SVC(rbf, probability=True)

predict():       Single-file dialect classification
"""

import os
import pickle
import json
import numpy as np

# pipeline.pkl class indices → dialect labels used by the frontend
# Training order: [EGY=0, KSA=1, LEB=2, MOR=3]
IDX2LABEL = {
    0: "egyptian",   # EGY
    1: "gulf",       # KSA
    2: "levantine",  # LEB
    3: "maghrebi",   # MOR
}
LABELS = [IDX2LABEL[i] for i in range(4)]

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")

# Global pipeline — loaded once at startup
_pipeline = None
dialect_profiles = {}


def _load_profiles():
    path = os.path.join(MODELS_DIR, "dialect_profiles.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def init_models():
    """Called at startup by main.py lifespan. Loads pipeline.pkl."""
    global _pipeline, dialect_profiles
    dialect_profiles = _load_profiles()

    pipeline_path = os.path.join(MODELS_DIR, "pipeline.pkl")
    if os.path.exists(pipeline_path):
        with open(pipeline_path, "rb") as f:
            _pipeline = pickle.load(f)
        print("[classifier] pipeline.pkl loaded — steps:",
              [name for name, _ in _pipeline.steps])
    else:
        _pipeline = None
        print("[classifier] pipeline.pkl not found — running in MOCK mode")


def predict(feature_vector: np.ndarray) -> dict:
    """
    Classify a 135-dim feature vector.

    Returns dict with: dialect (str), confidence (dict[str->float])
    """
    if _pipeline is None:
        return _mock_predict(feature_vector)

    x = np.nan_to_num(feature_vector, nan=0.0).reshape(1, -1)  # (1, 135)

    # One-line inference — pipeline handles scaling + selection + SVC
    proba = _pipeline.predict_proba(x)[0]   # (4,)
    pred  = int(_pipeline.predict(x)[0])    # 0..3

    return {
        "dialect":    IDX2LABEL[pred],
        "confidence": {IDX2LABEL[i]: round(float(p), 4)
                       for i, p in enumerate(proba)},
    }


def blend_predict(feature_vector_blend: np.ndarray) -> dict:
    """
    Classify the blended audio's feature vector.
    (blend.py already blends audio in time-domain then calls predict())
    """
    return predict(feature_vector_blend)


# ─────────────────────────────────────────────────────────────
# Mock (when pipeline.pkl is absent)
# ─────────────────────────────────────────────────────────────

def _mock_predict(feature_vector: np.ndarray) -> dict:
    """Heuristic mock based on nPVI (index 131 in the 135-dim vector)."""
    npvi = float(feature_vector[131]) if len(feature_vector) > 131 else 45.0

    if npvi > 55:
        idx = 3   # maghrebi
    elif npvi > 45:
        idx = 1   # gulf
    elif npvi > 38:
        idx = 2   # levantine
    else:
        idx = 0   # egyptian

    conf = [0.05, 0.05, 0.05, 0.05]
    conf[idx] = 0.85
    for i in range(4):
        if i != idx:
            conf[i] += (0.15 - 0.15) / 3   # distribute remainder

    return {
        "dialect":    IDX2LABEL[idx],
        "confidence": {IDX2LABEL[i]: round(conf[i], 4) for i in range(4)},
    }