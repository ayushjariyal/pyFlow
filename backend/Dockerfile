# Backend image — used for BOTH the API (uvicorn) and the Celery worker.
# They share one image and differ only by the command in docker-compose.yml.
FROM python:3.12-slim

# - PYTHONUNBUFFERED: logs show up immediately (not buffered)
# - PYTHONDONTWRITEBYTECODE: skip .pyc files in the container
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install dependencies first so this layer is cached unless requirements change.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code.
COPY . .

EXPOSE 8000

# Default command runs the API. The worker overrides this in docker-compose.yml.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
