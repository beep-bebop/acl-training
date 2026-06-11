import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeImportSnapshot } from '../components/import-dialog.js';

test('summarizeImportSnapshot counts v8 catalog contents', () => {
  const summary = summarizeImportSnapshot({
    catalog: {
      planGroups: [
        {
          plans: [
            { modules: [{ exercises: [{}, {}] }, { exercises: [{}] }] },
            { modules: [{ exercises: [] }] },
          ],
        },
      ],
    },
  });

  assert.deepEqual(summary, {
    groups: 1,
    plans: 2,
    modules: 3,
    exercises: 3,
  });
});
