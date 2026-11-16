import { RdfQueryBuilder } from '../../vkg/query';
import { IVKGClient } from '../../vkg/client';
import { DataFactory } from '../../vkg/rdf';
import { SemanticFormSchema, FormFieldMetadata } from './types';

export const fetchSemanticSchema = async (
  client: IVKGClient,
  targetType: string
): Promise<SemanticFormSchema> => {
  const builder = new RdfQueryBuilder(client);

  // 1. Find all properties that have this type in their domain
  // We check both schema:domainIncludes and rdfs:domain
  const domainIncludes = 'https://schema.org/domainIncludes';
  const rdfsDomain = 'http://www.w3.org/2000/01/rdf-schema#domain';

  const propertiesQuads = [
    ...(await builder.predicate(domainIncludes).object(targetType).execute()),
    ...(await builder.predicate(rdfsDomain).object(targetType).execute()),
  ];

  const propertyURIs = Array.from(new Set(propertiesQuads.map((q) => q.subject.value)));

  const fields: FormFieldMetadata[] = [];

  for (const propURI of propertyURIs) {
    const propSubject = DataFactory.namedNode(propURI);

    // Fetch labels
    const labels = await new RdfQueryBuilder(client)
      .subject(propSubject)
      .predicate('http://www.w3.org/2000/01/rdf-schema#label')
      .execute();
    const label = labels[0]?.object.value || propURI.split(/[/|#]/).pop() || propURI;

    // Fetch comments/descriptions
    const comments = await new RdfQueryBuilder(client)
      .subject(propSubject)
      .predicate('http://www.w3.org/2000/01/rdf-schema#comment')
      .execute();
    const description = comments[0]?.object.value;

    // Fetch range/type
    const ranges = [
      ...(await new RdfQueryBuilder(client)
        .subject(propSubject)
        .predicate('https://schema.org/rangeIncludes')
        .execute()),
      ...(await new RdfQueryBuilder(client)
        .subject(propSubject)
        .predicate('http://www.w3.org/2000/01/rdf-schema#range')
        .execute()),
    ];
    const range = ranges[0]?.object.value || 'http://www.w3.org/2001/XMLSchema#string';

    // Fetch required status (custom predicate for this framework)
    const requiredQuads = await new RdfQueryBuilder(client)
      .subject(propSubject)
      .predicate('http://pcp.framework/form#required')
      .execute();
    const required = requiredQuads[0]?.object.value === 'true';

    // Fetch order
    const orderQuads = await new RdfQueryBuilder(client)
      .subject(propSubject)
      .predicate('http://pcp.framework/form#order')
      .execute();
    const order = orderQuads[0] ? parseInt(orderQuads[0].object.value, 10) : undefined;

    fields.push({
      predicate: propURI,
      label,
      description,
      range,
      required,
      order,
    });
  }

  // Sort fields by order or label
  fields.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    return a.label.localeCompare(b.label);
  });

  return {
    targetType,
    fields,
  };
};
