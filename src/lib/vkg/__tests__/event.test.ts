import { VirtualKnowledgeGraphClient } from '../client';
import { DataFactory } from '../rdf';
import { Event } from '../../../types/semantic/Event';
import {
  telemetryToSchemaOrgEvent,
  dispatchVkgEvent,
  VkgEventDispatcher,
} from '../event';

import { db } from '../../db/db';

// Mock Drizzle and Supabase
jest.mock('../../db/db', () => {
  const mockWhereSelectFn = jest.fn().mockImplementation(() => Promise.resolve([]));
  const mockFromFn = jest.fn().mockImplementation(() => {
    const promise = Promise.resolve([]);
    (promise as any).where = mockWhereSelectFn;
    return promise;
  });
  return {
    db: {
      insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue([]) }),
      select: jest.fn().mockReturnValue({ from: mockFromFn }),
      delete: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
      _mockWhereSelect: mockWhereSelectFn,
    },
  };
});

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null }),
      delete: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
    }),
  },
}));

describe('Schema.org Event Mapping', () => {
  let client: VirtualKnowledgeGraphClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new VirtualKnowledgeGraphClient();
  });

  it('successfully translates Event JSON-LD to RDF Quads and back', () => {
    const doc: Event = {
      '@id': 'urn:event:test-id',
      '@type': 'https://schema.org/Event',
      name: 'Test Event',
      description: 'Auto-generated test entity',
    };

    const quadsList = client.jsonLdToQuads(doc);
    
    // Assert type assertion is created
    const typeQuad = quadsList.find((q) => q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
    expect(typeQuad?.object.value).toBe('https://schema.org/Event');

    // Assert literal attributes are created
    const nameQuad = quadsList.find((q) => q.predicate.value === 'https://schema.org/name');
    expect(nameQuad?.object.value).toBe('Test Event');

    // Reconstruct
    const [reconstructed] = client.quadsToJsonLd(quadsList);
    expect(reconstructed['@id']).toBe(doc['@id']);
    expect(reconstructed['name']).toBe(doc['name']);
    expect(reconstructed['description']).toBe(doc['description']);
  });
});

describe('VKG Telemetry Mapping and Rebrand Translation', () => {
  it('correctly maps screen views to Avatar-Relative Projection', () => {
    const telemetry = {
      timestamp: '2026-05-30T21:00:00.000Z',
      type: 'screen_view_home',
      payload: {
        screen: 'HomeFeed',
      },
    };

    const event = telemetryToSchemaOrgEvent(telemetry);
    expect(event.name).toBe('Avatar-Relative Projection Event');
    expect(event.startDate).toBe(telemetry.timestamp);
    expect(event.avatarRelativeProjection).toBe('HomeFeed');
  });

  it('correctly maps API calls to Propagation Triggers', () => {
    const telemetry = {
      type: 'api_call_fetch_sermons',
      payload: {
        trigger: 'pull_to_refresh',
      },
    };

    const event = telemetryToSchemaOrgEvent(telemetry);
    expect(event.name).toBe('Propagation Trigger Event');
    expect(event.propagationTrigger).toBe('pull_to_refresh');
  });

  it('correctly maps legacy queue structures to Pre-Admission Tension Queue', () => {
    const telemetry = {
      type: 'offline_queue_sync',
      payload: {
        queue: 'sermons',
      },
    };

    const event = telemetryToSchemaOrgEvent(telemetry);
    expect(event.name).toBe('Pre-Admission Tension Queue Event');
    expect(event.preAdmissionTensionQueue).toBe('sermons');
  });

  it('correctly maps legacy supervision structures to Consequence Supervision', () => {
    const telemetry = {
      type: 'dashboard_render',
      payload: {
        dashboard: 'MainSupervision',
      },
    };

    const event = telemetryToSchemaOrgEvent(telemetry);
    expect(event.name).toBe('Consequence Supervision Event');
    expect(event.consequenceSupervision).toBe('MainSupervision');
  });

  it('correctly maps Form Submit/Intake to Operational Intake', () => {
    const telemetry = {
      type: 'form_submit_sermon',
      payload: {
        intake: 'new_sermon_data',
      },
    };

    const event = telemetryToSchemaOrgEvent(telemetry);
    expect(event.name).toBe('Operational Intake Event');
    expect(event.operationalIntake).toBe('new_sermon_data');
  });

  it('correctly maps Webhook/API Response/Settlement to Settlement Adjudication', () => {
    const telemetry = {
      type: 'api_response_settled',
      payload: {
        settlement: 'success_receipt',
      },
    };

    const event = telemetryToSchemaOrgEvent(telemetry);
    expect(event.name).toBe('Settlement Adjudication Event');
    expect(event.settlementAdjudication).toBe('success_receipt');
  });

  it('correctly maps Admin Panel/Supervision Geometry to Supervision Geometry', () => {
    const telemetry = {
      type: 'admin_panel_open',
      payload: {
        adminPanel: 'SupervisionConfig',
      },
    };

    const event = telemetryToSchemaOrgEvent(telemetry);
    expect(event.name).toBe('Supervision Geometry Event');
    expect(event.supervisionGeometry).toBe('SupervisionConfig');
  });

  it('throws on invalid telemetry input', () => {
    expect(() => telemetryToSchemaOrgEvent({} as any)).toThrow();
  });
});

describe('VKG Event Dispatch', () => {
  let client: VirtualKnowledgeGraphClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new VirtualKnowledgeGraphClient();
  });

  it('successfully converts and dispatches a telemetry event using VkgEventDispatcher', async () => {
    const addQuadsSpy = jest.spyOn(client, 'addQuads').mockResolvedValue(undefined);
    const dispatcher = new VkgEventDispatcher(client);

    const telemetry = {
      type: 'api_call_fetch',
      payload: {
        trigger: 'manual_refresh',
      },
    };

    const event = await dispatcher.dispatchTelemetry(telemetry);

    expect(event['@type']).toBe('https://schema.org/Event');
    expect(event.name).toBe('Propagation Trigger Event');
    expect(event.propagationTrigger).toBe('manual_refresh');
    expect(addQuadsSpy).toHaveBeenCalled();
    expect(dispatcher.getDispatchedCount()).toBe(1);
  });
});
