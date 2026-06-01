import { useState, useCallback, useRef } from 'react';

export type SensorData = {
  eegAlpha: number; // 8-12 Hz
  eegBeta: number; // 12-30 Hz
  eegGamma: number; // >30 Hz
  fnirsO2: number; // Oxygenation
  timestamp: number;
};

export type IntentCommand = 'NONE' | 'SCROLL_UP' | 'SCROLL_DOWN' | 'SELECT' | 'BACK';

export interface UseNeuralIntentConfig {
  alphaThreshold?: number;
  betaThreshold?: number;
  gammaThreshold?: number;
  fnirsThreshold?: number;
  smoothingWindow?: number;
  artifactThreshold?: number;
}

export function useNeuralIntent(config: UseNeuralIntentConfig = {}) {
  const {
    alphaThreshold = 0.6,
    betaThreshold = 0.7,
    gammaThreshold = 0.8,
    fnirsThreshold = 0.5,
    smoothingWindow = 5,
    artifactThreshold = 2.0, // Values above this are considered artifacts
  } = config;

  const [intent, setIntent] = useState<IntentCommand>('NONE');
  const buffer = useRef<SensorData[]>([]);

  const processSignal = useCallback(
    (data: SensorData) => {
      // Artifact Rejection
      if (
        data.eegAlpha > artifactThreshold ||
        data.eegBeta > artifactThreshold ||
        data.eegGamma > artifactThreshold
      ) {
        // Artifact detected, ignore this sample
        return;
      }

      buffer.current.push(data);
      if (buffer.current.length > smoothingWindow) {
        buffer.current.shift();
      }

      if (buffer.current.length < smoothingWindow) {
        return;
      }

      // Smoothing (Moving Average)
      let avgAlpha = 0;
      let avgBeta = 0;
      let avgGamma = 0;
      let avgFnirs = 0;

      for (const sample of buffer.current) {
        avgAlpha += sample.eegAlpha;
        avgBeta += sample.eegBeta;
        avgGamma += sample.eegGamma;
        avgFnirs += sample.fnirsO2;
      }

      avgAlpha /= smoothingWindow;
      avgBeta /= smoothingWindow;
      avgGamma /= smoothingWindow;
      avgFnirs /= smoothingWindow;

      // Translation to Semantic Navigation Commands
      let newIntent: IntentCommand = 'NONE';

      // High Gamma & fNIRS typically implies strong focus/selection
      if (avgGamma > gammaThreshold && avgFnirs > fnirsThreshold) {
        newIntent = 'SELECT';
      }
      // High Beta implies active thinking, mapped to scrolling down
      else if (avgBeta > betaThreshold) {
        newIntent = 'SCROLL_DOWN';
      }
      // High Alpha implies relaxation, mapped to scrolling up
      else if (avgAlpha > alphaThreshold) {
        newIntent = 'SCROLL_UP';
      }
      // Very low activation mapped to going back (disengagement)
      else if (avgAlpha < 0.2 && avgBeta < 0.2 && avgGamma < 0.2 && avgFnirs < 0.2) {
        newIntent = 'BACK';
      }

      setIntent(newIntent);
    },
    [
      alphaThreshold,
      betaThreshold,
      gammaThreshold,
      fnirsThreshold,
      smoothingWindow,
      artifactThreshold,
    ]
  );

  // Expose a way to inject simulated data
  const injectData = useCallback(
    (data: SensorData) => {
      processSignal(data);
    },
    [processSignal]
  );

  // Reset intent manually
  const resetIntent = useCallback(() => {
    setIntent('NONE');
    buffer.current = [];
  }, []);

  return {
    intent,
    injectData,
    resetIntent,
  };
}
