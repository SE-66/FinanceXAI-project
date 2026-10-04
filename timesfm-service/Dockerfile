FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TIMESFM_MODEL_PATH=/models/timesfm \
    TIMESFM_DEVICE=cpu

WORKDIR /app

COPY requirements.txt .

# Cloudflare Containers are CPU-only for this service. Install PyTorch from the
# official CPU wheel index first, then install TimesFM without its [torch] extra.
# This prevents pip from resolving the multi-gigabyte CUDA/NVIDIA dependency set.
RUN python -m pip install --no-cache-dir --no-compile \
      torch==2.10.0 \
      --index-url https://download.pytorch.org/whl/cpu \
 && python -m pip install --no-cache-dir --no-compile -r requirements.txt \
 && python -c "import torch; import timesfm3; assert not torch.cuda.is_available(); print('CPU-only PyTorch', torch.__version__)" \
 && find /usr/local/lib/python3.11/site-packages -type d -name __pycache__ -prune -exec rm -rf '{}' +

# Bake the public TimesFM 3 checkpoint into the image so production inference
# does not need a runtime model-host dependency.
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='google/timesfm-3.0-pytorch', local_dir='/models/timesfm')"

COPY app.py .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
