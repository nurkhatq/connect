FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    build-essential \
    libpq-dev \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-rus \
    tesseract-ocr-eng \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install additional performance dependencies
RUN pip install --no-cache-dir uvloop httptools

# Copy application code
COPY . .

# Create necessary directories (пустые папки тоже создаем)
RUN mkdir -p data data_stud indexes indexes_stud temp tmp/generated templates cache

# Copy initialization script
COPY scripts/initialize_metadata.py /app/scripts/
RUN chmod +x /app/scripts/initialize_metadata.py

# Set permissions
RUN chmod -R 755 /app

EXPOSE 8000

# Use uvicorn with performance optimizations
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--loop", "uvloop", "--access-log"]