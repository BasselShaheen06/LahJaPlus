"""
core/classifier.py — ML Inference: GMM-UBM → Supervector → PCA → SVM

predict():       Single-file dialect classification
blend_predict(): Two-file I-vector interpolation

Falls back to mock mode when .pkl model files are not present.
"""

import os
import json
import pickle
import numpy as np

LABELS = ["egyptian", "levantine", "gulf", "maghrebi"]
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")


def _load_models():
    """Load all ML model artifacts. Returns dict or None if files missing."""
    required = ["scaler.pkl", "ubm.pkl", "pca.pkl", "svm_classifier.pkl"]
    for f in required:
        if not os.path.exists(os.path.join(MODELS_DIR, f)):
            return None

    models = {}
    models["scaler"] = pickle.load(open(os.path.join(MODELS_DIR, "scaler.pkl"), "rb"))
    models["ubm"] = pickle.load(open(os.path.join(MODELS_DIR, "ubm.pkl"), "rb"))
    models["pca"] = pickle.load(open(os.path.join(MODELS_DIR, "pca.pkl"), "rb"))
    models["svm"] = pickle.load(open(os.path.join(MODELS_DIR, "svm_classifier.pkl"), "rb"))
    return models


def _load_profiles():
    """Load dialect_profiles.json for mock mode and explainability."""
    path = os.path.join(MODELS_DIR, "dialect_profiles.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


# Global model state — set by main.py lifespan
ml_models = {}
dialect_profiles = {}


def init_models():
    """Called at startup. Loads models or sets mock mode."""
    global ml_models, dialect_profiles
    dialect_profiles = _load_profiles()
    loaded = _load_models()
    if loaded:
        ml_models.update(loaded)
        ml_models["mock"] = False
        print("[classifier] Models loaded successfully")
    else:
        ml_models["mock"] = True
        print("[classifier] Model files not found — running in MOCK mode")


def _extract_supervector(x_scaled):
    """Extract supervector from scaled feature vector using UBM posteriors."""
    ubm = ml_models["ubm"]
    posteriors = ubm.predict_proba(x_scaled)[0]  # (n_components,)
    n_components = len(posteriors)
    residuals = []
    for k in range(n_components):
        residual = posteriors[k] * (x_scaled[0] - ubm.means_[k])
        residuals.append(residual)
    return np.hstack(residuals)  # (n_components * feature_dim,)


def predict(feature_vector):
    """
    Classify a 128-dim feature vector.

    Returns dict with: dialect, confidence, ivector
    """
    if ml_models.get("mock", True):
        return _mock_predict(feature_vector)

    # 1. Scale
    x_scaled = ml_models["scaler"].transform(feature_vector.reshape(1, -1))

    # 2. Supervector via UBM
    supervector = _extract_supervector(x_scaled)

    # 3. PCA → I-vector
    ivector = ml_models["pca"].transform(supervector.reshape(1, -1))  # (1, 50)

    # 4. SVM classify
    proba = ml_models["svm"].predict_proba(ivector)[0]
    pred = ml_models["svm"].predict(ivector)[0]

    return {
        "dialect": LABELS[pred],
        "confidence": {LABELS[i]: round(float(p), 4) for i, p in enumerate(proba)},
        "ivector": ivector[0].tolist(),
    }


def blend_predict(ivector_a, ivector_b, alpha):
    """
    Interpolate two I-vectors and classify the blend.
    v_blend = α·v_A + (1−α)·v_B
    """
    v_a = np.array(ivector_a)
    v_b = np.array(ivector_b)
    v_blend = alpha * v_a + (1 - alpha) * v_b

    if ml_models.get("mock", True):
        return _mock_blend(alpha)

    proba = ml_models["svm"].predict_proba(v_blend.reshape(1, -1))[0]
    pred = ml_models["svm"].predict(v_blend.reshape(1, -1))[0]

    return {
        "dialect": LABELS[pred],
        "confidence": {LABELS[i]: round(float(p), 4) for i, p in enumerate(proba)},
        "alpha": alpha,
    }


# ─────────────────────────────────────────────────────────────
# Mock Predictions (when models not loaded)
# ─────────────────────────────────────────────────────────────

def _mock_predict(feature_vector):
    """Generate realistic mock prediction based on feature heuristics."""
    npvi = feature_vector[120] if len(feature_vector) > 120 else 45.0

    if npvi > 55:
        idx = 3  # maghrebi
    elif npvi > 45:
        idx = 2  # gulf
    elif npvi > 38:
        idx = 1  # levantine
    else:
        idx = 0  # egyptian

    conf = [0.05, 0.05, 0.05, 0.05]
    conf[idx] = 0.85
    remaining = 0.15 - sum(c for i, c in enumerate(conf) if i != idx)
    for i in range(4):
        if i != idx:
            conf[i] += remaining / 3

    mock_ivector = np.random.randn(50).tolist()

    return {
        "dialect": LABELS[idx],
        "confidence": {LABELS[i]: round(c, 4) for i, c in enumerate(conf)},
        "ivector": mock_ivector,
    }


def _mock_blend(alpha):
    """Generate mock blend result based on alpha."""
    eg = alpha * 0.85 + (1 - alpha) * 0.05
    lev = alpha * 0.05 + (1 - alpha) * 0.05
    gulf = alpha * 0.05 + (1 - alpha) * 0.85
    mag = alpha * 0.05 + (1 - alpha) * 0.05
    total = eg + lev + gulf + mag
    conf = {"egyptian": round(eg/total, 4), "levantine": round(lev/total, 4),
            "gulf": round(gulf/total, 4), "maghrebi": round(mag/total, 4)}

    best = max(conf, key=conf.get)
    return {"dialect": best, "confidence": conf, "alpha": alpha}
