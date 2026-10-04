FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TIMESFM_MODEL_PATH=/models/timesfm \
    TIMESFM_DEVICE=cpu

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the public TimesFM 3 checkpoint into the image so production inference
# does not need a runtime model-host dependency.
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='google/timesfm-3.0-pytorch', local_dir='/models/timesfm')"

COPY app.py .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
