import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { automationFlows } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserSession } from '@/app/actions';

export async function GET(req: NextRequest) {
    const session = await getUserSession();
    return NextResponse.json({ 
        sessionCompanyId: session?.user?.companyId,
        sessionEmpresaId: session?.empresaId,
        fullSession: session
    });
}
