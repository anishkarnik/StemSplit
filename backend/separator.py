import asyncio
import json
import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any
import concurrent.futures

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# Job store: { job_id: { status, progress, stems, error, model, filename, created_at, job_dir } }
# status values: "pending" | "processing" | "done" | "error"
jobs: Dict[str, Dict[str, Any]] = {}

OUTPUTS_DIR = Path(__file__).parent / "outputs"
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

SESSIONS_FILE = OUTPUTS_DIR / "sessions.json"

thread_pool = concurrent.futures.ThreadPoolExecutor(max_workers=2)


def _save_sessions():
    """Persist all completed sessions to disk."""
    try:
        sessions = [
            {
                "job_id": jid,
                "filename": j.get("filename", "Unknown"),
                "model": j.get("model", "htdemucs"),
                "stems": j["stems"],
                "created_at": j.get("created_at"),
                "job_dir": j["job_dir"],
            }
            for jid, j in jobs.items()
            if j["status"] == "done"
        ]
        SESSIONS_FILE.write_text(json.dumps(sessions, indent=2))
    except Exception as e:
        logging.warning(f"Failed to save sessions: {e}")


def _load_sessions():
    """Load persisted sessions into jobs dict on startup."""
    if not SESSIONS_FILE.exists():
        return
    try:
        sessions = json.loads(SESSIONS_FILE.read_text())
        loaded = 0
        for s in sessions:
            job_dir = Path(s["job_dir"])
            if not job_dir.exists():
                continue
            stems = [f.stem for f in job_dir.glob("*.wav")]
            if not stems:
                continue
            jobs[s["job_id"]] = {
                "status": "done",
                "progress": 100,
                "stems": stems,
                "error": None,
                "model": s.get("model", "htdemucs"),
                "job_dir": str(job_dir),
                "filename": s.get("filename", "Unknown"),
                "created_at": s.get("created_at"),
            }
            loaded += 1
        logging.info(f"Restored {loaded} session(s) from disk.")
    except Exception as e:
        logging.warning(f"Failed to load sessions: {e}")


def _run_demucs(job_id: str, file_path: str, model: str):
    """Runs Demucs separation synchronously (called in thread pool)."""
    import demucs.separate
    output_dir = str(OUTPUTS_DIR)
    args = ["-n", model, "--out", output_dir, file_path]
    jobs[job_id]["status"] = "processing"
    jobs[job_id]["progress"] = 10

    try:
        demucs.separate.main(args)
        jobs[job_id]["progress"] = 90

        file_stem = Path(file_path).stem
        stem_dir = OUTPUTS_DIR / model / file_stem

        job_dir = OUTPUTS_DIR / job_id
        if stem_dir.exists():
            if job_dir.exists():
                shutil.rmtree(str(job_dir))
            shutil.move(str(stem_dir), str(job_dir))
        else:
            raise FileNotFoundError(
                f"Demucs output directory not found: {stem_dir}. "
                "Separation may have failed silently."
            )

        stems = [f.stem for f in job_dir.glob("*.wav")]
        if not stems:
            raise FileNotFoundError(f"No .wav files found in output directory: {job_dir}")

        jobs[job_id]["stems"] = stems
        jobs[job_id]["status"] = "done"
        jobs[job_id]["progress"] = 100
        jobs[job_id]["job_dir"] = str(job_dir)
        jobs[job_id]["created_at"] = datetime.now(timezone.utc).isoformat()
        _save_sessions()
        logging.info(f"[job {job_id}] Done — stems: {stems}")
    except Exception as e:
        logging.error(f"[job {job_id}] Separation failed: {e}", exc_info=True)
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)
    finally:
        try:
            os.remove(file_path)
        except Exception:
            pass


async def start_separation(job_id: str, file_path: str, model: str, filename: str = "Unknown"):
    """Launches separation in background thread."""
    jobs[job_id] = {
        "status": "pending",
        "progress": 0,
        "stems": [],
        "error": None,
        "model": model,
        "job_dir": None,
        "filename": filename,
        "created_at": None,
    }
    loop = asyncio.get_running_loop()
    asyncio.ensure_future(
        loop.run_in_executor(thread_pool, _run_demucs, job_id, file_path, model)
    )


def get_job(job_id: str):
    return jobs.get(job_id)


def delete_job(job_id: str):
    job = jobs.pop(job_id, None)
    if job and job.get("job_dir"):
        shutil.rmtree(job["job_dir"], ignore_errors=True)
    _save_sessions()


# Restore sessions from previous runs on startup
_load_sessions()
