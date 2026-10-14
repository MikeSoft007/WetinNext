/** Search/redirect pages are not institution or learning-source references. */
export function isDirectSource(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com)$/i.test(
        url.hostname,
      )
    );
  } catch {
    return false;
  }
}
