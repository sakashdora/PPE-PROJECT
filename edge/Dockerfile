FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
ENV FACTORY_ROOT=/app DB_PATH=/app/data/outbox.db SNAPSHOTS_DIR=/app/data/snapshots MODEL_PATH=/app/models/best_s5.onnx
RUN mkdir -p /app/data/snapshots
EXPOSE 8080 8090
CMD ["python", "-m", "app.main"]
