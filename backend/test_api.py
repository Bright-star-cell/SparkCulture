"""Local API contract tests with an optional live Qloo smoke check.

Run `python backend/test_api.py` for offline tests. Add `--live` to send the
same endpoint request to the official Qloo hackathon API using configured credentials.
"""

import argparse
import asyncio
import json
import os
import sys
import unittest
from unittest.mock import patch

import httpx

import main as api


HACKATHON_BASE_URL = "https://hackathon.api.qloo.com"
SAMPLE_REQUEST = {
    "ip_name": "Blade Runner",
    "vertical": "Film/Sci-Fi",
}
FIXTURE_ENTITIES = {
    "urn:entity:artist": "fixture-artist-001",
    "urn:entity:brand": "fixture-brand-001",
    "urn:entity:place": "fixture-place-001",
}
RESPONSE_PREVIEW: dict[str, object] | None = None


async def qloo_response_fixture(
    _client: httpx.AsyncClient,
    path: str,
    params: dict[str, str | int | bool],
) -> dict[str, object]:
    if path == "/search":
        return {
            "success": True,
            "results": {
                "entities": [
                    {"entity_id": "fixture-source-001", "name": "Blade Runner"}
                ]
            },
        }
    if path == "/v2/tags":
        return {"success": True, "results": {"tags": []}}
    if path == "/v2/insights":
        entity_type = str(params["filter.type"])
        return {
            "success": True,
            "results": {
                "entities": [
                    {
                        "entity_id": FIXTURE_ENTITIES[entity_type],
                        "name": f"Fixture {entity_type.rsplit(':', 1)[-1]} partner",
                        "query": {"affinity": 0.82},
                    }
                ]
            },
        }
    raise AssertionError(f"Unexpected Qloo endpoint in test: {path}")


class AnalyzeEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.environment = patch.dict(
            os.environ,
            {
                "QLOO_API_KEY": "local-test-key",
                "QLOO_BASE_URL": HACKATHON_BASE_URL,
                "QLOO_TRUSTED_BASE_URL": HACKATHON_BASE_URL,
            },
        )
        self.environment.start()
        self.qloo_patch = patch.object(api, "qloo_get", qloo_response_fixture)
        self.qloo_patch.start()

    def tearDown(self) -> None:
        self.qloo_patch.stop()
        self.environment.stop()

    @staticmethod
    async def request_api(path: str, payload: dict[str, str]) -> httpx.Response:
        async with api.app.router.lifespan_context(api.app):
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=api.app),
                base_url="http://testserver",
            ) as client:
                return await client.post(path, json=payload)

    def test_sample_request_returns_structured_partner_brief(self) -> None:
        global RESPONSE_PREVIEW

        response = asyncio.run(self.request_api("/api/analyze-ip", SAMPLE_REQUEST))
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["source_entity"]["name"], "Blade Runner")
        self.assertEqual(payload["source_entity"]["id"], "fixture-source-001")
        self.assertEqual(len(payload["partners"]), 3)
        self.assertEqual(
            {partner["vertical"] for partner in payload["partners"]},
            {"music", "fashion", "dining"},
        )
        for partner in payload["partners"]:
            self.assertEqual(partner["affinity_score"], 82.0)
            self.assertEqual(partner["score_basis"], "qloo_affinity")
            self.assertTrue(partner["collaboration_idea"])
            self.assertTrue(partner["product_mockup_description"])
            self.assertIn(
                "gross_revenue_usd",
                partner["financial_pro_forma"],
            )

        RESPONSE_PREVIEW = {
            "source_entity": payload["source_entity"],
            "resolved_tags": payload["resolved_tags"],
            "partners": [
                {
                    "id": partner["id"],
                    "name": partner["name"],
                    "vertical": partner["vertical"],
                    "affinity_score": partner["affinity_score"],
                    "score_basis": partner["score_basis"],
                }
                for partner in payload["partners"]
            ],
            "financial_assumptions": payload["financial_assumptions"],
        }

    def test_rejects_unknown_vertical(self) -> None:
        response = asyncio.run(
            self.request_api(
                "/api/analyze-ip",
                {"title": "Blade Runner", "vertical": "unknown"},
            )
        )
        self.assertEqual(response.status_code, 422)


class QlooConfigurationTests(unittest.TestCase):
    def test_environment_must_use_hackathon_host_and_key(self) -> None:
        with patch.dict(
            os.environ,
            {
                "QLOO_API_KEY": "local-test-key",
                "QLOO_BASE_URL": HACKATHON_BASE_URL,
                "QLOO_TRUSTED_BASE_URL": HACKATHON_BASE_URL,
            },
        ):
            settings = api.get_settings()
            self.assertEqual(settings.base_url, HACKATHON_BASE_URL)
            self.assertEqual(settings.trusted_base_url, HACKATHON_BASE_URL)
            self.assertEqual(settings.api_key, "local-test-key")

        with patch.dict(
            os.environ,
            {
                "QLOO_API_KEY": "local-test-key",
                "QLOO_BASE_URL": "https://api.qloo.com",
                "QLOO_TRUSTED_BASE_URL": HACKATHON_BASE_URL,
            },
        ):
            with self.assertRaisesRegex(RuntimeError, "QLOO_BASE_URL"):
                api.get_settings()

    def test_qloo_request_uses_server_key_and_hackathon_origin(self) -> None:
        requests: list[httpx.Request] = []

        def mock_transport(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            return httpx.Response(
                200,
                json={"success": True, "results": {"entities": []}},
            )

        async def run_request() -> dict[str, object]:
            with patch.dict(
                os.environ,
                {
                    "QLOO_API_KEY": "local-test-key",
                    "QLOO_BASE_URL": HACKATHON_BASE_URL,
                    "QLOO_TRUSTED_BASE_URL": HACKATHON_BASE_URL,
                },
            ):
                async with httpx.AsyncClient(
                    transport=httpx.MockTransport(mock_transport)
                ) as client:
                    return await api.qloo_get(
                        client,
                        "/search",
                        {"query": "Blade Runner"},
                    )

        payload = asyncio.run(run_request())
        self.assertTrue(payload["success"])
        self.assertEqual(len(requests), 1)
        self.assertEqual(
            str(requests[0].url),
            f"{HACKATHON_BASE_URL}/search?query=Blade+Runner",
        )
        self.assertEqual(requests[0].headers["X-Api-Key"], "local-test-key")


def run_live_smoke_test() -> None:
    key = os.getenv("QLOO_API_KEY", "").strip()
    if not key:
        print(
            "LIVE QLOO CHECK: NOT RUN — QLOO_API_KEY is not configured. "
            "No request was sent to Qloo."
        )
        return

    settings = api.get_settings()
    if settings.base_url != HACKATHON_BASE_URL:
        raise RuntimeError("Live check refused: QLOO_BASE_URL is not the hackathon host.")
    request = {
        "ip_name": "Blade Runner",
        "vertical": "Film/Sci-Fi",
    }
    async def request_api() -> httpx.Response:
        async with api.app.router.lifespan_context(api.app):
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=api.app),
                base_url="http://testserver",
            ) as client:
                return await client.post("/api/analyze-ip", json=request)

    response = asyncio.run(request_api())
    if response.status_code != 200:
        raise RuntimeError(
            f"Live local-endpoint check failed with HTTP {response.status_code}: "
            f"{response.text[:500]}"
        )

    payload = response.json()
    if not payload.get("source_entity", {}).get("id"):
        raise RuntimeError("Live Qloo response did not resolve a source entity ID.")
    if not isinstance(payload.get("partners"), list):
        raise RuntimeError("Live Qloo response did not include a partner list.")

    preview = {
        "source_entity": payload["source_entity"],
        "resolved_tags": payload["resolved_tags"],
        "partners": [
            {
                "name": partner["name"],
                "vertical": partner["vertical"],
                "affinity_score": partner["affinity_score"],
                "score_basis": partner["score_basis"],
            }
            for partner in payload["partners"][:3]
        ],
    }
    print(f"LIVE QLOO CHECK: PASS — {settings.base_url} returned a valid analysis.")
    print("LIVE RESPONSE PREVIEW:")
    print(json.dumps(preview, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--live",
        action="store_true",
        help="Also call the official Qloo API through the local FastAPI endpoint.",
    )
    args = parser.parse_args()

    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        return 1

    if RESPONSE_PREVIEW:
        print("\nLOCAL FIXTURE RESPONSE PREVIEW (not live Qloo data):")
        print(json.dumps(RESPONSE_PREVIEW, indent=2))

    if args.live:
        run_live_smoke_test()
    else:
        print("\nLIVE QLOO CHECK: NOT REQUESTED.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
