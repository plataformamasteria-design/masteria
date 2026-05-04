// src/app/api/internal/run-migration/route.ts
// Endpoint temporário para rodar migrações em produção
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verificar header de segurança
    const authHeader = request.headers.get('x-internal-key');
    if (authHeader !== process.env.JWT_SECRET_KEY_CALL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🚀 Running migration: add ABORDAGEM to agent_type enum');

    const results: string[] = [];

    // 1. Add ABORDAGEM to agent_type enum (safe — won't error if already exists)
    try {
      await db.execute(sql`ALTER TYPE agent_type ADD VALUE IF NOT EXISTS 'ABORDAGEM'`);
      results.push('✅ ABORDAGEM added to agent_type enum');
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        results.push('ℹ️ ABORDAGEM already exists in agent_type enum');
      } else {
        throw e;
      }
    }

    // 2. Verify enum values
    const enumCheck = await db.execute(sql`
      SELECT unnest(enum_range(NULL::agent_type))::text AS value
    `);

    const enumValues = (enumCheck as any[]).map((r: any) => r.value);

    console.log('✅ Migration completed. Enum values:', enumValues);

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      details: results,
      agent_type_values: enumValues,
    });
  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json({
      error: (error as Error).message
    }, { status: 500 });
  }
}
