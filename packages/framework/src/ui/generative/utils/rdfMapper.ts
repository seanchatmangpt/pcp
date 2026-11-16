import { GenerativeSchema, SemanticField } from '../types';

/**
 * Maps a simplified RDF schema (using common vocabularies like FOAF or Schema.org)
 * to a GenerativeSchema.
 */
export const fromRDF = (rdfSchema: Record<string, any>): GenerativeSchema => {
  const fields: SemanticField[] = Object.entries(rdfSchema).map(([key, value]) => {
    const type = mapRDFTypeToFieldType(value['@type'] || value.type);

    return {
      key,
      label: value.label || value['rdfs:label'] || key,
      type,
      format: value.format,
      description: value.comment || value['rdfs:comment'],
      semanticType: value['@type'] || value.type,
    };
  });

  return {
    title: rdfSchema.title || rdfSchema['rdfs:label'] || 'Semantic Entity',
    fields,
  };
};

const mapRDFTypeToFieldType = (rdfType?: string): SemanticField['type'] => {
  if (!rdfType) return 'string';

  const typeMap: Record<string, SemanticField['type']> = {
    'http://www.w3.org/2001/XMLSchema#string': 'string',
    'http://www.w3.org/2001/XMLSchema#integer': 'number',
    'http://www.w3.org/2001/XMLSchema#boolean': 'boolean',
    'http://www.w3.org/2001/XMLSchema#anyURI': 'uri',
    'http://xmlns.com/foaf/0.1/Image': 'string', // format will handle it
    'schema:Text': 'string',
    'schema:Number': 'number',
    'schema:Boolean': 'boolean',
    'schema:URL': 'uri',
  };

  return typeMap[rdfType] || 'string';
};
