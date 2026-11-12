// Applies one backend op (see tools/lift/host/d3d9-backend.mjs) to a renderer. Used by the bridge page and by the
// in-browser host, so both execute exactly the same commands.

function floatsToRows(delta, blob) {
  const vsF = [], psF = [];
  let off = 0;
  for (const [which, start, count] of delta.cf) {
    const startByte=blob.byteOffset+off;
    const data = startByte%4===0 ? new Float32Array(blob.buffer,startByte,count*4) :
      new Float32Array(Uint8Array.from(blob.subarray(off,off+count*16)).buffer);
    off += count * 16;
    (which ? psF : vsF).push([start, data]);
  }
  delete delta.cf;
  if (vsF.length) delta.vsF = vsF;
  if (psF.length) delta.psF = psF;
}

export function applyOp(renderer, op, blob, hooks = {}) {
  switch (op.o) {
    case 'resize': renderer.resize(op.w, op.h); break;
    case 'tex': renderer.createTexture(op.id, op.d); break;
    case 'surf': renderer.createSurface(op.id, op.d); break;
    case 'buf': renderer.createBuffer(op.id, op.d); break;
    case 'sh': renderer.createShader(op.id, op.stage, new Uint32Array(blob.slice().buffer)); break;
    case 'del': renderer.destroy(op.id); break;
    case 'ut': renderer.uploadTexture(op.id, op.face, op.level, op.rect, blob, op.rowBytes, op.rows); break;
    case 'ub': renderer.uploadBuffer(op.id, op.offset, blob); break;
    case 'mips': renderer.generateMips?.(op.id); break;
    case 'st': if (op.d.cf) floatsToRows(op.d, blob); renderer.applyState(op.d); break;
    case 'clear': renderer.clear(op.flags, op.color, op.z, op.stencil, op.rects); break;
    case 'draw': renderer.draw(op.call, false); break;
    case 'drawUp': renderer.drawUp(op.call, blob.subarray(0, op.vlen), op.call.indexed ? blob.subarray(op.vlen) : null); break;
    case 'stretch': renderer.stretchRect(op.src, op.srcRect, op.dst, op.dstRect, op.filter); break;
    case 'fill': renderer.colorFill(op.id, op.rect, op.color); break;
    case 'present': renderer.backbuffer = op.bb; renderer.present(); hooks.present?.(op.html ?? []); break;
    case 'shot': hooks.shot?.(op.name); break;
    default: throw new Error(`unknown op ${op.o}`);
  }
}
