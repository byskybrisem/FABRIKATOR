import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recipe, openWorkshop, readGame, act, stage } from '../src/workshop.ts';

function connect(path = ':memory:') {
  const sql = new DatabaseSync(path);
  return { sql, execSync: q => sql.exec(q), runSync: (q,...args) => sql.prepare(q).run(...args),
    getFirstSync: q => sql.prepare(q).get() };
}

test('10 sandalyenin stokları, maliyeti, satış geliri ve kârı; yeniden açılış ve ikinci parti', t => {
  const dir = mkdtempSync(join(tmpdir(), 'fabrikator-'));
  t.after(() => rmSync(dir,{recursive:true,force:true}));
  const path = join(dir, 'oyun.db');
  let db = connect(path);
  let g = openWorkshop(db);
  assert.equal(g.cash,200000);
  for (let batch=1; batch<=2; batch++) {
    const before = g.cash;
    assert.equal(stage(g),'buy');
    g = act(db,'buy',g.revision);
    assert.deepEqual([g.boards,g.kits,g.cash],[20,10,before-100000]);
    g = act(db,'start',g.revision,1000);
    assert.deepEqual([g.boards,g.kits,g.chairs,g.cash],[0,0,0,before-130000]);
    db.sql.close(); db=connect(path);
    assert.deepEqual(openWorkshop(db),g);
    assert.throws(()=>act(db,'collect',g.revision,g.ready_at-1));
    g=act(db,'collect',g.revision,g.ready_at);
    assert.equal(g.chairs,10);
    g=act(db,'sell',g.revision);
    assert.deepEqual([g.chairs,g.sold,g.profit,g.cash],[0,10*batch,50000*batch,before+50000]);
  }
  db.sql.close();
});

test('sıra, yetersiz bakiye ve yinelenen komutlar bakiyeyi veya stoğu bozmaz', () => {
  const db=connect(); let g=openWorkshop(db);
  for (const cmd of ['sell','collect','start']) assert.throws(()=>act(db,cmd,g.revision));
  assert.deepEqual(readGame(db),g);
  g=act(db,'buy',g.revision);
  assert.throws(()=>act(db,'buy',g.revision-1));
  db.runSync('UPDATE workshop SET cash=?',recipe.labor-1);
  const before=readGame(db);
  assert.throws(()=>act(db,'start',g.revision));
  assert.deepEqual(readGame(db),before);
  db.sql.close();
});
