/**
 * Hyper-Dimensional Vector Database Abstraction
 * Projects JSON state into high-dimensional vectors for semantic similarity retrieval.
 */

export class HyperDB {
  private dimensions: number;
  private vectors: Map<string, Float64Array> = new Map();
  private data: Map<string, any> = new Map();
  private projectionMatrix: Float64Array[];

  /**
   * Initializes the HyperDB with a specific dimensionality.
   * @param dimensions Target dimensionality (e.g., 10000)
   * @param seed Random seed for reproducible projection
   */
  constructor(dimensions: number = 10000, seed: number = 42) {
    this.dimensions = dimensions;
    this.projectionMatrix = this.generateProjectionMatrix(seed);
  }

  // Deterministic pseudo-random number generator (LCG)
  private random(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // Generate a random projection matrix (Gaussian distribution approximation)
  private generateProjectionMatrix(seed: number): Float64Array[] {
    const rng = this.random(seed);
    const matrix: Float64Array[] = [];
    const inputDim = 256; // Character set limit for simple string encoding

    for (let i = 0; i < inputDim; i++) {
      const row = new Float64Array(this.dimensions);
      for (let j = 0; j < this.dimensions; j++) {
        // Box-Muller transform for normal distribution
        let u1 = rng() || 1e-7; // Prevent log(0)
        let u2 = rng();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        row[j] = z0;
      }
      matrix.push(row);
    }
    return matrix;
  }

  // Projects JSON state to a normalized vector
  private projectToVector(json: any): Float64Array {
    const vector = new Float64Array(this.dimensions);
    const jsonString = JSON.stringify(json);

    if (!jsonString) return vector;

    // Map characters through the projection matrix
    for (let i = 0; i < jsonString.length; i++) {
      const charCode = jsonString.charCodeAt(i) % 256;
      const row = this.projectionMatrix[charCode];

      // Add positional encoding to capture structure
      const positionalWeight = Math.sin(((i + 1) / jsonString.length) * Math.PI);

      for (let j = 0; j < this.dimensions; j++) {
        vector[j] += row[j] * positionalWeight;
      }
    }

    // L2 Normalization
    let sumSquares = 0;
    for (let i = 0; i < this.dimensions; i++) {
      sumSquares += vector[i] * vector[i];
    }

    const magnitude = Math.sqrt(sumSquares) || 1;
    for (let i = 0; i < this.dimensions; i++) {
      vector[i] /= magnitude;
    }

    return vector;
  }

  /**
   * Inserts or updates state in the database.
   * @param id Unique identifier
   * @param state Any JSON-serializable state
   */
  public insert(id: string, state: any): void {
    const vector = this.projectToVector(state);
    this.vectors.set(id, vector);
    this.data.set(id, state);
  }

  /**
   * Alias for insert to update state.
   */
  public update(id: string, state: any): void {
    this.insert(id, state);
  }

  /**
   * Retrieves state by ID.
   */
  public get(id: string): any | undefined {
    return this.data.get(id);
  }

  /**
   * Deletes state by ID.
   */
  public delete(id: string): void {
    this.vectors.delete(id);
    this.data.delete(id);
  }

  /**
   * Computes cosine similarity between two L2-normalized vectors.
   */
  private cosineSimilarity(vecA: Float64Array, vecB: Float64Array): number {
    let dotProduct = 0;
    for (let i = 0; i < this.dimensions; i++) {
      dotProduct += vecA[i] * vecB[i];
    }
    return dotProduct;
  }

  /**
   * Searches for similar states using hyper-dimensional vectors.
   * @param queryState The state to query
   * @param topK Number of results to return
   * @returns Array of matching items with similarity scores
   */
  public search(
    queryState: any,
    topK: number = 5
  ): Array<{ id: string; state: any; score: number }> {
    const queryVector = this.projectToVector(queryState);
    const results: Array<{ id: string; state: any; score: number }> = [];

    for (const [id, vector] of this.vectors.entries()) {
      const score = this.cosineSimilarity(queryVector, vector);
      results.push({ id, state: this.data.get(id), score });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}
