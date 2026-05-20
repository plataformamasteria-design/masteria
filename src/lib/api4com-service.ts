import { db } from '@/lib/db';
import { crmIntegrations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export const api4comService = {
  /**
   * Dispara uma chamada Click-to-Call na API4COM.
   * @param companyId ID da empresa para buscar o token
   * @param destinationNumber Número que o cliente vai atender
   * @returns Resposta da API4COM
   */
  async initiateClickToCall(companyId: string, destinationNumber: string) {
    if (!companyId) {
      throw new Error('companyId é obrigatório para iniciar chamada via API4COM.');
    }

    // Buscar configurações do banco de dados
    const results = await db
      .select()
      .from(crmIntegrations)
      .where(and(eq(crmIntegrations.companyId, companyId), eq(crmIntegrations.provider, 'api4com')));

    const integration = results[0];

    if (!integration || integration.status !== 'connected' || !integration.config) {
      throw new Error('API4COM não configurada para esta empresa.');
    }

    const { token, defaultExtension, baseUrl = 'https://api.api4com.com/api/v1' } = integration.config as { token: string; defaultExtension: string; baseUrl?: string };

    if (!token) {
      throw new Error('API4COM_TOKEN não configurado corretamente na integração.');
    }
    
    if (!defaultExtension) {
      throw new Error('Ramal de origem não configurado na integração.');
    }

    // Payload padrão de chamadas da API4COM
    const payload = {
      from: defaultExtension,
      to: destinationNumber
    };

    logger.info('Iniciando Click-to-Call via API4COM', { 
      source: defaultExtension, 
      destination: destinationNumber,
      url: `${baseUrl}/calls/click-to-call`
    });

    try {
      const response = await fetch(`${baseUrl}/calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = 'Falha ao iniciar chamada via API4COM';
        try {
          const textData = await response.text();
          try {
            const errorData = JSON.parse(textData);
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch (e) {
            errorMessage = `Resposta inválida da API4COM: ${textData.substring(0, 100)}...`;
          }
        } catch (e) {
          // Fallback
        }
        logger.error('Erro na resposta da API4COM', { status: response.status, errorMessage });
        throw new Error(errorMessage);
      }

      const data = await response.json();
      logger.info('Chamada API4COM disparada com sucesso', { response: data });
      return data;
    } catch (error) {
      logger.error('Exceção ao chamar API4COM', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
};
