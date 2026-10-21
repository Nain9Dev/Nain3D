import hashlib
import time
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional
import trimesh
from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile, status
from ..domain.models import EvaluationResult, ProfileDefinition
from ..domain.profiles import DEFAULT_PROFILE, PROFILES
from ..engine.evaluator import evaluate_conformance
from ..engine.inventory import read_inventory
from ..engine.mesh import extract_features, load_mesh_from_bytes
from ..ml.classifier import predict_with_llm_if_available

router = APIRouter(prefix="/api/v1/conformance", tags=["Conformance"])

HERO_SAMPLES_DIR = Path(__file__).resolve().parents[3] / "Nain3D.Client" / "public" / "samples"
KNOWN_SAMPLE_IDS = frozenset(
    {
        "sample-monitor",
        "sample-chair",
        "sample-industrial",
        "sample-oversized-chair",
        "sample-shoe",
        "sample-oversized-shoe",
    }
)

# Plain codes: Starlette renamed these constants (413/422) between versions, which raises deprecation warnings.
HTTP_413_TOO_LARGE = 413
HTTP_422_UNPROCESSABLE = 422
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
GLB_MAGIC = b"glTF"

# Cache for generated synthetic benchmark samples
_SYNTHETIC_SAMPLES_CACHE: Dict[str, bytes] = {}


def _get_or_create_sample_glb(sample_id: str) -> bytes:
    """Generates synthetic 3D GLB primitives on demand for zero-external-dependency benchmarking."""
    if sample_id in _SYNTHETIC_SAMPLES_CACHE:
        return _SYNTHETIC_SAMPLES_CACHE[sample_id]

    # Prefer the hero models generated for the client (same bytes as the static site).
    hero_path = HERO_SAMPLES_DIR / f"{sample_id}.glb"
    if sample_id in KNOWN_SAMPLE_IDS and hero_path.is_file():
        _SYNTHETIC_SAMPLES_CACHE[sample_id] = hero_path.read_bytes()
        return _SYNTHETIC_SAMPLES_CACHE[sample_id]

    if sample_id == "sample-monitor":
        # Compliant display screen (thin profile)
        mesh = trimesh.creation.box(extents=[0.9, 0.55, 0.05])
    elif sample_id == "sample-chair":
        # Compliant seating unit
        seat = trimesh.creation.box(extents=[0.6, 0.6, 0.08])
        back = trimesh.creation.box(extents=[0.6, 0.08, 0.7])
        back.apply_translation([0, -0.26, 0.35])
        mesh = trimesh.util.concatenate([seat, back])
    elif sample_id == "sample-industrial":
        # High precision watertight industrial component
        mesh = trimesh.creation.icosphere(subdivisions=3, radius=0.25)
    elif sample_id == "sample-oversized-chair":
        # Deliberately fails scale check (> 3.0m)
        mesh = trimesh.creation.box(extents=[4.5, 4.2, 5.0])
    else:
        mesh = trimesh.creation.box(extents=[1.0, 1.0, 1.0])

    glb_bytes = mesh.export(file_type="glb")
    _SYNTHETIC_SAMPLES_CACHE[sample_id] = glb_bytes
    return glb_bytes


@router.get("/profiles", response_model=List[ProfileDefinition])
async def list_profiles() -> List[ProfileDefinition]:
    """Lists all active deterministic technical contract profiles."""
    return list(PROFILES.values())


@router.get("/samples")
async def list_samples():
    """Lists built-in synthetic benchmark 3D models available for instant demonstration."""
    return [
        {
            "id": "sample-monitor",
            "name": "Flat Display Monitor",
            "category": "Monitor",
            "expected_verdict": "CONFORMANT",
            "description": "Thin aspect ratio (0.9 x 0.55 x 0.05 m), within 25,000 triangle budget.",
        },
        {
            "id": "sample-chair",
            "name": "Standard Office Chair",
            "category": "Mobiliario (Chair)",
            "expected_verdict": "CONFORMANT",
            "description": "Furniture bounds (0.6 x 0.6 x 0.78 m), within 50,000 triangle budget.",
        },
        {
            "id": "sample-industrial",
            "name": "Industrial Valve Spherical Part",
            "category": "Pieza Industrial",
            "expected_verdict": "CONFORMANT",
            "description": "Watertight manifold sphere (0.5m diameter), solid volume verified.",
        },
        {
            "id": "sample-oversized-chair",
            "name": "Oversized Colossus Chair (Violation Demo)",
            "category": "Mobiliario (Chair)",
            "expected_verdict": "NON_CONFORMANT",
            "description": "Exceeds scale bounds (5.0m > 3.0m limit). Demonstrates deterministic rejection.",
        },
        {
            "id": "sample-shoe",
            "name": "Sneaker (Materials Variants Shoe, CC BY 4.0, Shopify)",
            "category": "Prop / Decorativo",
            "expected_verdict": "CONFORMANT",
            "description": "Textured PBR sneaker (0.30 x 0.15 x 0.12 m, 22,700 triangles), within every profile budget.",
        },
        {
            "id": "sample-oversized-shoe",
            "name": "Giant Sneaker (Violation Demo, CC BY 4.0, Shopify)",
            "category": "Prop / Decorativo",
            "expected_verdict": "NON_CONFORMANT",
            "description": "Same sneaker scaled to 5.0 m: exceeds every profile's scale limit.",
        },
    ]


@router.get("/samples/{sample_id}/download")
async def download_sample(sample_id: str):
    """Downloads or streams the synthetic 3D GLB model for in-browser 3D rendering."""
    if sample_id not in KNOWN_SAMPLE_IDS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown sample '{sample_id}'.")
    try:
        data = _get_or_create_sample_glb(sample_id)
    except Exception as e:  # Generation failure is a server problem, not a missing resource.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sample '{sample_id}' could not be generated: {e}",
        )
    return Response(content=data, media_type="model/gltf-binary")


@router.post("/evaluate", response_model=EvaluationResult)
async def evaluate_asset(
    file: UploadFile = File(..., description="Binary 3D model in .glb format"),
    override_profile: Optional[str] = Form(None, description="Optional profile category to enforce"),
    custom_profile: Optional[str] = Form(
        None, description="Optional profile as JSON (ProfileDefinition); takes precedence over override_profile"
    ),
) -> EvaluationResult:
    """
    Evaluates an ingested 3D model (.glb).
    Extracts geometric properties, runs AI proposal classification, applies deterministic contract rules,
    and returns a fail-closed verdict.
    """
    start_time = time.perf_counter()

    # Safeguards, checked before any parsing: .glb only, bounded size, binary glTF header.
    if not (file.filename or "").lower().endswith(".glb"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only binary glTF (.glb) files are accepted.",
        )
    file_bytes = await file.read(MAX_UPLOAD_BYTES + 1)  # One extra byte proves the limit was exceeded.
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=HTTP_413_TOO_LARGE,
            detail=f"The uploaded file exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
        )

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded 3D file is empty.",
        )
    if file_bytes[:4] != GLB_MAGIC:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="Invalid binary glTF header: the file does not start with the 'glTF' magic bytes.",
        )

    # Compute immutable SHA-256
    asset_sha256 = hashlib.sha256(file_bytes).hexdigest()

    try:
        mesh = load_mesh_from_bytes(file_bytes, file.filename or "model.glb")
    except Exception as e:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail=f"Unable to parse 3D asset as valid glTF/GLB binary: {e}",
        )

    # Extract geometric features, plus the texture/material inventory used by the optional store checks
    inventory = read_inventory(file_bytes)
    features = extract_features(mesh).model_copy(
        update={
            "texture_max_side_px": inventory.texture_max_side_px,
            "material_count": inventory.material_count,
            "textured_material_count": inventory.textured_material_count,
            "has_uv_coordinates": inventory.has_uv_coordinates,
            "inventory_readable": inventory.readable,
        }
    )

    # Infer AI proposal (Random Forest with fallback)
    ai_proposal = await predict_with_llm_if_available(mesh, features)

    # Resolve profile
    if custom_profile:
        try:
            profile = ProfileDefinition.model_validate_json(custom_profile)
        except ValueError as e:  # Includes pydantic's ValidationError and malformed JSON.
            raise HTTPException(
                status_code=HTTP_422_UNPROCESSABLE,
                detail=f"Invalid custom profile: {e}",
            )
    else:
        profile_key = override_profile if override_profile and override_profile in PROFILES else ai_proposal.predicted_category
        profile = PROFILES.get(profile_key, DEFAULT_PROFILE)

    # Deterministic contract evaluation
    checks, verdict, summary = evaluate_conformance(features, profile, asset_size_bytes=len(file_bytes))

    duration_ms = (time.perf_counter() - start_time) * 1000.0

    return EvaluationResult(
        asset_sha256=asset_sha256,
        asset_name=file.filename or "model.glb",
        asset_size_bytes=len(file_bytes),
        features=features,
        ai_proposal=ai_proposal,
        applied_profile=profile,
        checks=checks,
        verdict=verdict,
        verdict_summary=summary,
        evaluation_duration_ms=round(duration_ms, 2),
        timestamp_utc=datetime.now(timezone.utc).isoformat(),
    )
