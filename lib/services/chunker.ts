export function chunkText(
  text: string,
  chunkSize = 1200,
  overlap = 200
): string[] {
  if (chunkSize <= 0) {
    throw new Error("chunkSize must be greater than 0");
  }
  if (overlap < 0 || overlap >= chunkSize) {
    // overlap >= chunkSize would never advance the window (infinite loop)
    throw new Error("overlap must be >= 0 and smaller than chunkSize");
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);

    chunks.push(text.slice(start, end));

    // Reached the end of the text: stop here. Without this, the loop adds one
    // more chunk made only of text already covered by the previous overlap.
    if (end === text.length) break;

    start += chunkSize - overlap;
  }

  return chunks;
}
