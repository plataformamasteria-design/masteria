import { NextRequest, NextResponse } from 'next/server';

interface SendMetaRequest {
  to: string;
  message: string;
  type?: 'text' | 'template';
  templateName?: string;
  templateParams?: string[];
}


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { to, message, type = 'text', templateName, templateParams }: SendMetaRequest = await request.json();

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: to, message' },
        { status: 400 }
      );
    }

    const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
    const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

    if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
      console.error('Meta API credentials not configured');
      return NextResponse.json(
        { error: 'Meta API not configured' },
        { status: 500 }
      );
    }

    const phoneNumber = to.replace(/\D/g, ''); // Remove non-digits

    let body: any;

    if (type === 'template' && templateName) {
      // Template message
      body = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'pt_BR' },
          components: templateParams ? [
            {
              type: 'body',
              parameters: templateParams.map(param => ({
                type: 'text',
                text: param
              }))
            }
          ] : []
        }
      };
    } else {
      // Text message
      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'text',
        text: { body: message }
      };
    }

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${META_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Meta API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      messageId: data.messages?.[0]?.id,
      data: data
    });

  } catch (error: any) {
    console.error('Error sending via Meta API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}
