"""
core/features.py — DSP Feature Extraction for Arabic Dialect Identification

Extracts a 128-dimensional feature vector from audio:
  ├── MFCC statistics:    78 dims  (13 coefficients × [mean, var] × 3 sets: raw, Δ, ΔΔ)
  ├── SDC statistics:     42 dims  (7 coefficients × 3 blocks × [mean, var])
  ├── Prosody:             5 dims  (F₀_mean, F₀_std, nPVI, voiced_fraction, RMS_mean)
  └── Phoneme proxy:       3 dims  (centroid_mean, centroid_std, centroid_ratio)
"""

import numpy as np
import librosa
import librosa.feature

try:
    import parselmouth
    from parselmouth.praat import call
    HAS_PARSELMOUTH = True
except ImportError:
    HAS_PARSELMOUTH = False

from .phoneme_detector import detect_phonemes


# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

SR = 16000           # Sample rate — all audio resampled to 16kHz mono
N_MFCC = 13          # Number of MFCC coefficients
N_FFT = 512          # FFT window size (~32ms at 16kHz)
HOP_LENGTH = 160     # Hop size (10ms at 16kHz)
WIN_LENGTH = 400     # Window size (25ms at 16kHz — one pitch period at 40Hz)

# SDC parameters (NIST LRE convention)
SDC_N = 7            # Number of cepstral coefficients for SDC
SDC_D = 1            # Frame delta shift
SDC_K = 3            # Number of blocks
SDC_P = 3            # Frame shift between blocks


# ─────────────────────────────────────────────────────────────
# MFCC — Mel-Frequency Cepstral Coefficients (78 dims)
# ─────────────────────────────────────────────────────────────

def extract_mfcc(audio: np.ndarray, sr: int = SR) -> np.ndarray:
    """
    Compute 13 MFCCs with Δ and ΔΔ, then aggregate to per-clip statistics.

    Returns shape (78,): 13 coefficients × [mean, var] × 3 (static, Δ, ΔΔ)
    """
    mfcc = librosa.feature.mfcc(
        y=audio, sr=sr, n_mfcc=N_MFCC,
        n_fft=N_FFT, hop_length=HOP_LENGTH, win_length=WIN_LENGTH,
    )
    delta = librosa.feature.delta(mfcc, order=1)
    delta2 = librosa.feature.delta(mfcc, order=2)

    full = np.vstack([mfcc, delta, delta2])  # (39, T)
    return np.hstack([full.mean(axis=1), full.var(axis=1)])  # (78,)


def compute_mfcc_frames(audio: np.ndarray, sr: int = SR) -> np.ndarray:
    """
    Return the raw MFCC matrix (13, T) for spectrogram heatmap visualization.
    """
    return librosa.feature.mfcc(
        y=audio, sr=sr, n_mfcc=N_MFCC,
        n_fft=N_FFT, hop_length=HOP_LENGTH, win_length=WIN_LENGTH,
    )


# ─────────────────────────────────────────────────────────────
# Mel Spectrogram — for visualization (Task 1)
# ─────────────────────────────────────────────────────────────

def compute_mel_spectrogram(audio: np.ndarray, sr: int = SR,
                             n_mels: int = 80, fmax: int = 8000) -> np.ndarray:
    """
    Compute a log-power mel spectrogram for visualization.
    
    Returns shape (n_mels, T) in dB scale, normalized to [0, 1] for rendering.
    """
    mel = librosa.feature.melspectrogram(
        y=audio, sr=sr, n_mels=n_mels,
        n_fft=N_FFT, hop_length=HOP_LENGTH, win_length=WIN_LENGTH,
        fmax=fmax,
    )
    # Convert to dB (log scale)
    mel_db = librosa.power_to_db(mel, ref=np.max)  # dB, max=0, min≈-80
    
    # Normalize to [0, 1] for frontend color mapping
    mel_norm = (mel_db - mel_db.min()) / (mel_db.max() - mel_db.min() + 1e-8)
    
    return mel_norm


# ─────────────────────────────────────────────────────────────
# SDC — Shifted Delta Cepstra (42 dims)
# ─────────────────────────────────────────────────────────────

def extract_sdc(audio: np.ndarray, sr: int = SR,
                N: int = SDC_N, d: int = SDC_D,
                k: int = SDC_K, P: int = SDC_P) -> np.ndarray:
    """
    Shifted Delta Cepstra captures phonotactic context across a 90ms window.

    For each frame t and block i ∈ {0,1,2}:
        SDC_i(t) = MFCC_{1..N}(t + i·P + d) - MFCC_{1..N}(t + i·P - d)

    Stacking k=3 blocks gives N*k = 21 dims per frame.
    Aggregate: mean + variance → 42 floats.
    """
    mfcc = librosa.feature.mfcc(
        y=audio, sr=sr, n_mfcc=N_MFCC,
        n_fft=N_FFT, hop_length=HOP_LENGTH, win_length=WIN_LENGTH,
    )

    # Use only the first N coefficients
    mfcc_n = mfcc[:N, :]  # (N, T)
    T = mfcc_n.shape[1]

    sdc_frames = []
    # Need enough frames for all blocks
    max_offset = (k - 1) * P + d
    for t in range(max_offset, T - max_offset):
        sdc_t = []
        for i in range(k):
            offset = i * P
            sdc_block = mfcc_n[:, t + offset + d] - mfcc_n[:, t + offset - d]
            sdc_t.append(sdc_block)
        sdc_frames.append(np.concatenate(sdc_t))  # (N*k,) = (21,)

    if len(sdc_frames) == 0:
        # Audio too short — return zeros
        return np.zeros(N * k * 2)

    sdc_matrix = np.array(sdc_frames).T  # (21, T')
    return np.hstack([sdc_matrix.mean(axis=1), sdc_matrix.var(axis=1)])  # (42,)


# ─────────────────────────────────────────────────────────────
# Prosody — F₀, nPVI, voiced fraction, RMS (5 dims)
# ─────────────────────────────────────────────────────────────

def compute_npvi(segment_energies: np.ndarray) -> float:
    """
    Normalized Pairwise Variability Index.

    nPVI = (100 / (m-1)) × Σ |d_k - d_{k+1}| / ((d_k + d_{k+1}) / 2)

    where d_k is the RMS energy of the k-th voiced segment.
    """
    m = len(segment_energies)
    if m < 2:
        return 0.0

    diffs = []
    for i in range(m - 1):
        d_k = segment_energies[i]
        d_next = segment_energies[i + 1]
        mean_pair = (d_k + d_next) / 2.0
        if mean_pair > 0:
            diffs.append(abs(d_k - d_next) / mean_pair)
        else:
            diffs.append(0.0)

    return (100.0 / (m - 1)) * sum(diffs)


def extract_prosody(audio: np.ndarray, sr: int = SR) -> dict:
    """
    Extract prosodic features using Parselmouth (Praat).

    Returns:
        dict with:
            "vector": np.ndarray of shape (5,) — [F₀_mean, F₀_std, nPVI, voiced_fraction, RMS_mean]
            "f0_contour": list of [time_sec, f0_hz] pairs (0.0 Hz = unvoiced)
    """
    if HAS_PARSELMOUTH:
        snd = parselmouth.Sound(audio, sampling_frequency=sr)
        pitch = call(snd, "To Pitch", 0.01, 60.0, 400.0)

        # Extract F₀ contour
        duration = snd.get_total_duration()
        time_step = 0.01  # 10ms
        n_frames = int(duration / time_step)

        f0_contour = []
        f0_values = []
        for i in range(n_frames):
            t = i * time_step
            f0 = call(pitch, "Get value at time", t, "Hertz", "Linear")
            if np.isnan(f0) or f0 == 0:
                f0_contour.append([round(t, 3), 0.0])
            else:
                f0_contour.append([round(t, 3), round(f0, 1)])
                f0_values.append(f0)

        f0_arr = np.array(f0_values) if f0_values else np.array([0.0])
        f0_mean = float(np.mean(f0_arr))
        f0_std = float(np.std(f0_arr))
        voiced_fraction = len(f0_values) / max(n_frames, 1)
    else:
        # Fallback: use librosa's pyin
        f0_raw, voiced_flag, _ = librosa.pyin(
            audio, fmin=60, fmax=400, sr=sr, hop_length=HOP_LENGTH
        )
        f0_raw = np.nan_to_num(f0_raw, nan=0.0)

        f0_contour = []
        f0_values = []
        for i, f0_val in enumerate(f0_raw):
            t = i * HOP_LENGTH / sr
            f0_contour.append([round(t, 3), round(float(f0_val), 1)])
            if f0_val > 0:
                f0_values.append(f0_val)

        f0_arr = np.array(f0_values) if f0_values else np.array([0.0])
        f0_mean = float(np.mean(f0_arr))
        f0_std = float(np.std(f0_arr))
        voiced_fraction = len(f0_values) / max(len(f0_raw), 1)

    # RMS energy
    rms = librosa.feature.rms(y=audio, hop_length=HOP_LENGTH)[0]
    rms_mean = float(np.mean(rms))

    # nPVI: compute from voiced segments
    # Segment voiced frames into contiguous runs
    energy_envelope = librosa.feature.rms(y=audio, hop_length=HOP_LENGTH)[0]
    threshold = np.percentile(energy_envelope, 10)
    voiced_mask = energy_envelope > threshold

    segment_energies = []
    current_energy = []
    for i, is_voiced in enumerate(voiced_mask):
        if is_voiced:
            current_energy.append(energy_envelope[i])
        else:
            if current_energy:
                segment_energies.append(np.mean(current_energy))
                current_energy = []
    if current_energy:
        segment_energies.append(np.mean(current_energy))

    npvi = compute_npvi(np.array(segment_energies))

    vector = np.array([f0_mean, f0_std, npvi, voiced_fraction, rms_mean])

    return {
        "vector": vector,
        "f0_contour": f0_contour,
        "npvi": float(npvi),
        "f0_mean": f0_mean,
        "f0_std": f0_std,
        "voiced_frac": float(voiced_fraction),
    }


# ─────────────────────────────────────────────────────────────
# Master Feature Extractor
# ─────────────────────────────────────────────────────────────

def extract_all_features(wav_path: str) -> dict:
    """
    Load audio, trim silence, extract all features.

    Returns:
        dict with:
            "vector":       np.ndarray (128,) — for classifier
            "mfcc_frames":  list (13 × T as nested lists) — for spectrogram overlay
            "f0_contour":   list of [t, f0] pairs — for F₀ curve overlay
            "phoneme_data": dict — markers + dominant realizations
            "npvi":         float
            "f0_mean":      float
            "f0_std":       float
            "voiced_frac":  float
            "duration_sec": float
    """
    # Load and resample
    audio, sr = librosa.load(wav_path, sr=SR, mono=True)

    # Trim silence
    audio, _ = librosa.effects.trim(audio, top_db=20)

    duration_sec = len(audio) / sr

    # Extract all feature groups
    mfcc_vec = extract_mfcc(audio, sr)        # (78,)
    sdc_vec = extract_sdc(audio, sr)          # (42,)
    prosody = extract_prosody(audio, sr)      # dict with "vector" (5,)
    phoneme_data = detect_phonemes(audio, sr) # dict with "feature_vector" (3,)

    # Concatenate to 128-dim vector
    feature_vector = np.concatenate([
        mfcc_vec,                              # 78
        sdc_vec,                               # 42
        prosody["vector"],                     # 5
        phoneme_data["feature_vector"],        # 3
    ])  # Total: 128

    # Replace any NaN with 0
    feature_vector = np.nan_to_num(feature_vector, nan=0.0)

    # MFCC frames for visualization
    mfcc_frames = compute_mfcc_frames(audio, sr)

    # Mel spectrogram for Task 1 visualization
    mel_spec = compute_mel_spectrogram(audio, sr)

    return {
        "vector": feature_vector,
        "mfcc_frames": mfcc_frames.tolist(),
        "mel_spectrogram": mel_spec.tolist(),
        "f0_contour": prosody["f0_contour"],
        "phoneme_data": phoneme_data,
        "npvi": prosody["npvi"],
        "f0_mean": prosody["f0_mean"],
        "f0_std": prosody["f0_std"],
        "voiced_frac": prosody["voiced_frac"],
        "duration_sec": round(duration_sec, 2),
        "sr": SR,
        "hop_length": HOP_LENGTH,
    }
