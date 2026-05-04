// src/app/api/v1/alerts/settings/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { getCompanyIdFromSession, getUserIdFromSession } from '@/app/actions';
import AlertService from '@/services/alert.service';
import { db } from '@/lib/db';
import { alertSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// GET /api/v1/alerts/settings - Get alert settings

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    const userId = await getUserIdFromSession();
    
    if (!companyId || !userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    
    // Get settings for company
    const settings = await db.query.alertSettings.findFirst({
      where: eq(alertSettings.companyId, companyId),
    });
    
    // Return default settings if none exist
    if (!settings) {
      return NextResponse.json({
        settings: {
          memoryThreshold: 90,
          responseTimeP95Threshold: 1000,
          rateLimit429Threshold: 100,
          authFailureThreshold: 10,
          queueFailureThreshold: 5,
          dbPoolThreshold: 90,
          alertRetentionDays: 30,
          enabledChannels: ['database', 'console'],
          defaultWebhookUrl: null,
          emailRecipients: [],
        },
        isDefault: true,
      });
    }
    
    return NextResponse.json({
      settings: {
        memoryThreshold: parseFloat(settings.memoryThreshold || '90'),
        responseTimeP95Threshold: settings.responseTimeP95Threshold,
        rateLimit429Threshold: settings.rateLimit429Threshold,
        authFailureThreshold: settings.authFailureThreshold,
        queueFailureThreshold: settings.queueFailureThreshold,
        dbPoolThreshold: parseFloat(settings.dbPoolThreshold || '90'),
        alertRetentionDays: settings.alertRetentionDays,
        enabledChannels: settings.enabledChannels,
        defaultWebhookUrl: settings.defaultWebhookUrl,
        emailRecipients: settings.emailRecipients,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      },
      isDefault: false,
    });
  } catch (error) {
    console.error('[API] Error fetching alert settings:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar configurações de alertas' },
      { status: 500 }
    );
  }
}

// PUT /api/v1/alerts/settings - Update alert settings
export async function PUT(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    const userId = await getUserIdFromSession();
    
    if (!companyId || !userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    
    const body = await request.json();
    
    // Validation schema
    const updateSettingsSchema = z.object({
      memoryThreshold: z.number().min(50).max(100).optional(),
      responseTimeP95Threshold: z.number().min(100).max(10000).optional(),
      rateLimit429Threshold: z.number().min(10).max(1000).optional(),
      authFailureThreshold: z.number().min(1).max(100).optional(),
      queueFailureThreshold: z.number().min(1).max(100).optional(),
      dbPoolThreshold: z.number().min(50).max(100).optional(),
      alertRetentionDays: z.number().min(1).max(365).optional(),
      enabledChannels: z.array(
        z.enum(['console', 'database', 'webhook', 'in_app', 'email'])
      ).optional(),
      defaultWebhookUrl: z.string().url().nullable().optional(),
      emailRecipients: z.array(z.string().email()).optional(),
    });
    
    // Validate request body
    let validatedData;
    try {
      validatedData = updateSettingsSchema.parse(body);
    } catch (error) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error },
        { status: 400 }
      );
    }
    
    // Update settings
    const sanitizedData = {
      ...validatedData,
      defaultWebhookUrl: validatedData.defaultWebhookUrl || undefined,
    };
    const success = await AlertService.updateAlertSettings(companyId, sanitizedData);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Falha ao atualizar configurações' },
        { status: 500 }
      );
    }
    
    // Get updated settings
    const settings = await db.query.alertSettings.findFirst({
      where: eq(alertSettings.companyId, companyId),
    });
    
    return NextResponse.json({
      settings: settings ? {
        memoryThreshold: parseFloat(settings.memoryThreshold || '90'),
        responseTimeP95Threshold: settings.responseTimeP95Threshold,
        rateLimit429Threshold: settings.rateLimit429Threshold,
        authFailureThreshold: settings.authFailureThreshold,
        queueFailureThreshold: settings.queueFailureThreshold,
        dbPoolThreshold: parseFloat(settings.dbPoolThreshold || '90'),
        alertRetentionDays: settings.alertRetentionDays,
        enabledChannels: settings.enabledChannels,
        defaultWebhookUrl: settings.defaultWebhookUrl ?? undefined,
        emailRecipients: settings.emailRecipients,
        updatedAt: settings.updatedAt,
      } : sanitizedData,
      message: 'Configurações atualizadas com sucesso',
    });
  } catch (error) {
    console.error('[API] Error updating alert settings:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar configurações de alertas' },
      { status: 500 }
    );
  }
}