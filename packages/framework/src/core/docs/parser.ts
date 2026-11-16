import { DocMetadata, DocParam, DocExample } from './types';

export function parseJSDoc(jsDoc: string): Partial<DocMetadata> {
  const metadata: Partial<DocMetadata> = {
    params: [],
    examples: [],
  };

  // Remove comment markers
  const cleanDoc = jsDoc
    .replace(/\/\*\*|\*\/|\*/g, '')
    .split('\n')
    .map((line) => line.trim())
    .join('\n');

  // Extract @name
  const nameMatch = cleanDoc.match(/@name\s+(.+)/);
  if (nameMatch) metadata.name = nameMatch[1].trim();

  // Extract @description
  const descriptionMatch = cleanDoc.match(/@description\s+([\s\S]+?)(?=@|$)/);
  if (descriptionMatch) {
    metadata.description = descriptionMatch[1].trim();
  } else {
    // Fallback: use the first block of text before any @ tag as description
    const firstBlock = cleanDoc.split('@')[0].trim();
    if (firstBlock) metadata.description = firstBlock;
  }

  // Extract @type
  const typeMatch = cleanDoc.match(/@type\s+(hook|component|utility)/);
  if (typeMatch) metadata.type = typeMatch[1] as any;

  // Extract @param
  const paramRegex = /@param\s+\{(.+)\}\s+(\w+)\s+-\s+(.+)/g;
  let paramMatch;
  while ((paramMatch = paramRegex.exec(cleanDoc)) !== null) {
    metadata.params?.push({
      type: paramMatch[1].trim(),
      name: paramMatch[2].trim(),
      description: paramMatch[3].trim(),
    });
  }

  // Extract @returns
  const returnsMatch = cleanDoc.match(/@returns\s+\{(.+)\}\s+(.+)/);
  if (returnsMatch) {
    metadata.returns = {
      type: returnsMatch[1].trim(),
      description: returnsMatch[2].trim(),
    };
  }

  // Extract @example
  const exampleRegex = /@example\s+([\s\S]+?)(?=@|$)/g;
  let exampleMatch;
  while ((exampleMatch = exampleRegex.exec(cleanDoc)) !== null) {
    metadata.examples?.push({
      code: exampleMatch[1].trim(),
    });
  }

  // Extract @id
  const idMatch = cleanDoc.match(/@id\s+(.+)/);
  if (idMatch) metadata.id = idMatch[1].trim();

  return metadata;
}
