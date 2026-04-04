import uuid
import os
import zipfile
import io
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
import aiofiles

from separator import start_separation, get_job, delete_job, jobs, UPLOADS_DIR, device

app = FastAPI(title="StemSplit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".aac"}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/cuda-status")
async def cuda_status():
    import torch
    return {
        "cuda_available": torch.cuda.is_available(),
        "device_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
        "current_device": device
    }


@app.get("/sessions")
async def list_sessions():
    sessions = [
        {
            "job_id": jid,
            "filename": j.get("filename", "Unknown"),
            "model": j.get("model"),
            "stems": j["stems"],
            "created_at": j.get("created_at"),
        }
        for jid, j in jobs.items()
        if j["status"] == "done"
    ]
    sessions.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return sessions


@app.post("/upload")
async def upload_song(
    file: UploadFile = File(...),
    model: str = Form(default="htdemucs"),
    quality: str = Form(default="medium"),
):
    if not file.filename:
        raise HTTPException(400, "File must have a filename")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported format. Use: {', '.join(ALLOWED_EXTENSIONS)}")

    valid_models = ["htdemucs", "htdemucs_6s"]
    if model not in valid_models:
        raise HTTPException(400, f"Invalid model. Choose: {valid_models}")

    valid_qualities = ["lossless", "high", "medium"]
    if quality not in valid_qualities:
        raise HTTPException(400, f"Invalid quality. Choose: {valid_qualities}")

    job_id = str(uuid.uuid4())
    upload_path = UPLOADS_DIR / f"{job_id}{ext}"

    async with aiofiles.open(upload_path, "wb") as f:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(413, "File too large (max 100MB)")
        await f.write(content)

    await start_separation(job_id, str(upload_path), model, filename=file.filename, quality=quality)

    return {"job_id": job_id}


@app.get("/job/{job_id}")
async def job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return {
        "job_id": job_id,
        "status": job["status"],
        "progress": job["progress"],
        "stems": job["stems"],
        "error": job.get("error"),
    }


@app.get("/stems/{job_id}/{stem_name}")
async def get_stem(job_id: str, stem_name: str):
    job = get_job(job_id)
    if not job or job["status"] != "done":
        raise HTTPException(404, "Job not done or not found")

    fmt = job.get("fmt", "wav")
    stem_path = Path(job["job_dir"]) / f"{stem_name}.{fmt}"
    if not stem_path.exists():
        raise HTTPException(404, f"Stem '{stem_name}' not found")

    media_type = "audio/mpeg" if fmt == "mp3" else "audio/wav"
    return FileResponse(str(stem_path), media_type=media_type, filename=f"{stem_name}.{fmt}")


@app.get("/download/{job_id}")
async def download_all(job_id: str):
    job = get_job(job_id)
    if not job or job["status"] != "done":
        raise HTTPException(404, "Job not done or not found")

    job_dir = Path(job["job_dir"])
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for wav_file in job_dir.glob("*.wav"):
            zf.write(wav_file, wav_file.name)
    zip_buffer.seek(0)

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=stems_{job_id[:8]}.zip"},
    )


@app.delete("/job/{job_id}")
async def cleanup_job(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    delete_job(job_id)
    return {"deleted": job_id}
