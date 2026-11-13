// Editions: the base game is the install index served from game/; the Extended edition merges a second tree
// (other games' folders, bundled addons, a mount.cfg) served from game/ext/ over it. Every guest thread builds the
// same merged index from the same inputs, so file descriptors (ranks in the index) agree across threads.

// Deep merge: directories combine, a file in `ext` replaces the base file of the same name. Mutates and returns base.
export function mergeTree(base, ext) {
  for (const [name, node] of Object.entries(ext)) {
    if (typeof node === 'object' && typeof base[name] === 'object') mergeTree(base[name], node);
    else base[name] = node;
  }
  return base;
}

// "a/b/c" for every file in a tree.
export function listFiles(tree, prefix = '', out = []) {
  for (const [name, node] of Object.entries(tree)) {
    if (typeof node === 'object') listFiles(node, `${prefix}${name}/`, out);
    else out.push(prefix + name);
  }
  return out;
}

// A reader that serves files of the extension tree from its own base URL and everything else from the game's.
export function createEditionReader(createHttpReader, { base, cacheLimit }, ext) {
  const main = createHttpReader(base, cacheLimit ? { cacheLimit } : undefined);
  if (!ext) return main;
  const files = new Set(ext.files), extra = createHttpReader(ext.base, cacheLimit ? { cacheLimit } : undefined);
  return (path, pos, buf) => (files.has(path) ? extra : main)(path, pos, buf);
}
