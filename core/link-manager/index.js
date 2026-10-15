/**
 * Contract-based organ linker. Organs never import one another's private files;
 * every edge must be declared in the source manifest and target a public API.
 */
const MAX_LINKS_PER_ORGAN = 20;

export function createLinkManager(registry) {
  if (!registry || typeof registry.get !== "function" || typeof registry.resolve !== "function") {
    throw new TypeError("A validated organ registry is required.");
  }
  const links = new Map();
  function sourceLinks(sourceId) {
    if (!links.has(sourceId)) links.set(sourceId, []);
    return links.get(sourceId);
  }
  return Object.freeze({
    connect(sourceId, targetId, api) {
      const source = registry.get(sourceId);
      if (!source) throw new Error(`Unknown source organ: ${sourceId}`);
      const declared = source.dependencies ?? [];
      if (!declared.some((item) => item.organ_id === targetId && item.api === api)) {
        throw new Error(`Undeclared link: ${sourceId} -> ${targetId}:${api}`);
      }
      const endpoint = registry.resolve(targetId, api);
      const current = sourceLinks(sourceId);
      const existing = current.find((item) => item.target.organ_id === targetId && item.target.api === api);
      if (existing) return existing;
      if (current.length >= MAX_LINKS_PER_ORGAN) {
        throw new RangeError(`${sourceId} exceeds the ${MAX_LINKS_PER_ORGAN}-link-per-organ limit.`);
      }
      const link = Object.freeze({ source_id: sourceId, target: endpoint });
      current.push(link);
      return link;
    },
    list(sourceId) {
      if (sourceId !== undefined) return [...sourceLinks(sourceId)];
      return [...links.values()].flatMap((items) => [...items]);
    },
    disconnect(sourceId, targetId, api) {
      const current = sourceLinks(sourceId);
      const index = current.findIndex((item) => item.target.organ_id === targetId && item.target.api === api);
      if (index < 0) return false;
      current.splice(index, 1);
      return true;
    },
  });
}
