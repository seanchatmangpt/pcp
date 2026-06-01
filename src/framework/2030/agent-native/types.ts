import { ZkProof } from '../../auth/zkp/types';
import { AdmissibilityVerdict } from '../../membrane/types';
import { LogGenerator } from './process-mining';

/**
 * Represents a semantic command sent by an AI agent.
 */
export interface SemanticCommand {
  /**
   * The unique identifier for this command.
   */
  id: string;

  /**
   * The name of the action to be performed (e.g., 'update_profile', 'send_message').
   */
  action: string;

  /**
   * The parameters associated with the action.
   */
  params: Record<string, any>;

  /**
   * Cryptographic proof that the agent is authorized to dispatch this command.
   */
  zkp: ZkProof;

  /**
   * Optional metadata about the agent sending the command.
   */
  agentMetadata?: {
    id: string;
    model: string;
    capabilities: string[];
  };
}

/**
 * Result of an agent's semantic command execution.
 */
export interface AgentExecutionResult<T = any> {
  success: boolean;
  commandId: string;
  result: T | null;
  verdict: AdmissibilityVerdict;
  receiptId: string;
  error?: string;
}

/**
 * Configuration for the Agent-Native Interface.
 */
export interface AgentNativeConfig {
  /**
   * Whether to enforce ZKP verification for all commands.
   */
  enforceZkp: boolean;

  /**
   * The membrane instance used to govern command execution.
   */
  membraneId: string;

  /**
   * Optional log generator to emit OCEL 2.0 log events to.
   */
  logGenerator?: LogGenerator;
}

/**
 * Interface for inspecting application state.
 */
export interface StateInspectionRequest {
  /**
   * The JSON path or key to inspect in the application state.
   */
  path: string;

  /**
   * ZKP proof for authorization to read this state.
   */
  zkp: ZkProof;
}
