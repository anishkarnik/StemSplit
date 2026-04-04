FROM python:3.11-slim

WORKDIR /app

# ffmpeg is required by Demucs for audio decoding
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Fix: Use pip install torch with CUDA 12.1 which guarantees compatibility 
# with newer Windows WSL2 NVIDIA drivers, bypassing Conda symbol conflicts.
RUN pip install --no-cache-dir \
    torch==2.3.1 torchaudio==2.3.1 --index-url https://download.pytorch.org/whl/cu121

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
