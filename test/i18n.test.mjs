// Every string exists in both languages; every warning/outcome/risk/check code the engine can emit has a label.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS } from '../src/i18n.js';
import { RULES } from '../src/rules.js';
import { PRESETS } from '../src/presets.js';

const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
test('EN and PT-BR have the same keys', () => {
  assert.deepEqual(keys(STRINGS.pt).sort(), keys(STRINGS.en).sort());
  assert.equal(STRINGS.pt.quick.length, STRINGS.en.quick.length);
});
test('every engine code has a label', () => {
  const need = {
    status: ['WRITABLE', 'ELECTING', 'NO_MAJORITY', 'ALL_DOWN'],
    warn: ['ATLAS_ELECTABLE_COUNT', 'EVEN_VOTERS', 'SINGLE_REGION', 'MAJORITY_IN_REGION', 'TWO_REGIONS'],
    wOut: ['ACK', 'ACK1', 'SENT', 'WAITING', 'WAITING0', 'PRIMARY_UNREACHABLE', 'NO_PRIMARY', 'BLOCKS', 'APP_DOWN'],
    rOut: ['OK', 'NO_PRIMARY', 'NO_SECONDARY', 'NO_MEMBER', 'INVALID', 'WAITING', 'BLOCKS', 'APP_DOWN'],
    risk: ['ROLLBACK_POSSIBLE', 'NO_ACK', 'WILL_ROLL_BACK', 'MAJORITY_CRASH_ROLLBACK', 'STALE', 'MAY_ROLL_BACK', 'READS_DOOMED_WRITES'],
    role: ['PRIMARY', 'SECONDARY', 'READ_ONLY', 'DOWN', 'STEPPING_DOWN'],
  };
  for (const lang of ['en', 'pt']) for (const [group, codes] of Object.entries(need)) for (const c of codes) assert.ok(STRINGS[lang][group][c], `${lang}.${group}.${c}`);
});
test('every rule has both languages, a quote and a mongodb.com URL; every preset has both names', () => {
  for (const [id, r] of Object.entries(RULES)) {
    assert.ok(r.en && r.pt && r.quote.length > 20, id);
    assert.match(r.url, /^https:\/\/www\.mongodb\.com\/docs\//, id);
  }
  for (const p of PRESETS) assert.ok(p.name.en && p.name.pt, p.id);
});
test('role pills fit their slot (max 11 characters)', () => {
  for (const lang of ['en', 'pt']) for (const v of Object.values(STRINGS[lang].role)) assert.ok(v.length <= 11, v);
});
