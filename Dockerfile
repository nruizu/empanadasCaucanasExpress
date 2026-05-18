FROM python:3.12-alpine

WORKDIR /app

ENV PYTHONPATH=/app

COPY requirements.txt /app/

RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/ /app/backend/

EXPOSE 8080

CMD sh -c "python backend/manage.py migrate && python backend/manage.py runserver 0.0.0.0:$PORT"