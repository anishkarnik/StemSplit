FROM python:3.11-slim

WORKDIR /app

# ffmpeg is required by Demucs for audio decoding
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Pin torch + torchaudio to 2.3.1 — last version before torchaudio.save()
# defaulted to torchcodec (2.4.0+), which requires CUDA libs even on CPU builds.
RUN pip install --no-cache-dir \
    torch==2.3.1 torchaudio==2.3.1 --index-url https://download.pytorch.org/whl/cpu

# Install remaining app dependencies (torch/torchaudio already satisfied above)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
