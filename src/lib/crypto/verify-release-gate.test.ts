/// <reference types="node" />
import * as fs from 'fs';
import * as path from 'path';
import { verifyReleaseGate } from './verify-release-gate';

describe('verify-release-gate script', () => {
  const testManifestPath = path.resolve(process.cwd(), 'src/lib/crypto', 'test_proof_manifest.json');

  afterEach(() => {
    if (fs.existsSync(testManifestPath)) {
      fs.unlinkSync(testManifestPath);
    }
  });

  it('fails if the manifest file does not exist', () => {
    expect(() => {
      verifyReleaseGate(path.resolve(process.cwd(), 'src/lib/crypto', 'non_existent_manifest.json'));
    }).toThrow(/Proof manifest file not found/);
  });

  it('fails if the manifest is invalid JSON', () => {
    fs.writeFileSync(testManifestPath, '{ invalid json: [ }');
    expect(() => {
      verifyReleaseGate(testManifestPath);
    }).toThrow(/Failed to parse proof manifest JSON/);
  });

  it('passes if the manifest contains no mock or stub flags', () => {
    const validManifest = {
      pipelineName: "ProductionVerifierPipeline",
      timestamp: "2026-05-23T00:00:00Z",
      proofClosed: true,
      e2ePassed: true,
      verifierExecutionIds: ["id-1234", "id-5678"],
      details: {
        hashAlg: "SHA-256",
        signatureCount: 3
      }
    };
    fs.writeFileSync(testManifestPath, JSON.stringify(validManifest, null, 2));

    expect(() => {
      verifyReleaseGate(testManifestPath);
    }).not.toThrow();
  });

  it('throws an error if a forbidden exact value like VerifierPipelineSmoke is present', () => {
    const invalidManifest = {
      pipelineName: "VerifierPipelineSmoke",
      timestamp: "2026-05-23T00:00:00Z",
      proofClosed: true
    };
    fs.writeFileSync(testManifestPath, JSON.stringify(invalidManifest, null, 2));

    expect(() => {
      verifyReleaseGate(testManifestPath);
    }).toThrow(/Forbidden mock\/stub value "VerifierPipelineSmoke" found/);
  });

  it('throws an error if a key containing "mock" or "stub" is true or non-empty', () => {
    const invalidManifest = {
      pipelineName: "ProductionVerifierPipeline",
      timestamp: "2026-05-23T00:00:00Z",
      mockExecution: true,
      proofClosed: true
    };
    fs.writeFileSync(testManifestPath, JSON.stringify(invalidManifest, null, 2));

    expect(() => {
      verifyReleaseGate(testManifestPath);
    }).toThrow(/Forbidden boolean flag "mockExecution" is set to true/);
  });

  it('throws an error if nested objects/arrays contain forbidden strings', () => {
    const invalidManifest = {
      pipelineName: "ProductionVerifierPipeline",
      details: {
        components: [
          { name: "core", isMocked: true },
          { name: "auth", isMocked: false }
        ]
      }
    };
    fs.writeFileSync(testManifestPath, JSON.stringify(invalidManifest, null, 2));

    expect(() => {
      verifyReleaseGate(testManifestPath);
    }).toThrow(/Forbidden boolean flag "isMocked" is set to true/);
  });
});
