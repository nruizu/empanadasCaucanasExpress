import math
import re
import unicodedata
import hashlib
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
    city = getattr(settings, "DELIVERY_DEFAULT_CITY", "El Retiro")
    region = getattr(settings, "DELIVERY_DEFAULT_REGION", "Antioquia")
    country = getattr(settings, "DELIVERY_DEFAULT_COUNTRY", "Colombia")

    if not address:
        return ""

    # Alinea el query para mejorar la precision de Nominatim.
    return f"{address}, {city}, {region}, {country}"


def _expand_colombian_abbreviations(text: str) -> str:
    """Expande abreviaciones comunes en direcciones colombianas."""
    replacements = {
        # Prefijos de vía
        r"\bcra\b": "carrera",
        r"\bcarr\b": "carrera",
        r"\bkra\b": "carrera",
        r"\bkr\b": "carrera",
        r"\bcl\b": "calle",
        r"\bcll\b": "calle",
        r"\bav\b": "avenida",
        r"\bave\b": "avenida",
        r"\baven\b": "avenida",
        r"\bdiag\b": "diagonal",
        r"\btransv\b": "transversal",
        r"\btv\b": "transversal",
        r"\bcir\b": "circular",
        r"\bcirc\b": "circular",
        r"\baut\b": "autopista",
        r"\bvte\b": "variante",
        # Puntos cardinales
        r"\bn\b": "norte",
        r"\bs\b": "sur",
        r"\be\b": "este",
        r"\bo\b": "oeste",
        # Otros
        r"\bapto\b": "apartamento",
        r"\bapt\b": "apartamento",
        r"\bint\b": "interior",
        r"\bmz\b": "manzana",
        r"\bblq\b": "bloque",
        r"\bed\b": "edificio",
    }

    expanded = text.lower()
    for pattern, replacement in replacements.items():
        expanded = re.sub(pattern, replacement, expanded)

    return expanded


def _clean_address_for_geocoding(address: str) -> str:
    """Limpia y normaliza una dirección para geocodificación."""
    # Remover caracteres especiales comunes que causan problemas
    cleaned = address.replace("#", " ")
    cleaned = cleaned.replace("-", " ")
    cleaned = cleaned.replace("  ", " ")
    cleaned = cleaned.strip()

    return cleaned


def build_address_queries(raw_address: str) -> list[str]:
    """Construye variantes de consulta para mejorar la tasa de geocodificacion."""
    clean_address = " ".join((raw_address or "").split())
    if not clean_address:
        return []

    queries: list[str] = []

    def add_query(query: str) -> None:
        normalized_query = " ".join((query or "").split())
        if normalized_query and normalized_query not in queries:
            queries.append(normalized_query)

    # Query 1: Dirección original limpia
    add_query(clean_address)

    # Query 2: Con abreviaciones expandidas
    expanded = _expand_colombian_abbreviations(clean_address)
    expanded = _clean_address_for_geocoding(expanded)
    add_query(expanded)

    # Query 3: Dirección normalizada con ciudad completa
    normalized = normalize_address(clean_address)
    add_query(normalized)

    # Query 4: Expandida y normalizada
    expanded_normalized = normalize_address(expanded)
    add_query(expanded_normalized)

    lower_input = clean_address.lower()

    # Query 5: Forzar El Retiro si no está mencionado
    if "retiro" not in lower_input and "antioquia" not in lower_input:
        add_query(f"{clean_address}, El Retiro, Antioquia, Colombia")
        add_query(f"{expanded}, El Retiro, Antioquia, Colombia")

    # También incluir "El Retiro" sin "El" para búsquedas más flexibles
    if "retiro" not in lower_input:
        add_query(f"{clean_address}, Retiro, Antioquia, Colombia")
        add_query(f"{expanded}, Retiro, Antioquia, Colombia")

    # Query 6: Si tiene comas, extraer solo la parte de la calle/dirección
    if "," in clean_address:
        parts = [part.strip() for part in clean_address.split(",") if part.strip()]
        if parts:
            street_only = parts[0]
            street_expanded = _expand_colombian_abbreviations(street_only)
            street_cleaned = _clean_address_for_geocoding(street_expanded)

            # Probar solo la calle con Medellín
            add_query(f"{street_cleaned}, Medellin, Antioquia, Colombia")
            add_query(f"{street_only}, Medellin, Antioquia, Colombia")

            # Si hay barrio/vereda mencionado en la segunda parte
            if len(parts) > 1:
                neighborhood = parts[1].strip()
                add_query(
                    f"{street_cleaned}, {neighborhood}, El Retiro, Antioquia, Colombia"
                )
                add_query(
                    f"{street_only}, {neighborhood}, El Retiro, Antioquia, Colombia"
                )

    # Query 7: Extraer solo números de vía (útil para "Calle 24 # 20-21")
    street_number_match = re.search(
        r"(calle|carrera|avenida|diagonal|transversal|circular|cra|cl|av)"
        r"\s*(\d+[a-z]?)\s*#?\s*(\d+[a-z]?)\s*-?\s*(\d+)?",
        clean_address.lower(),
    )
    if street_number_match:
        via_type = street_number_match.group(1)
        via_number = street_number_match.group(2)
        cross_number = street_number_match.group(3)

        # Expandir tipo de vía
        via_expanded = _expand_colombian_abbreviations(via_type)

        simple_address = f"{via_expanded} {via_number} {cross_number}"
        add_query(f"{simple_address}, El Retiro, Antioquia, Colombia")

    # Query 8: Variantes específicas de veredas y sectores de El Retiro, Antioquia
    known_areas = [
        "pantanillo",
        "la cuchilla",
        "salazar",
        "el pantanillo",
        "la fe",
        "el carmelo",
        "cruz verde",
        "la playa",
        "san jose",
        "el chuscal",
        "la doctora",
        "la mesa",
        "la palma",
        "parte central",
        "centro",
        "parque principal",
        "la plazuela",
        "sector urbano",
    ]

    for area in known_areas:
        if area in lower_input or area.replace(" ", "") in lower_input.replace(" ", ""):
            # Intentar con el sector/vereda si la dirección es confusa
            if len(parts) > 0:
                add_query(f"{parts[0]}, {area}, El Retiro, Antioquia, Colombia")

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
    timeout_seconds = int(getattr(settings, "NOMINATIM_TIMEOUT_SECONDS", 10))
    user_agent = getattr(
        settings,
        "NOMINATIM_USER_AGENT",
        "empanadas-caucanas-express/1.0 (delivery-validation)",
    )

    query_hash = hashlib.sha256(address_query.lower().encode("utf-8")).hexdigest()
    cache_key = f"delivery-geocode:{query_hash}"
    cached_value = cache.get(cache_key)
    if cached_value:
        return Decimal(cached_value["lat"]), Decimal(cached_value["lon"])

    country_code = getattr(settings, "NOMINATIM_COUNTRY_CODE", "co")

    # Mejorar el query a Nominatim con más detalles
    url = (
        f"{base_url}?q={quote_plus(address_query)}&format=json&limit=3"
        f"&addressdetails=1&countrycodes={quote_plus(country_code)}"
        "&accept-language=es"
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

    # Filtrar resultados para priorizar El Retiro, Antioquia
    filtered_results = []
    for result in payload:
        address_details = result.get("address", {})
        city = address_details.get("city", "").lower()
        town = address_details.get("town", "").lower()
        municipality = address_details.get("municipality", "").lower()
        village = address_details.get("village", "").lower()
        county = address_details.get("county", "").lower()
        state = address_details.get("state", "").lower()

        # Priorizar resultados de El Retiro, Antioquia
        is_retiro = any(
            [
                "retiro" in city,
                "retiro" in town,
                "retiro" in municipality,
                "retiro" in village,
                "retiro" in county,
            ]
        )

        is_antioquia = "antioquia" in state

        if is_retiro and is_antioquia:
            filtered_results.insert(0, result)  # Máxima prioridad
        elif is_retiro:
            filtered_results.insert(
                len([r for r in filtered_results if "retiro" in str(r).lower()]), result
            )
        elif is_antioquia:
            filtered_results.append(result)
        else:
            filtered_results.append(result)

    # Usar el mejor resultado disponible
    best_result = filtered_results[0] if filtered_results else payload[0]

    lat = Decimal(best_result["lat"]).quantize(Decimal("0.0000001"))
    lon = Decimal(best_result["lon"]).quantize(Decimal("0.0000001"))

    # Cachear por 7 días
    cache.set(cache_key, {"lat": str(lat), "lon": str(lon)}, timeout=60 * 60 * 24 * 7)
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

    last_error = None

    for query in queries:
        try:
            lat, lon = _geocode_with_nominatim(query)
            # Si encontramos coordenadas válidas, retornar inmediatamente
            return lat, lon
        except DeliveryValidationError as exc:
            last_error = exc
            if str(exc) == "not-found":
                continue
            # Si es un error de servicio, no continuar probando
            if "no esta disponible" in str(exc) or "conectar" in str(exc):
                raise

    # Si llegamos aquí, ninguna query funcionó
    if last_error:
        error_message = str(last_error)
    else:
        error_message = "No se encontró la dirección"

    raise DeliveryValidationError(
        f"{error_message}. "
        "Intenta incluir más detalles como vereda, sector o referencias cercanas "
        "(ej: Calle 24 # 20-21, Centro, El Retiro)."
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
    if len(clean_address) < 5:
        return DeliveryValidationResult(
            status="invalid",
            message="La direccion es demasiado corta. Incluye calle, número y barrio.",
        )

    try:
        settings_obj = get_active_delivery_settings()

        # Verificación de ciudad más flexible
        if settings_obj.local_city and not _address_mentions_city(
            clean_address, settings_obj.local_city
        ):
            # Si la dirección no menciona El Retiro, asumimos que es local
            # Solo advertir si explícitamente menciona otra ciudad importante
            other_cities = [
                "bogota",
                "bogotá",
                "medellin",
                "medellín",
                "cali",
                "barranquilla",
                "cartagena",
                "bucaramanga",
                "envigado",
                "rionegro",
                "marinilla",
                "guarne",
                "carmen de viboral",
                "la ceja",
            ]
            address_lower = clean_address.lower()
            if any(city in address_lower for city in other_cities):
                return DeliveryValidationResult(
                    status="invalid",
                    message=(
                        "La dirección parece ser de otro municipio. "
                        f"Solo atendemos en {settings_obj.local_city}, Antioquia."
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
        error_str = str(exc)
        if "No se encontr" in error_str or "not-found" in error_str:
            return DeliveryValidationResult(status="invalid", message=error_str)
        return DeliveryValidationResult(status="service_error", message=error_str)

    if distance_km > settings_obj.max_delivery_km:
        return DeliveryValidationResult(
            status="out_of_coverage",
            message=(
                f"La direccion esta fuera del area de cobertura. "
                f"Distancia: {distance_km} km "
                f"(máximo: {settings_obj.max_delivery_km} km)"
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
