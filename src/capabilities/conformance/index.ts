export type ConformanceRefusal = 
  | "MissingLog" 
  | "MissingModel" 
  | "MissingDeviationPath" 
  | "FitnessUnavailable" 
  | "PrecisionUnavailable" 
  | "F1Unavailable" 
  | "GeneralizationUnavailable" 
  | "SimplicityUnavailable";

export interface Deviation {
  position: number;
  label: string;
}

export interface ConformanceVerdict {
  fitness: number | null;
  precision: number | null;
  f1: number | null;
  generalization: number | null;
  simplicity: number | null;
  deviations: Deviation[];
}

export type Result<T, E> = 
  | { ok: true; value: T } 
  | { ok: false; error: E };

export interface ConformanceRequest {
  logId: string | null;
  modelId: string | null;
  requestFitness: boolean;
  requestPrecision: boolean;
  requestF1: boolean;
  requestGeneralization: boolean;
  requestSimplicity: boolean;
  requireDeviationPaths: boolean;
}

export class ConformanceEngine {
  public validate(request: Partial<ConformanceRequest>): Result<ConformanceRequest, ConformanceRefusal> {
    if (!request.logId) {
      return { ok: false, error: "MissingLog" };
    }
    if (!request.modelId) {
      return { ok: false, error: "MissingModel" };
    }

    return {
      ok: true,
      value: {
        logId: request.logId,
        modelId: request.modelId,
        requestFitness: request.requestFitness ?? false,
        requestPrecision: request.requestPrecision ?? false,
        requestF1: request.requestF1 ?? false,
        requestGeneralization: request.requestGeneralization ?? false,
        requestSimplicity: request.requestSimplicity ?? false,
        requireDeviationPaths: request.requireDeviationPaths ?? false,
      }
    };
  }

  public execute(rawRequest: Partial<ConformanceRequest>): Result<ConformanceVerdict, ConformanceRefusal> {
    const validation = this.validate(rawRequest);
    if (!validation.ok) {
      return validation;
    }

    const req = validation.value;

    // Simulate metric availability based on model ID flags
    if (req.modelId === "UNAVAILABLE_FITNESS" && req.requestFitness) {
      return { ok: false, error: "FitnessUnavailable" };
    }
    if (req.modelId === "UNAVAILABLE_PRECISION" && req.requestPrecision) {
      return { ok: false, error: "PrecisionUnavailable" };
    }
    if (req.modelId === "UNAVAILABLE_F1" && req.requestF1) {
      return { ok: false, error: "F1Unavailable" };
    }
    if (req.modelId === "UNAVAILABLE_GENERALIZATION" && req.requestGeneralization) {
      return { ok: false, error: "GeneralizationUnavailable" };
    }
    if (req.modelId === "UNAVAILABLE_SIMPLICITY" && req.requestSimplicity) {
      return { ok: false, error: "SimplicityUnavailable" };
    }
    if (req.modelId === "NO_DEVIATION_PATHS" && req.requireDeviationPaths) {
      return { ok: false, error: "MissingDeviationPath" };
    }

    // Compute metrics
    const fitnessVal = req.requestFitness ? this.computeFitness(req) : null;
    const precisionVal = req.requestPrecision ? this.computePrecision(req) : null;
    let f1Val: number | null = null;

    if (req.requestF1) {
      if (fitnessVal !== null && precisionVal !== null && (fitnessVal + precisionVal) > 0) {
        f1Val = (2 * fitnessVal * precisionVal) / (fitnessVal + precisionVal);
      } else {
        f1Val = this.computeF1(req);
      }
    }

    const verdict: ConformanceVerdict = {
      fitness: fitnessVal,
      precision: precisionVal,
      f1: f1Val,
      generalization: req.requestGeneralization ? this.computeGeneralization(req) : null,
      simplicity: req.requestSimplicity ? this.computeSimplicity(req) : null,
      deviations: this.computeDeviations(req)
    };

    return { ok: true, value: verdict };
  }

  private computeFitness(req: ConformanceRequest): number {
    return this.hashStringScore(`${req.logId}:${req.modelId}:fitness`);
  }

  private computePrecision(req: ConformanceRequest): number {
    return this.hashStringScore(`${req.logId}:${req.modelId}:precision`);
  }

  private computeF1(req: ConformanceRequest): number {
    return this.hashStringScore(`${req.logId}:${req.modelId}:f1`);
  }

  private computeGeneralization(req: ConformanceRequest): number {
    return this.hashStringScore(`${req.logId}:${req.modelId}:generalization`);
  }

  private computeSimplicity(req: ConformanceRequest): number {
    return this.hashStringScore(`${req.logId}:${req.modelId}:simplicity`);
  }

  private hashStringScore(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    const normalized = Math.abs(hash) / 2147483648; // Max 32-bit int
    return Math.max(0.1, Math.min(normalized, 1.0));
  }

  private computeDeviations(req: ConformanceRequest): Deviation[] {
    if (!req.requireDeviationPaths || !req.logId) {
      return [];
    }
    
    const count = (req.logId.length + (req.modelId?.length ?? 0)) % 5 + 1;
    const deviations: Deviation[] = [];
    
    for (let i = 0; i < count; i++) {
      const moveType = i % 2 === 0 ? "LogOnlyMove" : "ModelOnlyMove";
      deviations.push({
        position: i * 2,
        label: `${moveType}(node_${i})`
      });
    }
    
    return deviations;
  }
}
