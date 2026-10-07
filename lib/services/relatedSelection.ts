export interface ChunkMatch {
  document_id: string;
  similarity: number;
}

/**
 * Collapse chunk-level matches into the top related DOCUMENTS:
 * keep the best similarity per document, drop the document itself,
 * sort best-first and return at most `max` entries.
 */
export function selectTopRelated(
  matches: ChunkMatch[],
  selfDocumentId: string,
  max = 3
): [string, number][] {
  const bestByDocument = new Map<string, number>();

  for (const match of matches) {
    if (match.document_id === selfDocumentId) continue;

    const existing = bestByDocument.get(match.document_id);
    if (existing === undefined || match.similarity > existing) {
      bestByDocument.set(match.document_id, match.similarity);
    }
  }

  return [...bestByDocument.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max);
}
