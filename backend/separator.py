import asyncio
import logging
import os
import shutil
from pathlib import Path
from typing import Dict, Any
import concurrent.futures

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# Job store: { job_id: { status, progress, stems, error, model } }
# status values: "pending" | "processing" | "done" | "error"
jobs: Dict[str, Dict[str, Any]] = {}

OUTPUTS_DIR = Path(__file__).parent / "outputs"
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

thread_pool = concurrent.futures.ThreadPoolExecutor(max_workers=2)

def _run_demucs(job_id: str, file_path: str, model: str):
    """Runs Demucs separation synchronously (called in thread pool)."""
    import demucs.separate
    output_dir = str(OUTPUTS_DIR)
    # Demucs CLI-style invocation via Python API
    # This writes outputs to outputs/{model}/{track_name}/stem.wav
    # Use WAV output (better quality, no re-encoding)
    args = ["-n", model, "--out", output_dir, file_path]
    jobs[job_id]["status"] = "processing"
    jobs[job_id]["progress"] = 10

    try:
        demucs.separate.main(args)
        jobs[job_id]["progress"] = 90

        # Find output files
        # Demucs writes to outputs/{model}/{filename_without_ext}/stem.wav
        file_stem = Path(file_path).stem
        stem_dir = OUTPUTS_DIR / model / file_stem

        # Move to job-specific directory for clean access
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
    except Exception as e:
        logging.error(f"[job {job_id}] Separation failed: {e}", exc_info=True)
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)
    finally:
        # Clean up upload file
        try:
            os.remove(file_path)
        except Exception:
            pass


async def start_separation(job_id: str, file_path: str, model: str):
    """Launches separation in background thread."""
    jobs[job_id] = {
        "status": "pending",
        "progress": 0,
        "stems": [],
        "error": None,
        "model": model,
        "job_dir": None,
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
