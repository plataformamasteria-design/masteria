import { logger } from '@/lib/logger';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_BASE_URL = 'https://api.twilio.com/2010-04-01';

export interface TwilioPhoneNumber {
  sid: string;
  phone_number: string;
  friendly_name: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  status: string;
  voice_url?: string;
  sms_url?: string;
  date_created: string;
}

export interface TwilioCall {
  sid: string;
  status: string;
  from: string;
  to: string;
  direction: string;
  duration?: string;
  start_time?: string;
  end_time?: string;
  price?: string;
  price_unit?: string;
}

export interface TwilioAccountInfo {
  sid: string;
  friendly_name: string;
  status: string;
  type: string;
  date_created: string;
}

class TwilioService {
  private accountSid: string;
  private authToken: string;
  private baseUrl: string;

  constructor() {
    this.accountSid = TWILIO_ACCOUNT_SID;
    this.authToken = TWILIO_AUTH_TOKEN;
    this.baseUrl = TWILIO_BASE_URL;
  }

  isConfigured(): boolean {
    return !!(this.accountSid && this.authToken);
  }

  private getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('Twilio API não configurada');
    }

    const url = `${this.baseUrl}/Accounts/${this.accountSid}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Twilio API error', { endpoint, status: response.status, error: errorBody });
      throw new Error(`Twilio API error: ${response.status} - ${errorBody}`);
    }

    return response.json();
  }

  async getAccountInfo(): Promise<TwilioAccountInfo> {
    const data = await this.request<any>('.json');
    return {
      sid: data.sid,
      friendly_name: data.friendly_name,
      status: data.status,
      type: data.type,
      date_created: data.date_created,
    };
  }

  async listPhoneNumbers(): Promise<TwilioPhoneNumber[]> {
    const data = await this.request<any>('/IncomingPhoneNumbers.json');
    return (data.incoming_phone_numbers || []).map((num: any) => ({
      sid: num.sid,
      phone_number: num.phone_number,
      friendly_name: num.friendly_name,
      capabilities: {
        voice: num.capabilities?.voice || false,
        sms: num.capabilities?.sms || false,
        mms: num.capabilities?.mms || false,
      },
      status: num.status || 'active',
      voice_url: num.voice_url,
      sms_url: num.sms_url,
      date_created: num.date_created,
    }));
  }

  async getPhoneNumber(sid: string): Promise<TwilioPhoneNumber> {
    const num = await this.request<any>(`/IncomingPhoneNumbers/${sid}.json`);
    return {
      sid: num.sid,
      phone_number: num.phone_number,
      friendly_name: num.friendly_name,
      capabilities: {
        voice: num.capabilities?.voice || false,
        sms: num.capabilities?.sms || false,
        mms: num.capabilities?.mms || false,
      },
      status: num.status || 'active',
      voice_url: num.voice_url,
      sms_url: num.sms_url,
      date_created: num.date_created,
    };
  }

  async updatePhoneNumber(sid: string, params: {
    voice_url?: string;
    sms_url?: string;
    friendly_name?: string;
  }): Promise<TwilioPhoneNumber> {
    const formData = new URLSearchParams();
    if (params.voice_url) formData.append('VoiceUrl', params.voice_url);
    if (params.sms_url) formData.append('SmsUrl', params.sms_url);
    if (params.friendly_name) formData.append('FriendlyName', params.friendly_name);

    const num = await this.request<any>(`/IncomingPhoneNumbers/${sid}.json`, {
      method: 'POST',
      body: formData.toString(),
    });

    return {
      sid: num.sid,
      phone_number: num.phone_number,
      friendly_name: num.friendly_name,
      capabilities: {
        voice: num.capabilities?.voice || false,
        sms: num.capabilities?.sms || false,
        mms: num.capabilities?.mms || false,
      },
      status: num.status || 'active',
      voice_url: num.voice_url,
      sms_url: num.sms_url,
      date_created: num.date_created,
    };
  }

  async listCalls(limit: number = 50): Promise<TwilioCall[]> {
    const data = await this.request<any>(`/Calls.json?PageSize=${limit}`);
    return (data.calls || []).map((call: any) => ({
      sid: call.sid,
      status: call.status,
      from: call.from,
      to: call.to,
      direction: call.direction,
      duration: call.duration,
      start_time: call.start_time,
      end_time: call.end_time,
      price: call.price,
      price_unit: call.price_unit,
    }));
  }

  async getCall(callSid: string): Promise<TwilioCall> {
    const call = await this.request<any>(`/Calls/${callSid}.json`);
    return {
      sid: call.sid,
      status: call.status,
      from: call.from,
      to: call.to,
      direction: call.direction,
      duration: call.duration,
      start_time: call.start_time,
      end_time: call.end_time,
      price: call.price,
      price_unit: call.price_unit,
    };
  }

  async makeCall(params: {
    to: string;
    from: string;
    url: string;
    method?: string;
  }): Promise<TwilioCall> {
    const formData = new URLSearchParams();
    formData.append('To', params.to);
    formData.append('From', params.from);
    formData.append('Url', params.url);
    if (params.method) formData.append('Method', params.method);

    const call = await this.request<any>('/Calls.json', {
      method: 'POST',
      body: formData.toString(),
    });

    return {
      sid: call.sid,
      status: call.status,
      from: call.from,
      to: call.to,
      direction: call.direction,
      duration: call.duration,
      start_time: call.start_time,
      end_time: call.end_time,
      price: call.price,
      price_unit: call.price_unit,
    };
  }

  async getBalance(): Promise<{ balance: string; currency: string }> {
    const data = await this.request<any>('/Balance.json');
    return {
      balance: data.balance,
      currency: data.currency,
    };
  }
}

export const twilioService = new TwilioService();
