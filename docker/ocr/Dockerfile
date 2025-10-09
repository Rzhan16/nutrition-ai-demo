FROM python:3.10-slim

WORKDIR /app

# OpenCV/Paddle 运行时依赖：OpenMP + libGL + glib
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libgl1 \
    libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖（确保是 headless 版 OpenCV）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server ./server

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 8080

# 先单进程，稳定后再改 --workers 2
CMD ["uvicorn","server.main:app","--host","0.0.0.0","--port","8080","--workers","1"]
