// Yes, I know this is a bad idea

export function patchMapPrototypeGetOrInsert() {
  if (!Map.prototype.getOrInsert) {
    Map.prototype.getOrInsert = function <K, V>(
      this: Map<K, V>,
      key: K,
      defaultValueFactory: () => V,
    ): V {
      if (this.has(key)) {
        return this.get(key)!;
      } else {
        const defaultValue = defaultValueFactory();
        this.set(key, defaultValue);
        return defaultValue;
      }
    };
  }
}

export function patchMapPrototypeGetOrInsertComputed() {
  if (!Map.prototype.getOrInsertComputed) {
    Map.prototype.getOrInsertComputed = function <K, V>(
      this: Map<K, V>,
      key: K,
      callback: (key: K) => V,
    ): V {
      if (this.has(key)) {
        return this.get(key)!;
      } else {
        const defaultValue = callback(key);
        this.set(key, defaultValue);
        return defaultValue;
      }
    };
  }
}

export function patchIteratorPrototypeToArray() {
  if (!Iterator.prototype.toArray) {
    Iterator.prototype.toArray = function (): any[] {
      const result = [];
      for (const item of this) {
        result.push(item);
      }
      return result;
    };
  }
}

export function patch() {
  patchMapPrototypeGetOrInsert();
  patchMapPrototypeGetOrInsertComputed();
  patchIteratorPrototypeToArray();
}
