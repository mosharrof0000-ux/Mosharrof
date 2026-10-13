/**
 * Runtime organ registry. Generated manifest records are supplied at startup;
 * this module never imports organs directly or maintains a giant list.
 */
const MAX_LINKS_PER_ORGAN = 20;

function validateRecord(record) {
  if (!record || typeof record.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.id)) {
    throw new TypeError("Organ record requires a lowercase kebab-case id.");
  }
  if (!Array.isArray(record.public_api) || record.public_api.some((api) => typeof api !== "string" || !api.trim())) {
    throw new TypeError(`Organ "${record.id}" must declare public_api as non-empty strings.`);
  }
  if (new Set(record.public_api).size !== record.public_api.length) {
    throw new TypeError(`Organ "${record.id}" has duplicate public API names.`);
  }
  const dependencies = record.dependencies ?? [];
  if (!Array.isArray(dependencies) || dependencies.length > MAX_LINKS_PER_ORGAN) {
    throw new RangeError(`Organ "${record.id}" exceeds the ${MAX_LINKS_PER_ORGAN}-link dependency limit.`);
  }
  return { ...record, dependencies };
}

export function createOrganRegistry(records = []) {
  if (!Array.isArray(records)) throw new TypeError("Registry records must be an array.");
  const byId = new Map();
  for (const item of records) {
    const record = validateRecord(item);
    if (byId.has(record.id)) throw new Error(`Duplicate organ id: ${record.id}`);
    byId.set(record.id, Object.freeze(record));
  }
  for (const record of byId.values()) {
    for (const dependency of record.dependencies) {
      const target = byId.get(dependency.organ_id);
      if (!target) throw new Error(`${record.id} depends on unknown organ ${dependency.organ_id}`);
      if (!target.public_api.includes(dependency.api)) {
        throw new Error(`${dependency.organ_id} does not expose public API "${dependency.api}"`);
      }
    }
  }
  return Object.freeze({
    get(id) { return byId.get(id) ?? null; },
    list() { return [...byId.values()]; },
    resolve(id, api) {
      const record = byId.get(id);
      if (!record) throw new Error(`Unknown organ: ${id}`);
      if (!record.public_api.includes(api)) throw new Error(`Undeclared public API: ${id}:${api}`);
      return Object.freeze({ organ_id: id, api });
    },
    has(id) { return byId.has(id); },
  });
}
