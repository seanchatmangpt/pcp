/**
 * Represents a remote module configuration.
 */
export interface FederatedModuleConfig {
  /** The unique name of the remote container. */
  name: string;
  /** The URL of the remote bundle. */
  url: string;
  /** The scope/namespace for the remote. */
  scope: string;
  /** The specific module to load from the remote. */
  module: string;
}

/**
 * Status of the federated module loading process.
 */
export type FederatedLoadingStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Options for loading a federated component.
 */
export interface FederatedComponentProps extends FederatedModuleConfig {
  /** Fallback component to show while loading. */
  fallback?: React.ReactNode;
  /** Error component to show if loading fails. */
  errorComponent?: React.ReactNode | ((error: Error) => React.ReactNode);
  /** Additional props to pass to the federated component. */
  props?: Record<string, any>;
}
