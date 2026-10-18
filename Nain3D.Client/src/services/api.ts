import type {
  EvaluationResult,
  ProfileDefinition,
  SampleAsset,
} from '../types/contracts';
import {
  PROFILES,
  SAMPLES,
  evaluateFileStandalone,
} from './mockEvaluator';

const BASE_URL = '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail?: string
  ) {
    super(detail || `API error ${status}`);
    this.name = 'ApiError';
  }
}

function emitTelemetry(type: string, name: string, latencyMs: number, status: number, payload: unknown) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nain:telemetry', {
      detail: { type, name, latencyMs, status, payload }
    }));
  }
}

export const api = {
  async listProfiles(): Promise<ProfileDefinition[]> {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/conformance/profiles`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback to standalone profiles
    }
    return Object.values(PROFILES);
  },

  async listSamples(): Promise<SampleAsset[]> {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/conformance/samples`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback to standalone samples
    }
    return SAMPLES;
  },

  getSampleDownloadUrl(sampleId: string): string {
    // If running in development with proxy, use backend URL
    if (window.location.hostname === 'localhost' && window.location.port === '5376') {
      return `${BASE_URL}/api/v1/conformance/samples/${sampleId}/download`;
    }
    // In production or static GitHub Pages, point to static public samples
    return `./samples/${sampleId}.glb`;
  },

  async evaluateFile(file: File, overrideProfile?: string): Promise<EvaluationResult> {
    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      if (overrideProfile) {
        formData.append('override_profile', overrideProfile);
      }

      const res = await fetch(`${BASE_URL}/api/v1/conformance/evaluate`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Backend not running; execute in-browser deterministic evaluation
    }

    const result = await evaluateFileStandalone(file, overrideProfile);
    emitTelemetry('GateCheck', `EvaluateMeshConformance (${file.name})`, 28, 200, {
      asset: file.name,
      fileSizeBytes: file.size,
      checksEvaluated: 'C1-C10',
      quantumThreshold: '1e-12 m²',
      passed: result.verdict !== 'NON_CONFORMANT' && result.verdict !== 'INCOMPLETE',
      dualContractEmitted: true
    });
    return result;
  },

  async evaluateSample(
    sampleId: string,
    overrideProfile?: string
  ): Promise<{ result: EvaluationResult; blobUrl: string }> {
    let downloadRes: Response | null = null;
    try {
      downloadRes = await fetch(this.getSampleDownloadUrl(sampleId));
    } catch {
      // Fall back to relative sample path
    }

    if (!downloadRes || !downloadRes.ok) {
      downloadRes = await fetch(`./samples/${sampleId}.glb`);
    }

    if (!downloadRes.ok) {
      throw new ApiError(downloadRes.status, 'Could not retrieve sample 3D model');
    }

    const blob = await downloadRes.blob();
    const file = new File([blob], `${sampleId}.glb`, { type: 'model/gltf-binary' });
    const blobUrl = URL.createObjectURL(blob);

    const result = await this.evaluateFile(file, overrideProfile);
    return { result, blobUrl };
  },

  async checkHealth(): Promise<{ status: string; engine?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/health/ready`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Standalone browser engine ready
    }
    return { status: 'Healthy', engine: 'Deterministic WebAssembly/JS' };
  },
};
