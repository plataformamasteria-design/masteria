// Endpoint de teste para validação do cache Redis
import { NextResponse } from 'next/server';
import { getCachedOrFetch, CacheTTL } from '@/lib/api-cache';

// Desabilitar cache do Next.js para testar nosso cache customizado
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const testId = searchParams.get('id') || 'default';
    const forceFetch = searchParams.get('force') === 'true';
    
    // Chave de cache única para cada teste
    const cacheKey = `test:cache:${testId}`;
    
    // Se force=true, limpar cache antes
    if (forceFetch) {
      console.log(`🧹 [TEST-CACHE] Forcing cache clear for key: ${cacheKey}`);
    }
    
    const result = await getCachedOrFetch(
      cacheKey,
      async () => {
        console.log(`🔍 [TEST-CACHE] Fetching fresh data for key: ${cacheKey}`);
        
        // Simular operação pesada (como query de banco)
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
          testId,
          timestamp: new Date().toISOString(),
          randomValue: Math.random(),
          message: 'This data was fetched from source (not cached)'
        };
      },
      CacheTTL.SHORT // 30 segundos de TTL
    );
    
    return NextResponse.json({
      ...result,
      cacheInfo: {
        key: cacheKey,
        ttl: CacheTTL.SHORT,
        cached: result.message !== 'This data was fetched from source (not cached)'
      }
    });
    
  } catch (error) {
    console.error('[TEST-CACHE] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}