export function invertKeysAndValues(data: any) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [value, key]));
}

// Get the subset of the object from key list
export function pick<K extends string | number, V = any>(obj: Record<K, V>, keys: K[]) {
  const ret: Partial<Record<K, V>> = {};
  for (const key of keys) {
    ret[key] = obj[key];
  }
  return ret as Record<K, V>;
}

// Remove a particular key from an object if it exists
export function omit<K extends string | number, V = any>(obj: Record<K, V>, key: K) {
  const ret: Partial<Record<K, V>> = {};
  for (const k of Object.keys(obj)) {
    if (k === key) continue;
    ret[k] = obj[k];
  }
  return ret as Record<K, V>;
}

// Returns an object with the keys as values from an array and value set to true
export function arrayToObject(keys: Array<string | number>, val = true) {
  return keys.reduce((result, k) => {
    result[k] = val;
    return result;
  }, {});
}
