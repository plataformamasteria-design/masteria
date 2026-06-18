import { z } from 'zod';
import { tool } from 'ai';

const t = tool({
  description: 'test',
  parameters: z.object({ id: z.string() }),
  execute: async () => { return 'ok'; }
});

console.log(t);
