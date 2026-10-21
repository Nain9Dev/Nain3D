from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field


class CheckSeverity(str, Enum):
    BLOCKING = "blocking"
    ADVISORY = "advisory"


class ConformanceVerdict(str, Enum):
    CONFORMANT = "CONFORMANT"
    CONFORMANT_WITH_FINDINGS = "CONFORMANT_WITH_FINDINGS"
    NON_CONFORMANT = "NON_CONFORMANT"
    INCOMPLETE = "INCOMPLETE"


class GeometricFeatures(BaseModel):
    model_config = ConfigDict(frozen=True)

    triangle_count: int = Field(ge=0, description="Total face/polygon count")
    vertex_count: int = Field(ge=0, description="Total unique vertex count")
    is_watertight: bool = Field(description="Whether the mesh represents a closed solid volume")
    extents: list[float] = Field(description="Bounding box dimensions [x, y, z] in meters")
    max_dimension_m: float = Field(ge=0, description="Maximum single dimension in meters")
    volume_m3: float = Field(ge=0, description="Approximated enclosed volume in cubic meters")
    degenerate_faces_count: int = Field(ge=0, default=0, description="Faces with near-zero area")
    # Inventory used by the optional store checks (additive: defaults keep the original payload valid).
    texture_max_side_px: Optional[int] = Field(
        default=0, ge=0, description="Largest texture side in pixels; 0 = no textures, null = could not be measured"
    )
    material_count: int = Field(default=0, ge=0, description="Distinct materials used by the meshes")
    textured_material_count: int = Field(default=0, ge=0, description="Used materials that have at least one texture")
    has_uv_coordinates: bool = Field(default=False, description="Every mesh primitive carries UV coordinates")
    inventory_readable: bool = Field(default=True, description="False when the file structure could not be read")


class CheckResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    label: str
    value: Any
    limit: Any
    passed: bool
    severity: CheckSeverity
    message: str


class AiProposal(BaseModel):
    model_config = ConfigDict(frozen=True)

    predicted_category: str
    confidence: float = Field(ge=0.0, le=1.0)
    source: str = Field(description="Classifier engine (e.g. RandomForest or Ollama)")
    reasoning: Optional[str] = None


class ProfileDefinition(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(max_length=300)
    max_triangles: int = Field(gt=0, le=100_000_000)
    max_dimension_m: float = Field(gt=0, le=100_000)
    is_watertight_required: bool
    max_degenerate_faces: int = Field(default=0, ge=0)
    # Optional store limits: a profile that leaves them out runs only the four original checks.
    max_file_mb: Optional[float] = Field(default=None, gt=0, le=1024)
    max_texture_px: Optional[int] = Field(default=None, ge=16, le=65_536)
    max_materials: Optional[int] = Field(default=None, ge=0, le=10_000)
    require_uv_and_textures: bool = False


class EvaluationResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    asset_sha256: str
    asset_name: str
    asset_size_bytes: int
    features: GeometricFeatures
    ai_proposal: AiProposal
    applied_profile: ProfileDefinition
    checks: list[CheckResult]
    verdict: ConformanceVerdict
    verdict_summary: str
    evaluation_duration_ms: float
    timestamp_utc: str
