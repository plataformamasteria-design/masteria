/**
 * API Auth Helper - Helper para tratamento de autenticação em rotas de API
 * 
 * Este módulo fornece funções utilitárias para obter companyId e userId
 * de forma segura em rotas de API, retornando erros HTTP apropriados
 * ao invés de exceções que resultam em 500.
 */

import { getCompanyIdFromSession, getUserIdFromSession } from '@/app/actions';
import { NextResponse } from 'next/server';

/**
 * Obtém companyId da sessão ou retorna null se não autenticado
 * Útil para rotas que podem funcionar sem autenticação
 */
export async function getCompanyIdFromSessionSafe(): Promise<string | null> {
  try {
    return await getCompanyIdFromSession();
  } catch (error) {
    return null;
  }
}

/**
 * Obtém userId da sessão ou retorna null se não autenticado
 * Útil para rotas que podem funcionar sem autenticação
 */
export async function getUserIdFromSessionSafe(): Promise<string | null> {
  try {
    return await getUserIdFromSession();
  } catch (error) {
    return null;
  }
}

/**
 * Obtém companyId da sessão ou retorna resposta 401
 * Use em rotas que REQUEREM autenticação
 */
export async function requireCompanyIdOr401(): Promise<{ companyId: string } | NextResponse> {
  try {
    const companyId = await getCompanyIdFromSession();
    return { companyId };
  } catch (error) {
    return NextResponse.json(
      { error: 'Não autorizado: autenticação necessária' },
      { status: 401 }
    );
  }
}

/**
 * Obtém userId da sessão ou retorna resposta 401
 * Use em rotas que REQUEREM autenticação
 */
export async function requireUserIdOr401(): Promise<{ userId: string } | NextResponse> {
  try {
    const userId = await getUserIdFromSession();
    return { userId };
  } catch (error) {
    return NextResponse.json(
      { error: 'Não autorizado: autenticação necessária' },
      { status: 401 }
    );
  }
}

/**
 * Obtém companyId e userId da sessão ou retorna resposta 401
 * Use em rotas que REQUEREM autenticação completa
 */
export async function requireAuthOr401(): Promise<
  { companyId: string; userId: string } | NextResponse
> {
  try {
    const companyId = await getCompanyIdFromSession();
    const userId = await getUserIdFromSession();
    return { companyId, userId };
  } catch (error) {
    return NextResponse.json(
      { error: 'Não autorizado: autenticação necessária' },
      { status: 401 }
    );
  }
}

/**
 * Obtém companyId, userId e dados do usuário da sessão ou retorna resposta 401
 * Use em rotas que REQUEREM verificação de permissões do usuário
 */
export async function requireAuthWithUserOr401(): Promise<
  { companyId: string; userId: string; user: any } | NextResponse
> {
  try {
    const { getUserSession } = await import('@/app/actions');
    const session = await getUserSession();
    if (session.error || !session.user?.companyId || !session.user?.id) {
        throw new Error("Não autorizado: sessão inválida.");
    }
    return { 
        companyId: session.user.companyId, 
        userId: session.user.id,
        user: session.user 
    };
  } catch (error) {
    return NextResponse.json(
      { error: 'Não autorizado: autenticação necessária' },
      { status: 401 }
    );
  }
}
