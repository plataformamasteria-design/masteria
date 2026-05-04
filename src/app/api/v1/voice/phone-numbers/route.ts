import { NextResponse } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface TwilioPhoneNumber {
  phone_number: string;
  friendly_name: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
  };
}

interface RetellPhoneNumber {
  phone_number: string;
  phone_number_pretty: string;
  phone_number_type: string;
  inbound_agent_id?: string;
  outbound_agent_id?: string;
}

export async function GET() {
  try {
    await getCompanyIdFromSession();

    const twilioNumbers = await fetchTwilioNumbers();
    const retellNumbers = await fetchRetellNumbers();

    const retellMap = new Map(retellNumbers.map(n => [n.phone_number, n]));

    const phoneNumbers = twilioNumbers.map(tn => ({
      phoneNumber: tn.phone_number,
      friendlyName: tn.friendly_name,
      voiceEnabled: tn.capabilities?.voice ?? true,
      smsEnabled: tn.capabilities?.sms ?? false,
      registeredInRetell: retellMap.has(tn.phone_number),
      retellConfig: retellMap.get(tn.phone_number) || null,
    }));

    return NextResponse.json({
      success: true,
      data: phoneNumbers,
      retellNumbers,
    });
  } catch (error) {
    logger.error('Error fetching phone numbers', { error });
    const message = error instanceof Error ? error.message : 'Erro ao buscar números';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function fetchTwilioNumbers(): Promise<TwilioPhoneNumber[]> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured');
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`,
    {
      headers: { Authorization: `Basic ${auth}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch Twilio numbers');
  }

  const data = await response.json();
  return (data.incoming_phone_numbers || []).map((n: any) => ({
    phone_number: n.phone_number,
    friendly_name: n.friendly_name,
    capabilities: n.capabilities || { voice: true, sms: false },
  }));
}

async function fetchRetellNumbers(): Promise<RetellPhoneNumber[]> {
  const retellApiKey = process.env.RETELL_API_KEY;
  if (!retellApiKey) return [];

  try {
    const response = await fetch('https://api.retellai.com/list-phone-numbers', {
      headers: { Authorization: `Bearer ${retellApiKey}` },
    });
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    await getCompanyIdFromSession();
    const body = await request.json();
    const { phoneNumber, _nickname } = body;

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Número de telefone é obrigatório' }, { status: 400 });
    }

    const retellApiKey = process.env.RETELL_API_KEY;
    if (!retellApiKey) {
      return NextResponse.json({ error: 'Retell API não configurada' }, { status: 500 });
    }

    const terminationUri = process.env.TWILIO_SIP_TERMINATION_URI;
    if (!terminationUri) {
      return NextResponse.json({ 
        error: 'SIP Termination não configurado. Configure TWILIO_SIP_TERMINATION_URI.' 
      }, { status: 500 });
    }

    const response = await fetch('https://api.retellai.com/import-phone-number', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
        termination_uri: terminationUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Retell phone number creation failed', { error: errorText });
      return NextResponse.json({ 
        error: 'Falha ao registrar número no Retell', 
        details: errorText 
      }, { status: response.status });
    }

    const result = await response.json();
    logger.info('Phone number registered in Retell', { phoneNumber, result });

    return NextResponse.json({
      success: true,
      message: `Número ${phoneNumber} registrado no Retell com sucesso`,
      data: result,
    });
  } catch (error) {
    logger.error('Error registering phone number', { error });
    const message = error instanceof Error ? error.message : 'Erro ao registrar número';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
