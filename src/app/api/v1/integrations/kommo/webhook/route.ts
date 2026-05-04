// src/app/api/v1/integrations/kommo/webhook/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { kanbanLeads, crmIntegrations, kanbanBoards } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const entries = Array.from(formData.entries());

    // Check if this is a lead status update event
    let leadId: string | null = null;
    let statusId: string | null = null;
    let pipelineId: string | null = null;

    for (const [key, value] of entries) {
      if (key.startsWith('leads[status]') || key.startsWith('leads[update]')) {
        if (key.includes('[id]')) leadId = String(value);
        if (key.includes('[status_id]')) statusId = String(value);
        if (key.includes('[pipeline_id]')) pipelineId = String(value);
      }
    }

    if (!leadId || !statusId) {
      return NextResponse.json({ success: true, message: 'Not a relevant status update. Ignored.' });
    }

    logger.info(`[Kommo Webhook] Lead ${leadId} status changed to ${statusId}`);

    // 1. Find the KanbanLead by externalId
    const [lead] = await db
      .select({
        id: kanbanLeads.id,
        companyId: kanbanLeads.companyId,
        boardId: kanbanLeads.boardId,
        stageId: kanbanLeads.stageId
      })
      .from(kanbanLeads)
      .where(
        and(
          eq(kanbanLeads.externalId, leadId),
          eq(kanbanLeads.externalProvider, 'kommo')
        )
      )
      .limit(1);

    if (!lead || !lead.companyId) {
      logger.info(`[Kommo Webhook] Lead ${leadId} not found in MasterIA or missing companyId. Ignored.`);
      return NextResponse.json({ success: true, message: 'Lead not linked.' });
    }

    // 2. Fetch the integration config for the company
    const [integration] = await db
      .select()
      .from(crmIntegrations)
      .where(
        and(
          eq(crmIntegrations.companyId, lead.companyId as string),
          eq(crmIntegrations.provider, 'kommo')
        )
      )
      .limit(1);

    if (!integration || !integration.config) {
      logger.info(`[Kommo Webhook] Lead found, but no Kommo config found for company.`);
      return NextResponse.json({ success: true, message: 'Config missing.' });
    }

    const config = integration.config as any;
    const stageMapping = config.stageMapping;

    if (!stageMapping || !stageMapping[statusId]) {
      logger.info(`[Kommo Webhook] No mapping found for Kommo status ${statusId}.`);
      return NextResponse.json({ success: true, message: 'Status not mapped.' });
    }

    const masteriaStageId = stageMapping[statusId];

    // 3. Optional: Verify if the board actually has this stage, or just update it
    const [board] = await db.select({ stages: kanbanBoards.stages }).from(kanbanBoards).where(eq(kanbanBoards.id, lead.boardId)).limit(1);
    const stages = board?.stages as { id: string, title: string }[] | undefined;
    const stageObj = stages?.find(s => s.id === masteriaStageId);

    if (!stageObj) {
      logger.warn(`[Kommo Webhook] Mapped stage ${masteriaStageId} not found in Board ${lead.boardId}. Using anyway.`);
    }

    // 4. Update the KanbanLead stage
    const oldStageId = lead.stageId;
    await db
      .update(kanbanLeads)
      .set({
        stageId: masteriaStageId,
        updatedAt: new Date(),
        lastStageChangeAt: new Date(),
        ...(stageObj ? { currentStage: stageObj as any } : {})
      })
      .where(eq(kanbanLeads.id, lead.id));

    logger.info(`[Kommo Webhook] Successfully moved MasterIA Lead ${lead.id} to stage ${masteriaStageId}`);

    // 5. Emit real-time event via Socket.IO
    try {
      const { getSocketIO } = await import('@/lib/socket');
      const io = getSocketIO();
      if (io) {
        const companyRoom = `company:${lead.companyId}`;
        io.to(companyRoom).emit('lead_moved', {
          leadId: lead.id,
          boardId: lead.boardId,
          fromStageId: oldStageId,
          toStageId: masteriaStageId,
          source: 'kommo_webhook'
        });
        logger.info(`[Kommo Webhook] Emitted lead_moved event to room ${companyRoom}`);
      }
    } catch (socketError) {
      logger.warn('[Kommo Webhook] Failed to emit lead_moved event', { error: String(socketError) });
    }

    return NextResponse.json({ success: true, message: 'Webhook processed.' });
  } catch (error) {
    logger.error('[Kommo Webhook] Error processing webhook', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
