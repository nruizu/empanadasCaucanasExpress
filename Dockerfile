FROM python:3.12-alpine

WORKDIR /app

ENV PYTHONPATH=/app

COPY requirements.txt /app/

RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/ /app/backend/

EXPOSE 8080

CMD sh -c "\
python backend/manage.py migrate && \
python backend/manage.py shell -c \"\
from django.contrib.auth import get_user_model; \
User = get_user_model(); \
username='${DJANGO_SUPERUSER_USERNAME}'; \
email='${DJANGO_SUPERUSER_EMAIL}'; \
password='${DJANGO_SUPERUSER_PASSWORD}'; \
if not User.objects.filter(username=username).exists(): \
    User.objects.create_superuser(username, email, password) \
\" && \
python backend/manage.py runserver 0.0.0.0:$PORT"