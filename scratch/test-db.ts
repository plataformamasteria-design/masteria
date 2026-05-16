import { db } from '../src/lib/db';
import { kanbanStagePersonas, kanbanBoards } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';

async function test() {
  try {
    const stageConfigResults = await db
      .select()
      .from(kanbanStagePersonas)
      .innerJoin(kanbanBoards, eq(kanbanBoards.id, kanbanStagePersonas.boardId))
      .limit(1);
    
    fs.writeFileSync('db-test-output.txt', JSON.stringify(stageConfigResults[0] || "EMPTY", null, 2));

  } catch(e) {
    fs.writeFileSync('db-test-output.txt', "ERROR: " + String(e));
  } finally {
    process.exit(0);
  }
}
test();
