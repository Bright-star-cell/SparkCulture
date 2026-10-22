import asyncio
import math
import os
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field


HACKATHON_BASE_URL = "https://hackathon.api.qloo.com"
load_dotenv(Path(__file__).with_name(".env"))

SOURCE_TYPES = {
    "artist": ("urn:entity:artist", "Music"),
    "book": ("urn:entity:book", "Books"),
    "brand": ("urn:entity:brand", "Brands"),
    "movie": ("urn:entity:movie", "Film"),
    "podcast": ("urn:entity:podcast", "Podcasts"),
    "tv_show": ("urn:entity:tv_show", "TV"),
    "video_game": ("urn:entity:videogame", "Video games"),
}
PARTNER_VERTICALS = (
    ("music", "Music", "urn:entity:artist"),
    ("fashion", "Fashion", "urn:entity:brand"),
    ("dining", "Dining", "urn:entity:place"),
)


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=2, max_length=160)
    vertical: str
    description: str | None = Field(default=None, max_length=1200)

class ResolvedTag(BaseModel):
    id: str
    name: str


class QlooEntity(BaseModel):
    id: str
    name: str
    vertical: str
    affinity_score: float
    score_basis: str
    collaboration_idea: str
    product_mockup_description: str
    financial_pro_forma: dict[str, Any]


class AnalyzeResponse(BaseModel):
    source_entity: dict[str, str]
    resolved_tags: list[ResolvedTag]
    partners: list[QlooEntity]
    financial_assumptions: str


@dataclass(frozen=True)
class QlooSettings:
    api_key: str
    base_url: str
    trusted_base_url: str
    frontend_origins: list[str]


def get_settings() -> QlooSettings:
    api_key = os.getenv("QLOO_API_KEY", "").strip()
    base_url = os.getenv("QLOO_BASE_URL", HACKATHON_BASE_URL).rstrip("/")
    trusted_base_url = os.getenv("QLOO_TRUSTED_BASE_URL", HACKATHON_BASE_URL).rstrip("/")

    if not api_key:
        raise RuntimeError("QLOO_API_KEY is required. Set it in backend/.env.")
    for name, value in (
        ("QLOO_BASE_URL", base_url),
        ("QLOO_TRUSTED_BASE_URL", trusted_base_url),
    ):
        parsed = urlparse(value)
        if value != HACKATHON_BASE_URL or parsed.scheme != "https" or parsed.hostname != "hackathon.api.qloo.com":
            raise RuntimeError(f"{name} must be exactly {HACKATHON_BASE_URL}.")

    origins = get_frontend_origins()
    if not origins:
        raise RuntimeError("FRONTEND_ORIGIN must include at least one browser origin.")

    return QlooSettings(api_key, base_url, trusted_base_url, origins)


def get_frontend_origins() -> list[str]:
    return [
        origin.strip().rstrip("/")
        for origin in os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").split(",")
        if origin.strip()
    ]


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_settings()
    yield


app = FastAPI(
    title="SparkCulture API",
    description="Server-side Qloo proxy for culture-led partnership discovery.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_frontend_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


async def qloo_get(
    client: httpx.AsyncClient,
    path: str,
    params: dict[str, str | int | bool],
) -> dict[str, Any]:
    settings = get_settings()
    try:
        response = await client.get(
            f"{settings.base_url}/{path.lstrip('/')}",
            params=params,
            headers={"X-Api-Key": settings.api_key},
        )
        response.raise_for_status()
        payload = response.json()
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Qloo API request timed out. Please try again.") from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Qloo API returned HTTP {exc.response.status_code}. Check the API key and request inputs.",
        ) from exc
    except (httpx.RequestError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Could not complete a valid response from Qloo.") from exc

    if not isinstance(payload, dict) or payload.get("success") is False:
        raise HTTPException(status_code=502, detail="Qloo returned an unsuccessful response.")
    return payload


def extract_items(payload: dict[str, Any], key: str) -> list[dict[str, Any]]:
    results = payload.get("results", {})
    if isinstance(results, dict):
        items = results.get(key, [])
    elif key == "entities" and isinstance(results, list):
        items = results
    else:
        items = []
    return [item for item in items if isinstance(item, dict)] if isinstance(items, list) else []


async def resolve_entity(
    client: httpx.AsyncClient,
    title: str,
    source_type: str,
) -> dict[str, Any]:
    payload = await qloo_get(
        client,
        "/search",
        {"query": title, "types": source_type, "take": 5, "sort_by": "match"},
    )
    entities = extract_items(payload, "entities")
    if not entities:
        raise HTTPException(
            status_code=404,
            detail=f'Qloo could not find a {source_type.rsplit(":", 1)[-1]} entity named "{title}". Try a more specific title.',
        )

    entity = entities[0]
    entity_id = entity.get("entity_id") or entity.get("id")
    if not isinstance(entity_id, str) or not entity_id:
        raise HTTPException(status_code=502, detail="Qloo search returned a result without an entity ID.")
    return {**entity, "entity_id": entity_id}


async def resolve_tags(client: httpx.AsyncClient, description: str | None) -> list[ResolvedTag]:
    if not description:
        return []

    payload = await qloo_get(
        client,
        "/v2/tags",
        {"filter.query": description, "feature.semantic_search": "true", "take": 5},
    )
    tags = extract_items(payload, "tags")
    resolved: list[ResolvedTag] = []
    for tag in tags:
        tag_id = tag.get("tag_id") or tag.get("id")
        name = tag.get("name")
        if isinstance(tag_id, str) and tag_id and isinstance(name, str) and name:
            resolved.append(ResolvedTag(id=tag_id, name=name))
    return resolved


def get_affinity_score(entity: dict[str, Any], rank: int, count: int) -> tuple[float, str]:
    query = entity.get("query")
    candidates = [
        query.get("affinity") if isinstance(query, dict) else None,
        entity.get("affinity"),
        entity.get("score"),
        entity.get("relevance"),
    ]
    for value in candidates:
        if isinstance(value, (int, float)) and math.isfinite(value):
            score = float(value)
            return round(max(0.0, min(score * 100 if score <= 1 else score, 100.0)), 1), "qloo_affinity"

    rank_score = 100.0 if count <= 1 else 100.0 * (count - rank) / (count - 1)
    return round(rank_score, 1), "qloo_rank_proxy"


def build_collaboration(vertical: str, partner_name: str, title: str) -> tuple[str, str]:
    concepts = {
        "Music": (
            f"{partner_name} x {title}: a limited-run sonic capsule pairing the IP's world with an exclusive artist release.",
            f"Collector vinyl and a digitally unlocked alternate tracklist, co-branded with {partner_name} and {title}.",
        ),
        "Fashion": (
            f"{partner_name} x {title}: a tightly edited apparel capsule translating the IP's visual codes into wearable design.",
            f"A numbered, three-piece apparel drop with co-branded packaging and a digital lookbook for {title}.",
        ),
        "Dining": (
            f"{partner_name} x {title}: a limited-time tasting menu and immersive pop-up inspired by the IP's setting and story.",
            f"A collectible menu-and-merch bundle with a signature dish, custom packaging, and a location-based {title} experience.",
        ),
    }
    return concepts[vertical]


def build_pro_forma(vertical: str) -> dict[str, Any]:
    assumptions = {
        "Music": (5000, 48, 17, 40000),
        "Fashion": (4000, 88, 34, 65000),
        "Dining": (6000, 32, 13, 55000),
    }
    units, price, unit_cost, launch_cost = assumptions[vertical]
    revenue = units * price
    production_cost = units * unit_cost
    return {
        "units": units,
        "retail_price_usd": price,
        "gross_revenue_usd": revenue,
        "production_cost_usd": production_cost,
        "launch_budget_usd": launch_cost,
        "contribution_before_partner_split_usd": revenue - production_cost - launch_cost,
        "basis": "Illustrative planning scenario; assumptions are not Qloo data or a forecast.",
    }


async def get_vertical_partners(
    client: httpx.AsyncClient,
    entity_id: str,
    source_name: str,
    tags: list[ResolvedTag],
    vertical: str,
    label: str,
    entity_type: str,
) -> list[QlooEntity]:
    params: dict[str, str | int] = {
        "filter.type": entity_type,
        "signal.interests.entities": entity_id,
        "take": 5,
    }
    if tags:
        params["signal.interests.tags"] = ",".join(tag.id for tag in tags)
    payload = await qloo_get(client, "/v2/insights", params)
    entities = extract_items(payload, "entities")
    partners: list[QlooEntity] = []
    for rank, entity in enumerate(entities, start=1):
        name = entity.get("name")
        partner_id = entity.get("entity_id") or entity.get("id")
        if not isinstance(name, str) or not name.strip() or not isinstance(partner_id, str):
            continue
        score, basis = get_affinity_score(entity, rank, len(entities))
        collaboration, mockup = build_collaboration(label, name.strip(), source_name)
        partners.append(
            QlooEntity(
                id=partner_id,
                name=name.strip(),
                vertical=vertical,
                affinity_score=score,
                score_basis=basis,
                collaboration_idea=collaboration,
                product_mockup_description=mockup,
                financial_pro_forma=build_pro_forma(label),
            )
        )
    return partners


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze-ip", response_model=AnalyzeResponse)
async def analyze_ip(request: AnalyzeRequest) -> AnalyzeResponse:
    if request.vertical not in SOURCE_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported vertical. Choose one of: {', '.join(SOURCE_TYPES)}.",
        )

    settings = get_settings()
    source_type, source_label = SOURCE_TYPES[request.vertical]
    timeout = httpx.Timeout(20.0, connect=5.0)
    async with httpx.AsyncClient(
        base_url=settings.trusted_base_url,
        timeout=timeout,
        follow_redirects=False,
    ) as client:
        source, tags = await asyncio.gather(
            resolve_entity(client, request.title, source_type),
            resolve_tags(client, request.description),
        )
        entity_id = source["entity_id"]
        partner_groups = await asyncio.gather(
            *(
                get_vertical_partners(
                    client,
                    entity_id,
                    str(source.get("name", request.title)),
                    tags,
                    vertical,
                    label,
                    entity_type,
                )
                for vertical, label, entity_type in PARTNER_VERTICALS
            )
        )

    source_name = source.get("name", request.title)
    return AnalyzeResponse(
        source_entity={
            "id": entity_id,
            "name": str(source_name),
            "vertical": source_label,
        },
        resolved_tags=tags,
        partners=[partner for group in partner_groups for partner in group],
        financial_assumptions=(
            "Financial pro formas are transparent illustrative scenarios, not Qloo measurements, "
            "market research, or guaranteed forecasts."
        ),
    )
