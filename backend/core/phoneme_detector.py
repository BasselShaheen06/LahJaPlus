"""
core/phoneme_detector.py — Qaf/Jeem Acoustic Landmark Detection

Detects stop consonant bursts and classifies them by spectral centroid.
"""

import numpy as np
import librosa

HOP_LENGTH = 160
SR = 16000
ONSET_THRESHOLD_DB = 20
MIN_GAP_FRAMES = 20
BURST_WINDOW = 3


def compute_energy_envelope(audio, sr=SR):
    return librosa.feature.rms(y=audio, hop_length=HOP_LENGTH)[0]


def find_onsets(energy, threshold_db=ONSET_THRESHOLD_DB, min_gap_frames=MIN_GAP_FRAMES):
    onsets = []
    ratio_threshold = 10 ** (threshold_db / 20.0)
    for t in range(BURST_WINDOW, len(energy) - BURST_WINDOW):
        pre_energy = np.mean(energy[max(0, t - BURST_WINDOW):t])
        post_energy = energy[t]
        if pre_energy > 0 and post_energy / pre_energy >= ratio_threshold:
            if not onsets or (t - onsets[-1]) >= min_gap_frames:
                onsets.append(t)
    return onsets


def classify_burst(centroid, energy, onset_t):
    centroid_at_burst = centroid[onset_t] if onset_t < len(centroid) else 0
    pre_start = max(0, onset_t - BURST_WINDOW)
    energy_before = np.mean(energy[pre_start:onset_t]) if onset_t > 0 else 0
    energy_at = energy[onset_t] if onset_t < len(energy) else 0
    energy_drop = (energy_before < 0.01 * energy_at) if energy_at > 0 else False

    post_end = min(len(centroid), onset_t + BURST_WINDOW + 1)
    centroid_after = np.mean(centroid[onset_t+1:post_end]) if onset_t+1 < len(centroid) else 0
    centroid_rises = centroid_after > centroid_at_burst * 1.5

    if energy_drop:
        return {"phone": "qaf", "realization": "glottal", "label": "ق[ʔ]"}
    elif centroid_at_burst < 1500:
        return {"phone": "qaf", "realization": "velar", "label": "ق[g]"}
    elif centroid_at_burst < 2000:
        return {"phone": "qaf", "realization": "uvular", "label": "ق[q]"}
    elif centroid_rises:
        return {"phone": "jeem", "realization": "affricate", "label": "ج[dʒ]"}
    elif centroid_at_burst > 2500:
        return {"phone": "jeem", "realization": "fricative", "label": "ج[ʒ]"}
    else:
        return {"phone": "jeem", "realization": "velar", "label": "ج[g]"}


def detect_phonemes(audio, sr=SR):
    centroid = librosa.feature.spectral_centroid(y=audio, sr=sr, hop_length=HOP_LENGTH)[0]
    energy = compute_energy_envelope(audio, sr)

    centroid_mean = float(np.mean(centroid))
    centroid_std = float(np.std(centroid))
    centroid_ratio = centroid_mean / centroid_std if centroid_std > 0 else 0.0
    feature_vector = np.array([centroid_mean, centroid_std, centroid_ratio])

    onset_frames = find_onsets(energy)
    markers = []
    qaf_real = []
    jeem_real = []

    for onset_t in onset_frames:
        cls = classify_burst(centroid, energy, onset_t)
        time_sec = round(onset_t * HOP_LENGTH / sr, 3)
        markers.append({"time": time_sec, **cls})
        if cls["phone"] == "qaf":
            qaf_real.append(cls["realization"])
        else:
            jeem_real.append(cls["realization"])

    def most_common(lst, default):
        if not lst:
            return default
        from collections import Counter
        return Counter(lst).most_common(1)[0][0]

    return {
        "feature_vector": feature_vector,
        "markers": markers,
        "qaf_dominant": most_common(qaf_real, "glottal"),
        "jeem_dominant": most_common(jeem_real, "velar"),
    }
