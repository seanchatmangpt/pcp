/**
 * @fileoverview VKG Event Schema Conversion, Telemetry Mapping, and Dispatch.
 * Provides functions to translate telemetry events into Schema.org Event JSON-LD representation,
 * map attributes to the Virtual Knowledge Graph (VKG), and dispatch them for synchronization.
 */

import { VirtualKnowledgeGraphClient } from './client';
import { Event as SchemaOrgEvent } from '../../types/semantic/Event';
import { DataFactory } from './rdf';

/**
 * Standard Telemetry Event interface representing raw tracking evidence.
 */
export interface TelemetryEvent {
  timestamp?: string;
  type: string;
  payload?: Record<string, any>;
}

/**
 * Converts a raw TelemetryEvent into a standard Schema.org Event JSON-LD document.
 * Leverages Truex architectural terminology mappings.
 */
export function telemetryToSchemaOrgEvent(telemetry: TelemetryEvent): SchemaOrgEvent {
  if (!telemetry || !telemetry.type) {
    throw new Error('Invalid telemetry event: type is required');
  }

  const timestamp = telemetry.timestamp || new Date().toISOString();
  
  // Apply terminology transformations on event names/types
  const typeLower = telemetry.type.toLowerCase();
  let mappedName = telemetry.type;
  if (typeLower.includes('screen') || typeLower.includes('user interface') || typeLower.includes('projection') || typeLower.includes('uistate') || typeLower.includes('ui state')) {
    mappedName = 'Avatar-Relative Projection Event';
  } else if (typeLower.includes('api call') || typeLower.includes('api_call') || typeLower.includes('propagation') || typeLower.includes('trigger')) {
    mappedName = 'Propagation Trigger Event';
  } else if (typeLower.includes('offline queue') || typeLower.includes('offline cache') || typeLower.includes('tension') || typeLower.includes('queue') || typeLower.includes('cache')) {
    mappedName = 'Pre-Admission Tension Queue Event';
  } else if (typeLower.includes('dashboard') || typeLower.includes('supervision')) {
    mappedName = 'Consequence Supervision Event';
  } else if (typeLower.includes('form submit') || typeLower.includes('form_submit') || typeLower.includes('intake')) {
    mappedName = 'Operational Intake Event';
  } else if (typeLower.includes('webhook') || typeLower.includes('api response') || typeLower.includes('api_response') || typeLower.includes('settlement')) {
    mappedName = 'Settlement Adjudication Event';
  } else if (typeLower.includes('admin panel') || typeLower.includes('admin_panel') || typeLower.includes('supervision geometry')) {
    mappedName = 'Supervision Geometry Event';
  }

  // Create a unique URI/IRI for this event
  const uniqueId = `urn:event:${telemetry.type.toLowerCase().replace(/[^a-z0-9]/g, '-')}:${Math.random().toString(36).substring(2, 11)}`;

  // Convert payload properties with rebrands
  const mappedPayload: Record<string, any> = {};
  if (telemetry.payload) {
    for (const [key, value] of Object.entries(telemetry.payload)) {
      let mappedKey = key;
      // Terminology rebrand mappings for telemetry fields
      if (key === 'screen' || key === 'uiState' || key === 'userInterface' || key === 'projection') {
        mappedKey = 'avatarRelativeProjection';
      } else if (key === 'apiCall' || key === 'trigger' || key === 'propagationTrigger') {
        mappedKey = 'propagationTrigger';
      } else if (key === 'offlineQueue' || key === 'queue' || key === 'offlineCache' || key === 'cache') {
        mappedKey = 'preAdmissionTensionQueue';
      } else if (key === 'dashboard' || key === 'supervisionView') {
        mappedKey = 'consequenceSupervision';
      } else if (key === 'formSubmit' || key === 'submit' || key === 'intake') {
        mappedKey = 'operationalIntake';
      } else if (key === 'webhook' || key === 'apiResponse' || key === 'response' || key === 'settlement') {
        mappedKey = 'settlementAdjudication';
      } else if (key === 'adminPanel' || key === 'admin' || key === 'supervisionGeometry') {
        mappedKey = 'supervisionGeometry';
      }

      mappedPayload[mappedKey] = value;
    }
  }

  return {
    '@id': uniqueId,
    '@type': 'https://schema.org/Event',
    name: mappedName,
    startDate: timestamp,
    description: `VKG Telemetry Event: ${telemetry.type}`,
    ...mappedPayload,
  };
}

/**
 * Dispatches a Schema.org Event to the Virtual Knowledge Graph.
 * Converts the Event JSON-LD to RDF Quads, saves them locally,
 * and queues them for synchronization to the authoritative Supabase Edge.
 */
export async function dispatchVkgEvent(
  client: VirtualKnowledgeGraphClient,
  event: SchemaOrgEvent
): Promise<void> {
  const quadsList = client.jsonLdToQuads(event);
  await client.addQuads(quadsList);
}

/**
 * VkgEventDispatcher orchestrates telemetry-to-VKG mapping and dispatching.
 */
export class VkgEventDispatcher {
  private client: VirtualKnowledgeGraphClient;
  private dispatchedCount = 0;

  constructor(client?: VirtualKnowledgeGraphClient) {
    this.client = client ?? new VirtualKnowledgeGraphClient();
  }

  /**
   * Translates a raw telemetry event to Schema.org Event, converts to RDF Quads,
   * writes locally, and queues synchronization.
   */
  public async dispatchTelemetry(telemetry: TelemetryEvent): Promise<SchemaOrgEvent> {
    const vkgEvent = telemetryToSchemaOrgEvent(telemetry);
    await dispatchVkgEvent(this.client, vkgEvent);
    this.dispatchedCount++;
    return vkgEvent;
  }

  public getDispatchedCount(): number {
    return this.dispatchedCount;
  }
}
