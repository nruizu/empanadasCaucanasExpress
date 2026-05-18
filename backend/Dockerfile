FROM python:3.12-alpine

WORKDIR /app

ENV PYTHONPATH=/app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD sh -c "python manage.py migrate && python manage.py runserver 0.0.0.0:$PORT"