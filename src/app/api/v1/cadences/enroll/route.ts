import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { CadenceService } from '@/lib/cadence-service';
import { db } from '@/lib/db';
import { cadenceDefinitions, contacts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const enrollSchema = z.object({
  cadenceId: z.string().uuid(),
  contactId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
});

/**
 * POST /api/v1/cadences/enroll
 * Matricula manualmente um contato em uma cadência
 */

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();

    const body = await req.json();
    const parsed = enrollSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verificar se cadência pertence à empresa
    const cadence = await db.query.cadenceDefinitions.findFirst({
      where: and(
        eq(cadenceDefinitions.id, parsed.data.cadenceId),
        eq(cadenceDefinitions.companyId, companyId)
      ),
    });

    if (!cadence) {
      return NextResponse.json(
        { error: 'Cadence not found' },
        { status: 404 }
      );
    }

    // Verificar se contato pertence à empresa
    const contact = await db.query.contacts.findFirst({
      where: and(
        eq(contacts.id, parsed.data.contactId),
        eq(contacts.companyId, companyId)
      ),
    });

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Matricular na cadência
    const enrollmentId = await CadenceService.enrollInCadence({
      cadenceId: parsed.data.cadenceId,
      contactId: parsed.data.contactId,
      leadId: parsed.data.leadId,
      conversationId: parsed.data.conversationId,
    });

    return NextResponse.json(
      { 
        success: true, 
        enrollmentId,
        message: 'Contact enrolled successfully'
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.message?.includes('already enrolled')) {
      return NextResponse.json(
        { error: 'Contact is already enrolled in this cadence' },
        { status: 409 }
      );
    }

    console.error('Error enrolling contact:', error);
    return NextResponse.json(
      { error: 'Failed to enroll contact' },
      { status: 500 }
    );
  }
}
