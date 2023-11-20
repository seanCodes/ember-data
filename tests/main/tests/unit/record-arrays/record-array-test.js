import { module, test } from 'qunit';

import { setupTest } from 'ember-qunit';

import { FetchManager, SnapshotRecordArray } from '@ember-data/legacy-compat/-private';
import Model, { attr } from '@ember-data/model';
import { createDeferred } from '@ember-data/request';
import { recordIdentifierFor } from '@ember-data/store';
import { RecordArray, SOURCE } from '@ember-data/store/-private';
import testInDebug from '@ember-data/unpublished-test-infra/test-support/test-in-debug';

class Tag extends Model {
  @attr
  name;
}

module('unit/record-arrays/record-array - DS.RecordArray', function (hooks) {
  setupTest(hooks);

  test('default initial state', async function (assert) {
    const recordArray = new RecordArray({ type: 'recordType', identifiers: [], store: null });

    assert.false(recordArray.isUpdating, 'record is not updating');
    assert.strictEqual(recordArray.modelName, 'recordType', 'has modelName');
    assert.deepEqual(recordArray[SOURCE], [], 'content is not defined');
    assert.strictEqual(recordArray.store, null, 'no store with recordArray');
  });

  test('custom initial state', async function (assert) {
    const store = {};
    const recordArray = new RecordArray({
      type: 'apple',
      identifiers: [],
      store,
    });
    assert.false(recordArray.isUpdating); // cannot set as default value:
    assert.strictEqual(recordArray.modelName, 'apple');
    assert.deepEqual(recordArray[SOURCE], []);
    assert.strictEqual(recordArray.store, store);
  });

  testInDebug('Mutation throws error', async function (assert) {
    const recordArray = new RecordArray({ identifiers: [], type: 'recordType' });

    assert.throws(
      () => {
        recordArray.splice(0, 1);
      },
      Error('Assertion Failed: Mutating this array of records via splice is not allowed.'),
      'throws error'
    );
  });

  test('#access by index', async function (assert) {
    this.owner.register('model:tag', Tag);
    const store = this.owner.lookup('service:store');

    const records = store.push({
      data: [
        {
          type: 'tag',
          id: '1',
        },
        {
          type: 'tag',
          id: '3',
        },
        {
          type: 'tag',
          id: '5',
        },
      ],
    });

    const recordArray = new RecordArray({
      type: 'recordType',
      identifiers: records.map(recordIdentifierFor),
      store,
    });

    assert.strictEqual(recordArray.length, 3);
    assert.strictEqual(recordArray[0].id, '1');
    assert.strictEqual(recordArray[1].id, '3');
    assert.strictEqual(recordArray[2].id, '5');
    assert.strictEqual(recordArray[3], undefined);
  });

  test('#update', async function (assert) {
    let findAllCalled = 0;
    const deferred = createDeferred();

    const store = {
      findAll(modelName, options) {
        findAllCalled++;
        assert.strictEqual(modelName, 'recordType');
        assert.true(options.reload, 'options should contain reload: true');
        return deferred.promise;
      },
    };

    const recordArray = new RecordArray({
      type: 'recordType',
      identifiers: [],
      store,
    });

    assert.false(recordArray.isUpdating, 'should not yet be updating');

    assert.strictEqual(findAllCalled, 0);

    const updateResult = recordArray.update();

    assert.strictEqual(findAllCalled, 1);

    deferred.resolve('return value');

    assert.true(recordArray.isUpdating, 'should be updating');

    return updateResult.then((result) => {
      assert.strictEqual(result, 'return value');
      assert.false(recordArray.isUpdating, 'should no longer be updating');
    });
  });

  test('#update while updating', async function (assert) {
    let findAllCalled = 0;
    const deferred = createDeferred();
    const store = {
      findAll(modelName, options) {
        findAllCalled++;
        return deferred.promise;
      },
    };

    const recordArray = new RecordArray({
      type: 'recordType',
      identifiers: [],
      store,
    });

    assert.false(recordArray.isUpdating, 'should not be updating');
    assert.strictEqual(findAllCalled, 0);

    const updateResult1 = recordArray.update();

    assert.strictEqual(findAllCalled, 1);

    const updateResult2 = recordArray.update();

    assert.strictEqual(findAllCalled, 1);

    assert.strictEqual(updateResult1, updateResult2);

    deferred.resolve('return value');

    assert.true(recordArray.isUpdating, 'should be updating');

    return updateResult1.then((result) => {
      assert.strictEqual(result, 'return value');
      assert.false(recordArray.isUpdating, 'should no longer be updating');
    });
  });

  test('#save', async function (assert) {
    this.owner.register('model:tag', Tag);
    const store = this.owner.lookup('service:store');

    const model1 = {
      id: '1',
      type: 'tag',
    };
    const model2 = {
      id: '2',
      type: 'tag',
    };

    const [record1, record2] = store.push({
      data: [model1, model2],
    });
    const identifiers = [recordIdentifierFor(record1), recordIdentifierFor(record2)];
    const recordArray = new RecordArray({
      identifiers,
      store,
    });

    let model1Saved = 0;
    let model2Saved = 0;
    store.saveRecord = (record) => {
      record === record1 ? model1Saved++ : model2Saved++;
      return Promise.resolve(record);
    };

    assert.strictEqual(model1Saved, 0, 'save not yet called');
    assert.strictEqual(model2Saved, 0, 'save not yet called');

    const result = recordArray.save();

    assert.strictEqual(model1Saved, 1, 'save was called for model1');
    assert.strictEqual(model2Saved, 1, 'save was called for mode2');

    const r = await result;
    assert.strictEqual(r, recordArray, 'save promise should fulfill with the original recordArray');
  });

  test('Create A SnapshotRecordArray', async function (assert) {
    this.owner.register('model:tag', Tag);
    const store = this.owner.lookup('service:store');
    store._fetchManager = new FetchManager(store);

    const model1 = {
      id: '1',
      type: 'tag',
    };

    const model2 = {
      id: '2',
      type: 'tag',
    };
    store.push({
      data: [model1, model2],
    });

    const snapshot = new SnapshotRecordArray(store, 'tag', {});
    const [snapshot1, snapshot2] = snapshot.snapshots();

    assert.strictEqual(
      snapshot1.id,
      String(model1.id),
      'record array snapshot should contain the first createSnapshot result'
    );
    assert.strictEqual(
      snapshot2.id,
      String(model2.id),
      'record array snapshot should contain the second createSnapshot result'
    );
  });
});
