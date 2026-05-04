// src/app/api/v1/test-integrations/route.ts
import { NextResponse } from 'next/server';
import { getApps } from 'firebase/app';
import redis from '@/lib/redis';
import { fileExists, uploadFileToS3, getPresignedDownloadUrl, deleteFileFromS3 } from '@/lib/s3';

interface IntegrationTest {
  name: string;
  status: 'success' | 'warning' | 'error';
  configured: boolean;
  details: any;
  message?: string;
  suggestions?: string[];
}

async function testFirebase(): Promise<IntegrationTest> {
  try {
    const hasConfig = !!(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID
    );

    if (!hasConfig) {
      return {
        name: 'Firebase',
        status: 'error',
        configured: false,
        details: {
          api_key: false,
          auth_domain: false,
          project_id: false,
          storage_bucket: false,
          messaging_sender_id: false,
          app_id: false,
          measurement_id: false
        },
        message: 'Firebase não está configurado',
        suggestions: ['Configure todas as variáveis NEXT_PUBLIC_FIREBASE_* no ambiente']
      };
    }

    // Verificar se app está inicializado
    const apps = getApps();
    const app = apps.length > 0 ? apps[0] : null;

    return {
      name: 'Firebase',
      status: 'success',
      configured: true,
      details: {
        api_key: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        auth_domain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        project_id: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'não configurado',
        storage_bucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messaging_sender_id: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        app_id: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        measurement_id: !!process.env.NEXT_PUBLIC_MEASUREMENT_ID,
        app_initialized: !!app,
        analytics_available: false // Analytics só funciona no cliente
      },
      message: 'Firebase configurado e inicializado com sucesso'
    };
  } catch (error: any) {
    return {
      name: 'Firebase',
      status: 'error',
      configured: false,
      details: { error: error.message },
      message: `Erro ao testar Firebase: ${error.message}`
    };
  }
}

async function testMetaWhatsApp(): Promise<IntegrationTest> {
  const hasAccessToken = !!process.env.META_ACCESS_TOKEN;
  const hasBusinessId = !!process.env.META_BUSINESS_ID;
  const hasVerifyToken = !!process.env.META_VERIFY_TOKEN;
  const hasPhoneNumberId = !!process.env.META_PHONE_NUMBER_ID;
  const hasFacebookApiVersion = !!process.env.FACEBOOK_API_VERSION;

  const configured = hasAccessToken && hasBusinessId;
  const fullyConfigured = configured && hasVerifyToken && hasPhoneNumberId;

  const suggestions = [];
  if (!hasAccessToken) suggestions.push('Configure META_ACCESS_TOKEN com o token de acesso do Meta Business');
  if (!hasBusinessId) suggestions.push('Configure META_BUSINESS_ID com o ID do seu Business no Meta');
  if (!hasVerifyToken) suggestions.push('Configure META_VERIFY_TOKEN para webhooks do WhatsApp');
  if (!hasPhoneNumberId) suggestions.push('Configure META_PHONE_NUMBER_ID para envio de mensagens');
  if (!hasFacebookApiVersion) suggestions.push('Configure FACEBOOK_API_VERSION (ex: v20.0)');

  return {
    name: 'Meta/WhatsApp API',
    status: fullyConfigured ? 'success' : configured ? 'warning' : 'error',
    configured,
    details: {
      access_token: hasAccessToken,
      business_id: hasBusinessId ? process.env.META_BUSINESS_ID : false,
      verify_token: hasVerifyToken,
      phone_number_id: hasPhoneNumberId,
      api_version: hasFacebookApiVersion ? process.env.FACEBOOK_API_VERSION : 'não configurado'
    },
    message: fullyConfigured
      ? 'Meta/WhatsApp API totalmente configurado'
      : configured
        ? 'Meta/WhatsApp API parcialmente configurado'
        : 'Meta/WhatsApp API não configurado',
    suggestions: suggestions.length > 0 ? suggestions : undefined
  };
}

async function testWhatsAppPhoneNumbers(): Promise<IntegrationTest> {
  const wabaId = '399691246563833'; // WABA ID específico solicitado
  const accessToken = process.env.META_ACCESS_TOKEN;
  const apiVersion = process.env.FACEBOOK_API_VERSION || 'v23.0';

  if (!accessToken) {
    return {
      name: 'WhatsApp Phone Numbers',
      status: 'error',
      configured: false,
      details: {
        error: 'META_ACCESS_TOKEN não configurado'
      },
      message: 'Token de acesso não encontrado',
      suggestions: ['Configure META_ACCESS_TOKEN nas variáveis de ambiente']
    };
  }

  try {
    // Fazer chamada à API Meta para obter os phone numbers do WABA
    const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/phone_numbers`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        name: 'WhatsApp Phone Numbers',
        status: 'error',
        configured: false,
        details: {
          waba_id: wabaId,
          error: data.error?.message || 'Erro desconhecido na API',
          error_code: data.error?.code,
          api_version: apiVersion
        },
        message: `Erro ao buscar phone numbers: ${data.error?.message || 'Erro desconhecido'}`,
        suggestions: [
          'Verifique se o token de acesso está válido',
          'Confirme se o WABA ID está correto',
          'Verifique as permissões do token'
        ]
      };
    }

    // Processar os phone numbers retornados
    const phoneNumbers = data.data || [];
    const phoneNumberDetails = phoneNumbers.map((phone: any) => ({
      id: phone.id,
      display_phone_number: phone.display_phone_number,
      verified_name: phone.verified_name,
      code_verification_status: phone.code_verification_status,
      quality_rating: phone.quality_rating,
      platform_type: phone.platform_type,
      throughput: phone.throughput
    }));

    return {
      name: 'WhatsApp Phone Numbers',
      status: phoneNumbers.length > 0 ? 'success' : 'warning',
      configured: true,
      details: {
        waba_id: wabaId,
        total_phone_numbers: phoneNumbers.length,
        phone_numbers: phoneNumberDetails,
        api_version: apiVersion,
        current_configured_id: '391262387407327', // ID atualmente no banco
        match_status: phoneNumberDetails.some((p: any) => p.id === '391262387407327') ? 'Configuração correta' : 'Phone Number ID precisa ser atualizado'
      },
      message: phoneNumbers.length > 0
        ? `${phoneNumbers.length} número(s) encontrado(s) para o WABA ${wabaId}`
        : 'Nenhum número configurado para este WABA',
      suggestions: phoneNumbers.length === 0
        ? ['Configure um número de telefone no Meta Business Manager para este WABA']
        : undefined
    };
  } catch (error: any) {
    return {
      name: 'WhatsApp Phone Numbers',
      status: 'error',
      configured: false,
      details: {
        waba_id: wabaId,
        error: error.message
      },
      message: `Erro ao testar WhatsApp Phone Numbers: ${error.message}`,
      suggestions: ['Verifique a conexão com a internet', 'Confirme se a API do Meta está acessível']
    };
  }
}

async function testObjectStorage(): Promise<IntegrationTest> {
  const isReplit = !!(process.env.REPL_ID || process.env.REPLIT_DEPLOYMENT_ID);
  const hasAwsConfig = !!(
    process.env.AWS_S3_BUCKET_NAME &&
    process.env.AWS_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );

  try {
    if (isReplit) {
      // Testar Replit Object Storage
      const hasPublicPaths = !!process.env.PUBLIC_OBJECT_SEARCH_PATHS;
      const hasPrivateDir = !!process.env.PRIVATE_OBJECT_DIR;

      if (!hasPublicPaths && !hasPrivateDir) {
        return {
          name: 'Object Storage',
          status: 'warning',
          configured: false,
          details: {
            provider: 'Replit Object Storage',
            public_paths_configured: false,
            private_dir_configured: false
          },
          message: 'Replit Object Storage não está configurado',
          suggestions: [
            'Configure PUBLIC_OBJECT_SEARCH_PATHS com os caminhos públicos (ex: /zapmaster/public)',
            'Configure PRIVATE_OBJECT_DIR com o diretório privado (ex: /zapmaster/private)'
          ]
        };
      }

      // Tentar fazer operação de teste
      const testKey = `test/integration-test-${Date.now()}.txt`;
      const testContent = Buffer.from('Test content for integration check');

      try {
        // Testar upload
        await uploadFileToS3('system-test', testKey, testContent, 'text/plain');

        // Testar verificação de existência
        const exists = await fileExists('system-test', testKey);

        // Testar presigned URL
        const presignedUrl = await getPresignedDownloadUrl('system-test', testKey);

        // Limpar arquivo de teste
        await deleteFileFromS3('system-test', testKey);

        return {
          name: 'Object Storage',
          status: 'success',
          configured: true,
          details: {
            provider: 'Replit Object Storage',
            public_paths: process.env.PUBLIC_OBJECT_SEARCH_PATHS || 'não configurado',
            private_dir: process.env.PRIVATE_OBJECT_DIR || 'não configurado',
            test_upload: 'sucesso',
            test_exists_check: exists,
            test_presigned_url: !!presignedUrl,
            test_delete: 'sucesso'
          },
          message: 'Replit Object Storage funcionando corretamente'
        };
      } catch (testError: any) {
        return {
          name: 'Object Storage',
          status: 'warning',
          configured: true,
          details: {
            provider: 'Replit Object Storage',
            public_paths: process.env.PUBLIC_OBJECT_SEARCH_PATHS || 'não configurado',
            private_dir: process.env.PRIVATE_OBJECT_DIR || 'não configurado',
            error: testError.message
          },
          message: 'Replit Object Storage configurado mas com erro no teste',
          suggestions: [
            'Verifique se o bucket foi criado no Replit Object Storage',
            'Confirme se as variáveis de ambiente estão corretas'
          ]
        };
      }
    } else if (hasAwsConfig) {
      // Testar AWS S3
      const testKey = `test/integration-test-${Date.now()}.txt`;
      const testContent = Buffer.from('Test content for integration check');

      try {
        // Testar upload
        await uploadFileToS3('system-test', testKey, testContent, 'text/plain');

        // Testar verificação de existência
        const exists = await fileExists('system-test', testKey);

        // Testar presigned URL
        const presignedUrl = await getPresignedDownloadUrl('system-test', testKey);

        // Limpar arquivo de teste
        await deleteFileFromS3('system-test', testKey);

        return {
          name: 'Object Storage',
          status: 'success',
          configured: true,
          details: {
            provider: 'AWS S3',
            bucket: process.env.AWS_S3_BUCKET_NAME,
            region: process.env.AWS_REGION,
            cloudfront_domain: process.env.AWS_CLOUDFRONT_DOMAIN || 'não configurado',
            test_upload: 'sucesso',
            test_exists_check: exists,
            test_presigned_url: !!presignedUrl,
            test_delete: 'sucesso'
          },
          message: 'AWS S3 funcionando corretamente'
        };
      } catch (testError: any) {
        return {
          name: 'Object Storage',
          status: 'error',
          configured: true,
          details: {
            provider: 'AWS S3',
            bucket: process.env.AWS_S3_BUCKET_NAME,
            region: process.env.AWS_REGION,
            error: testError.message
          },
          message: `AWS S3 configurado mas com erro: ${testError.message}`,
          suggestions: [
            'Verifique as credenciais AWS',
            'Confirme se o bucket existe e tem as permissões corretas'
          ]
        };
      }
    } else {
      return {
        name: 'Object Storage',
        status: 'error',
        configured: false,
        details: {
          replit_env: isReplit,
          aws_configured: false
        },
        message: 'Nenhum sistema de storage configurado',
        suggestions: [
          isReplit
            ? 'Configure PUBLIC_OBJECT_SEARCH_PATHS e PRIVATE_OBJECT_DIR para usar Replit Object Storage'
            : 'Configure as credenciais AWS (AWS_S3_BUCKET_NAME, AWS_REGION, etc.)'
        ]
      };
    }
  } catch (error: any) {
    return {
      name: 'Object Storage',
      status: 'error',
      configured: false,
      details: { error: error.message },
      message: `Erro ao testar Object Storage: ${error.message}`
    };
  }
}

async function testRedisCache(): Promise<IntegrationTest> {
  const hasRedisUrl = !!process.env.REDIS_URL;

  try {
    // Testar operações básicas
    const testKey = `test:integration:${Date.now()}`;
    const testValue = JSON.stringify({ test: true, timestamp: Date.now() });

    // SET
    await redis.set(testKey, testValue, 'EX', 10);

    // GET
    const retrieved = await redis.get(testKey);

    // EXISTS
    const exists = await redis.exists(testKey);

    // DEL
    await redis.del(testKey);

    return {
      name: 'Redis/Cache',
      status: hasRedisUrl ? 'success' : 'warning',
      configured: hasRedisUrl,
      details: {
        provider: hasRedisUrl ? 'Redis' : 'Mock Redis (in-memory)',
        redis_url_configured: hasRedisUrl,
        test_set: 'sucesso',
        test_get: retrieved === testValue,
        test_exists: exists === 1,
        test_delete: 'sucesso'
      },
      message: hasRedisUrl
        ? 'Redis configurado e funcionando'
        : 'Usando Mock Redis (in-memory) para desenvolvimento',
      suggestions: hasRedisUrl ? undefined : [
        'Para produção, configure REDIS_URL com uma instância Redis real',
        'O Mock Redis funciona apenas para desenvolvimento e não persiste dados'
      ]
    };
  } catch (error: any) {
    return {
      name: 'Redis/Cache',
      status: 'error',
      configured: hasRedisUrl,
      details: {
        provider: hasRedisUrl ? 'Redis' : 'Mock Redis',
        error: error.message
      },
      message: `Erro ao testar Redis: ${error.message}`
    };
  }
}

async function testAIAPIs(): Promise<IntegrationTest> {
  const hasGemini = !!(process.env.GOOGLE_GEMINI_AGENTS1 || process.env.GOOGLE_GEMINI_AGENTS2 || process.env.GOOGLE_API_KEY);

  const details: any = {
    gemini_configured: hasGemini,
    primary_provider: 'google'
  };

  const suggestions = [];

  if (!hasGemini) {
    suggestions.push('Configure GOOGLE_GEMINI_AGENTS1 ou GOOGLE_GEMINI_AGENTS2 para usar Google Gemini');
  }

  return {
    name: 'APIs de IA',
    status: hasGemini ? 'success' : 'error',
    configured: hasGemini,
    details,
    message: hasGemini
      ? 'Google Gemini API configurada'
      : 'Google Gemini API não configurada',
    suggestions: suggestions.length > 0 ? suggestions : undefined
  };
}


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('🔍 Iniciando testes de integração...');

    // Executar todos os testes em paralelo
    const [firebase, metaWhatsApp, whatsappPhoneNumbers, objectStorage, redisCache, aiAPIs] = await Promise.all([
      testFirebase(),
      testMetaWhatsApp(),
      testWhatsAppPhoneNumbers(),
      testObjectStorage(),
      testRedisCache(),
      testAIAPIs()
    ]);

    const integrations = [firebase, metaWhatsApp, whatsappPhoneNumbers, objectStorage, redisCache, aiAPIs];

    // Resumo geral
    const summary = {
      total: integrations.length,
      success: integrations.filter(i => i.status === 'success').length,
      warning: integrations.filter(i => i.status === 'warning').length,
      error: integrations.filter(i => i.status === 'error').length,
      configured: integrations.filter(i => i.configured).length,
      timestamp: new Date().toISOString(),
      environment: {
        is_replit: !!(process.env.REPL_ID || process.env.REPLIT_DEPLOYMENT_ID),
        node_env: process.env.NODE_ENV || 'development'
      }
    };

    // Recomendações gerais
    const recommendations = [];

    if (summary.error > 0) {
      recommendations.push('⚠️ Existem integrações com erro que precisam de atenção imediata');
    }

    if (summary.warning > 0) {
      recommendations.push('⚡ Algumas integrações estão parcialmente configuradas');
    }

    if (!firebase.configured) {
      recommendations.push('🔥 Configure Firebase para analytics e autenticação');
    }

    if (!metaWhatsApp.configured) {
      recommendations.push('📱 Configure Meta/WhatsApp API para comunicação com clientes');
    }

    if (redisCache.details?.provider === 'Mock Redis (in-memory)') {
      recommendations.push('💾 Para produção, configure um Redis real para cache persistente');
    }

    console.log(`✅ Testes concluídos: ${summary.success}/${summary.total} com sucesso`);

    return NextResponse.json({
      success: true,
      summary,
      integrations,
      recommendations: recommendations.length > 0 ? recommendations : ['✅ Todas as integrações essenciais estão funcionando']
    });

  } catch (error: any) {
    console.error('❌ Erro ao executar testes de integração:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}