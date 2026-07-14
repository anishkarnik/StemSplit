# StemSplit

StemSplit is a self-hosted, local alternative to tools like Moises — upload a song and it splits it into separate audio stems (vocals, drums, bass, and other instruments) using [Demucs](https://github.com/facebookresearch/demucs), Meta's music source separation model. Everything runs on your own machine, so your audio files never leave your computer.

## Features

- **Stem separation** — splits any song into 4 stems (vocals, drums, bass, other) using the `htdemucs` model, or 6 stems (vocals, drums, bass, guitar, piano, other) using `htdemucs_6s`.
- **Selectable output quality** — export stems as lossless WAV, or MP3 at 320kbps (high) / 192kbps (medium).
- **In-browser playback** — waveform-based player (via wavesurfer.js) with per-stem mute/volume control and synced playback.
- **Session persistence** — previously processed songs are saved and reappear in the app after a backend restart, so you don't lose past separations.
- **Batch download** — download all stems for a song as a single ZIP.
- **Fully containerized** — backend (FastAPI + Demucs) and frontend (React + Vite) each run in their own Docker container.

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 18, Vite, Tailwind CSS, wavesurfer.js, Howler.js, Axios |
| Backend  | FastAPI, Demucs, PyTorch/Torchaudio, ffmpeg (for MP3 conversion) |
| Infra    | Docker, Docker Compose, Nginx (serves the built frontend) |

## Project Structure

```
Project-B/
├── backend/
│   ├── main.py          # FastAPI app: upload, job status, stem download, sessions
│   ├── separator.py     # Demucs job runner, session persistence, MP3 conversion
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/             # React app
│   ├── nginx.conf
│   └── Dockerfile
└── docker-compose.yml
```

## Setup

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

### Run with Docker (recommended)

```bash
git clone https://github.com/anishkarnik/StemSplit.git
cd StemSplit
docker compose up --build
```

- Frontend: [http://localhost:5174](http://localhost:5174)
- Backend API: [http://localhost:8001](http://localhost:8001)

The first separation will take longer than usual, since Demucs downloads its pretrained model weights on first run (cached in a Docker volume afterwards).

### Local development (without Docker)

**Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

MP3 export requires `ffmpeg` to be installed and available on your `PATH`.

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs on port `5173` by default; update the CORS origins in `backend/main.py` if you change ports.

## API Overview

| Method | Endpoint                     | Description                                  |
|--------|-------------------------------|-----------------------------------------------|
| POST   | `/upload`                     | Upload a song, starts a separation job        |
| GET    | `/job/{job_id}`                | Poll job status/progress                      |
| GET    | `/sessions`                    | List all completed sessions                   |
| GET    | `/stems/{job_id}/{stem_name}`  | Stream a single stem file                     |
| GET    | `/download/{job_id}`           | Download all stems as a ZIP                   |
| DELETE | `/job/{job_id}`                | Delete a job and its output files             |
| GET    | `/health`                      | Health check                                  |

Supported input formats: `mp3, wav, flac, m4a, ogg, aac` (max 100MB per file).

## Notes

- Separation is CPU/GPU intensive; processing time scales with song length and available hardware. GPU acceleration is used automatically if PyTorch detects CUDA.
- Job data and output stems are persisted under `backend/uploads` and `backend/outputs`, which are mounted as Docker volumes so they survive container restarts.
