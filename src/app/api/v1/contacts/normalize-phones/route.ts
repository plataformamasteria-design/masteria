// src/app/api/v1/contacts/normalize-phones/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';

function normalizePhoneNumber(rawPhone: string): { phone: string; valid: boolean } {
  const cleaned = rawPhone.replace(/\D/g, '');
  
  if (cleaned.length < 10 || cleaned.length > 15) {
    return { phone: rawPhone, valid: false };
  }

  let normalized = cleaned;

  if (normalized.startsWith('55') && (normalized.length === 12 || normalized.length === 13)) {
    const countryCode = normalized.substring(0, 2);
    const areaCode = normalized.substring(2, 4);
    const phoneNumber = normalized.substring(4);
    
    normalized = `+${countryCode}${areaCode}${phoneNumber}`;
    return { phone: normalized, valid: true };
  }

  if (!normalized.startsWith('55')) {
    if (normalized.length >= 10 && normalized.length <= 11) {
      normalized = '55' + normalized;
    } else {
      return { phone: rawPhone, valid: false };
    }
  }

  if (normalized.length === 12 || normalized.length === 13) {
    const countryCode = normalized.substring(0, 2);
    const areaCode = normalized.substring(2, 4);
    const phoneNumber = normalized.substring(4);
    
    normalized = `+${countryCode}${areaCode}${phoneNumber}`;
    return { phone: normalized, valid: true };
  }

  return { phone: rawPhone, valid: false };
}


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json(
        { error: 'Não autorizado: ID da empresa não pôde ser obtido da sessão.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { phones } = body;

    if (!Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json(
        { error: 'O campo "phones" deve ser um array com pelo menos um número.' },
        { status: 400 }
      );
    }

    const normalized = phones.map(phone => normalizePhoneNumber(phone));
    const validPhones = normalized.filter(item => item.valid);

    if (validPhones.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum número de telefone válido foi encontrado.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      normalized: validPhones,
      total: phones.length,
      valid: validPhones.length,
      invalid: phones.length - validPhones.length,
    });
  } catch (error) {
    console.error('Erro ao normalizar números:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor ao processar números.' },
      { status: 500 }
    );
  }
}
