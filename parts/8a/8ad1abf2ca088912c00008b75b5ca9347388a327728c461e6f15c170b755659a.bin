import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createHash } from './hash.mjs';
for (const name of ['md5', 'sha1', 'sha256', 'sha384', 'sha512']) {
  for (const n of [0, 1, 3, 55, 56, 63, 64, 65, 111, 112, 119, 120, 127, 128, 129, 1000, 70000]) {
    const data = crypto.randomBytes(n);
    const mine = createHash(name); mine.update(data.subarray(0, n >> 1)); mine.update(data.subarray(n >> 1));
    assert.equal(Buffer.from(mine.digest()).toString('hex'), crypto.createHash(name).update(data).digest('hex'), `${name} n=${n}`);
  }
}
console.log('hash: PASS');
