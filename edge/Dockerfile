# Factory Safety AI - Edge Worker Container
FROM python:3.10-slim

WORKDIR /edge

# Install system dependencies for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

# Expose low-latency MJPEG preview stream server
EXPOSE 8080

CMD ["python", "-m", "app.main", "--config", "edge_config.json"]
