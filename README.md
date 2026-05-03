# LahJa+ — Arabic Dialect Explorer

> Identify, visualize, and convert Arabic dialects using classical ML.

**Dialects supported:** Egyptian · Levantine · Gulf · Maghrebi

## What it does

1. **Classify** — Upload a 25–35s Arabic audio clip. The system extracts acoustic features (MFCC, SDC, F₀, nPVI) and classifies the dialect using a GMM-UBM → I-vector → SVM pipeline.
2. **Visualize** — Interactive spectrogram with toggleable MFCC heatmap, F₀ contour, and phoneme landmark overlays (Qaf/Jeem detection).
3. **Transcribe** — Real-time transcription via Whisper API with word-level timestamps that highlight as audio plays.
4. **Convert** — Select a target dialect. The system translates through an MSA pivot using GPT-4o.
5. **Synthesize** — ElevenLabs voice cloning produces speech in the target dialect with the original speaker's voice.
6. **Blend** — Load two files and use a slider to interpolate their I-vectors, watching confidence bars shift in real-time.

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env` from the template:
```bash
cp ../.env.example .env
# Add your API keys
```

Place model files in `backend/models/`:
- `ubm.pkl`, `svm_classifier.pkl`, `pca.pkl`, `scaler.pkl`
- Download from the shared Google Drive link
- If model files are missing, the backend runs in **mock mode** with realistic stub data

Start the server:
```bash
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # → http://localhost:5173
```

The Vite dev server proxies `/api` requests to `localhost:8000`.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 + WaveSurfer.js 7 |
| Backend | FastAPI + Python |
| ML Pipeline | GMM-UBM → I-vector → SVM (scikit-learn) |
| DSP | librosa + Parselmouth (Praat) |
| APIs | OpenAI Whisper · GPT-4o · ElevenLabs |

## Project Structure

```
├── backend/
│   ├── main.py              # FastAPI app, CORS, model loading
│   ├── core/
│   │   ├── features.py      # MFCC, SDC, prosody, phoneme extraction
│   │   ├── classifier.py    # GMM-UBM → supervector → PCA → SVM
│   │   └── phoneme_detector.py  # Qaf/Jeem burst detection
│   ├── routers/             # /classify, /transcribe, /translate, /synthesize, /blend
│   └── models/              # .pkl files + dialect_profiles.json
├── frontend/
│   └── src/
│       ├── components/      # FileLoader, SpectrogramViewer, DialectResult, etc.
│       ├── api/             # Axios client
│       └── hooks/           # useClassify, useTranscript, useBlend, useAudioSync
└── notebooks/
    └── dialect_model_training.ipynb
```

## Dataset

Training data sourced from [ADI-17](https://huggingface.co/datasets/ArabicSpeech/ADI17) (35 clips per dialect, 140 total).

## License

MIT
