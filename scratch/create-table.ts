import 'dotenv/config';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function createTable() {
    console.log("Criando enum e tabela...");
    
    try {
        await db.execute(sql`
            DO $$ BEGIN
                CREATE TYPE copilot_scheduled_task_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        console.log("Enum criado ou já existia.");
        
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS copilot_scheduled_tasks (
                id text PRIMARY KEY DEFAULT gen_random_uuid(),
                company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                contact_id text REFERENCES contacts(id) ON DELETE CASCADE,
                conversation_id text REFERENCES conversations(id) ON DELETE CASCADE,
                prompt text NOT NULL,
                execute_at timestamp NOT NULL,
                status copilot_scheduled_task_status NOT NULL DEFAULT 'pending',
                result text,
                created_at timestamp NOT NULL DEFAULT NOW(),
                updated_at timestamp NOT NULL DEFAULT NOW()
            );
        `);
        console.log("Tabela criada ou já existia.");
        
        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS copilot_tasks_company_status_idx ON copilot_scheduled_tasks (company_id, status);
            CREATE INDEX IF NOT EXISTS copilot_tasks_execute_at_idx ON copilot_scheduled_tasks (execute_at);
        `);
        console.log("Índices criados ou já existiam.");
        
    } catch(e) {
        console.error("Erro:", e);
    }
    
    process.exit(0);
}

createTable();
