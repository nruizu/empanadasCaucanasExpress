import math
import re
import unicodedata
from dataclasses import dataclass
from decimal import Decimal
from urllib.parse import quote_plus, urlsplit

import requests

from django.conf import settings
from django.core.cache import cache

from backend.catalog.models import DeliveryCoverageSettings


@dataclass
class DeliveryValidationResult:
    status: str
    message: str
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    distance_km: Decimal | None = None
    maps_url: str = ""


class DeliveryValidationError(Exception):
    pass


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFD", (value or ""))
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    normalized = normalized.lower().strip()
    return re.sub(r"\s+", " ", normalized)


def _address_mentions_city(address: str, expected_city: str) -> bool:
    if not expected_city:
        return True

    normalized_city = _normalize_text(expected_city)
    if not normalized_city:
        return True

    parts = [_normalize_text(part) for part in address.split(",")]
    return any(normalized_city == part or normalized_city in part for part in parts)


def normalize_address(raw_address: str) -> str:
    address = " ".join((raw_address or "").split())
    city = getattr(settings, "DELIVERY_DEFAULT_CITY", "Popayan")
    region = getattr(settings, "DELIVERY_DEFAULT_REGION", "Cauca")
    country = getattr(settings, "DELIVERY_DEFAULT_COUNTRY", "Colombia")

    if not address:
        return ""

    # Alinea el query para mejorar la precision de Nominatim.
    return f"{address}, {city}, {region}, {country}"


def build_address_queries(raw_address: str) -> list[str]:
    """Construye variantes de consulta para mejorar la tasa de geocodificacion."""
    clean_address = " ".join((raw_address or "").split())
    if not clean_address:
        return []

    queries: list[str] = [clean_address]

    expanded = clean_address
    replacements = {
        " cra ": " carrera ",
        " cl ": " calle ",
        " av ": " avenida ",
        " diag ": " diagonal ",
        " transv ": " transversal ",
    }
    padded = f" {clean_address.lower()} "
    for short, long_name in replacements.items():
        padded = padded.replace(short, long_name)
    expanded = " ".join(padded.strip().split())
    expanded = expanded.replace("#", " ")
    if expanded and expanded not in queries:
        queries.append(expanded)

    normalized = normalize_address(clean_address)
    if normalized and normalized not in queries:
        queries.append(normalized)

    lower_input = clean_address.lower()
    # Fallback util para pruebas en Medellin cuando el usuario solo pone calle/carrera.
    if "medell" not in lower_input and "antioquia" not in lower_input:
        medellin_fallback = f"{clean_address}, Medellin, Antioquia, Colombia"
        if medellin_fallback not in queries:
            queries.append(medellin_fallback)

    return queries


def build_google_maps_url(
    latitude: Decimal | None,
    longitude: Decimal | None,
    address: str,
) -> str:
    if latitude is not None and longitude is not None:
        destination = f"{latitude},{longitude}"
    else:
        destination = address

    return (
        "https://www.google.com/maps/dir/?api=1&destination="
        f"{quote_plus(str(destination))}"
    )


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> Decimal:
    earth_radius_km = 6371.0

    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return Decimal(str(earth_radius_km * c)).quantize(Decimal("0.001"))


def _geocode_with_nominatim(address_query: str) -> tuple[Decimal, Decimal]:
    base_url = getattr(
        settings,
        "NOMINATIM_GEOCODE_URL",
        "https://nominatim.openstreetmap.org/search",
    )
    timeout_seconds = int(getattr(settings, "NOMINATIM_TIMEOUT_SECONDS", 6))
    user_agent = getattr(
        settings,
        "NOMINATIM_USER_AGENT",
        "empanadas-caucanas-express/1.0 (delivery-validation)",
    )

    cache_key = f"delivery-geocode:{address_query.lower()}"
    cached_value = cache.get(cache_key)
    if cached_value:
        return Decimal(cached_value["lat"]), Decimal(cached_value["lon"])

    country_code = getattr(settings, "NOMINATIM_COUNTRY_CODE", "co")
    url = (
        f"{base_url}?q={quote_plus(address_query)}&format=json&limit=1"
        f"&addressdetails=0&countrycodes={quote_plus(country_code)}"
    )
    parsed_url = urlsplit(url)
    if parsed_url.scheme not in {"http", "https"}:
        raise DeliveryValidationError("El servicio de mapas tiene un esquema invalido")

    try:
        response = requests.get(
            url,
            headers={"User-Agent": user_agent},
            timeout=timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.exceptions.HTTPError as exc:
        status_code = getattr(exc.response, "status_code", None)
        if status_code in (429, 503):
            raise DeliveryValidationError(
                "El servicio de geocodificacion no esta disponible"
            )
        raise DeliveryValidationError("No fue posible validar la direccion")
    except requests.exceptions.Timeout:
        raise DeliveryValidationError(
            "Tiempo de espera agotado al validar la direccion"
        )
    except requests.exceptions.RequestException:
        raise DeliveryValidationError(
            "No fue posible conectar con el servicio de mapas"
        )

    if not payload:
        raise DeliveryValidationError("not-found")

    location = payload[0]
    lat = Decimal(location["lat"]).quantize(Decimal("0.0000001"))
    lon = Decimal(location["lon"]).quantize(Decimal("0.0000001"))

    cache.set(cache_key, {"lat": str(lat), "lon": str(lon)}, timeout=60 * 60 * 24)
    return lat, lon


def get_active_delivery_settings() -> DeliveryCoverageSettings:
    settings_obj = DeliveryCoverageSettings.objects.filter(is_enabled=True).first()
    if not settings_obj:
        raise DeliveryValidationError(
            "No hay configuracion de cobertura activa para domicilios"
        )
    return settings_obj


def build_local_origin_query(settings_obj: DeliveryCoverageSettings) -> str:
    parts = [
        (settings_obj.local_address or "").strip(),
        (settings_obj.local_reference or "").strip(),
        (settings_obj.local_city or "").strip(),
        (settings_obj.local_region or "").strip(),
        (settings_obj.local_country or "").strip(),
    ]
    return ", ".join([part for part in parts if part])


def geocode_address(raw_address: str) -> tuple[Decimal, Decimal]:
    queries = build_address_queries(raw_address)

    for query in queries:
        try:
            return _geocode_with_nominatim(query)
        except DeliveryValidationError as exc:
            if str(exc) == "not-found":
                continue
            raise

    raise DeliveryValidationError(
        "No se encontro la direccion ingresada. "
        "Intenta incluir barrio y ciudad (ej: Belen, Medellin)."
    )


def get_coverage_origin_coordinates(
    settings_obj: DeliveryCoverageSettings,
) -> tuple[Decimal, Decimal]:
    if (
        settings_obj.local_latitude is not None
        and settings_obj.local_longitude is not None
    ):
        return settings_obj.local_latitude, settings_obj.local_longitude

    origin_query = build_local_origin_query(settings_obj)
    if not origin_query:
        raise DeliveryValidationError(
            "Falta direccion del local para calcular cobertura"
        )

    lat, lon = geocode_address(origin_query)
    settings_obj.local_latitude = lat
    settings_obj.local_longitude = lon
    settings_obj.save(update_fields=["local_latitude", "local_longitude", "updated_at"])
    return lat, lon


def validate_delivery_address(address: str) -> DeliveryValidationResult:
    clean_address = " ".join((address or "").split())
    if len(clean_address) < 10:
        return DeliveryValidationResult(
            status="invalid",
            message="La direccion es demasiado corta para validacion",
        )

    try:
        settings_obj = get_active_delivery_settings()

        if not _address_mentions_city(clean_address, settings_obj.local_city):
            return DeliveryValidationResult(
                status="invalid",
                message=(
                    "La direccion debe pertenecer a la ciudad/pueblo configurado "
                    f"({settings_obj.local_city})."
                ),
            )

        origin_lat, origin_lon = get_coverage_origin_coordinates(settings_obj)
        lat, lon = geocode_address(clean_address)

        distance_km = haversine_km(
            float(origin_lat),
            float(origin_lon),
            float(lat),
            float(lon),
        )
    except DeliveryValidationError as exc:
        if "No se encontro la direccion" in str(exc):
            return DeliveryValidationResult(status="invalid", message=str(exc))
        return DeliveryValidationResult(status="service_error", message=str(exc))

    if distance_km > settings_obj.max_delivery_km:
        return DeliveryValidationResult(
            status="out_of_coverage",
            message=(
                "La direccion esta fuera de cobertura "
                f"({distance_km} km > {settings_obj.max_delivery_km} km)"
            ),
            latitude=lat,
            longitude=lon,
            distance_km=distance_km,
            maps_url=build_google_maps_url(lat, lon, clean_address),
        )

    return DeliveryValidationResult(
        status="valid",
        message="Direccion valida y dentro de cobertura",
        latitude=lat,
        longitude=lon,
        distance_km=distance_km,
        maps_url=build_google_maps_url(lat, lon, clean_address),
    )
