import { fetchSemanticSchema } from '../utils';
import { DataFactory } from '../../../vkg/rdf';

describe('fetchSemanticSchema', () => {
  const mockClient: any = {
    match: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch and parse schema metadata correctly', async () => {
    const targetType = 'https://schema.org/Person';

    // Mock properties matching the domain
    mockClient.match.mockImplementation((s: any, p: any, o: any, g: any) => {
      if (p?.value === 'https://schema.org/domainIncludes' && o?.value === targetType) {
        return [
          DataFactory.quad(
            DataFactory.namedNode('https://schema.org/name'),
            DataFactory.namedNode(p.value),
            DataFactory.namedNode(o.value)
          ),
          DataFactory.quad(
            DataFactory.namedNode('https://schema.org/age'),
            DataFactory.namedNode(p.value),
            DataFactory.namedNode(o.value)
          ),
        ];
      }

      // Labels
      if (p?.value === 'http://www.w3.org/2000/01/rdf-schema#label') {
        if (s?.value === 'https://schema.org/name') {
          return [DataFactory.quad(s, p, DataFactory.literal('Full Name'))];
        }
        if (s?.value === 'https://schema.org/age') {
          return [DataFactory.quad(s, p, DataFactory.literal('Age'))];
        }
      }

      // Ranges
      if (p?.value === 'https://schema.org/rangeIncludes') {
        if (s?.value === 'https://schema.org/name') {
          return [
            DataFactory.quad(
              s,
              p,
              DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#string')
            ),
          ];
        }
        if (s?.value === 'https://schema.org/age') {
          return [
            DataFactory.quad(
              s,
              p,
              DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')
            ),
          ];
        }
      }

      // Required
      if (p?.value === 'http://pcp.framework/form#required') {
        if (s?.value === 'https://schema.org/name') {
          return [DataFactory.quad(s, p, DataFactory.literal('true'))];
        }
      }

      // Order
      if (p?.value === 'http://pcp.framework/form#order') {
        if (s?.value === 'https://schema.org/name') {
          return [DataFactory.quad(s, p, DataFactory.literal('1'))];
        }
        if (s?.value === 'https://schema.org/age') {
          return [DataFactory.quad(s, p, DataFactory.literal('2'))];
        }
      }

      return [];
    });

    const schema = await fetchSemanticSchema(mockClient, targetType);

    expect(schema.targetType).toBe(targetType);
    expect(schema.fields).toHaveLength(2);

    expect(schema.fields[0].predicate).toBe('https://schema.org/name');
    expect(schema.fields[0].label).toBe('Full Name');
    expect(schema.fields[0].required).toBe(true);
    expect(schema.fields[0].range).toBe('http://www.w3.org/2001/XMLSchema#string');

    expect(schema.fields[1].predicate).toBe('https://schema.org/age');
    expect(schema.fields[1].label).toBe('Age');
    expect(schema.fields[1].required).toBe(false);
    expect(schema.fields[1].range).toBe('http://www.w3.org/2001/XMLSchema#integer');
  });

  it('should fallback to default values when metadata is missing', async () => {
    const targetType = 'https://schema.org/Thing';

    mockClient.match.mockImplementation((s: any, p: any, o: any, g: any) => {
      if (p?.value === 'https://schema.org/domainIncludes' && o?.value === targetType) {
        return [
          DataFactory.quad(
            DataFactory.namedNode('https://schema.org/unknownProp'),
            DataFactory.namedNode(p.value),
            DataFactory.namedNode(o.value)
          ),
        ];
      }
      return [];
    });

    const schema = await fetchSemanticSchema(mockClient, targetType);

    expect(schema.fields[0].label).toBe('unknownProp');
    expect(schema.fields[0].range).toBe('http://www.w3.org/2001/XMLSchema#string');
    expect(schema.fields[0].required).toBe(false);
  });
});
