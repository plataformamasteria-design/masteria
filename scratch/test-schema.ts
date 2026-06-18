import { z } from 'zod';

const schema = z.object({ boardId: z.string() });
console.log(schema);
