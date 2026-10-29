import MemoryClient from 'mem0ai';

let client = null;

function getClient() {
  const apiKey = process.env.MEM0_API_KEY?.trim();
  if (!apiKey) return null;
  if (!client) client = new MemoryClient({ apiKey });
  return client;
}

function memoryText(result) {
  const entries = Array.isArray(result?.results) ? result.results : [];
  return entries
    .map((entry) => String(entry?.memory ?? '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * Retrieve durable preferences and relevant past decisions for a user. Mem0
 * is deliberately optional: a missing key or a service outage never blocks a
 * website build.
 */
export async function getBuildMemory({ userId, query }) {
  const mem0 = getClient();
  if (!mem0 || !userId || !query?.trim()) return [];

  try {
    const result = await mem0.search(query.slice(0, 2_000), {
      filters: { user_id: userId },
    });
    return memoryText(result);
  } catch (error) {
    console.warn(`[Mem0] Memory lookup skipped: ${error?.message ?? String(error)}`);
    return [];
  }
}

/** Store user requirements after a build has completed successfully. */
export async function rememberBuildRequest({ userId, projectId, request }) {
  const mem0 = getClient();
  if (!mem0 || !userId || !request?.trim()) return;

  try {
    await mem0.add(
      [{ role: 'user', content: request.slice(0, 4_000) }],
      {
        userId,
        metadata: { projectId, source: 'website-builder' },
      },
    );
  } catch (error) {
    console.warn(`[Mem0] Memory write skipped: ${error?.message ?? String(error)}`);
  }
}

export const isMemoryEnabled = () => Boolean(process.env.MEM0_API_KEY?.trim());
