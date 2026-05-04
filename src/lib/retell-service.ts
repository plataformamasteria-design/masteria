import { logger } from '@/lib/logger';

const RETELL_API_KEY = process.env.RETELL_API_KEY || '';
const RETELL_BASE_URL = 'https://api.retellai.com';

export interface RetellAgent {
  agent_id: string;
  agent_name: string;
  voice_id: string;
  language: string;
  response_engine: {
    type: string;
    llm_id?: string;
  };
  webhook_url?: string;
  is_published: boolean;
  max_call_duration_ms: number;
  version: number;
  last_modification_timestamp: number;
}

export interface RetellVoice {
  voice_id: string;
  voice_name: string;
  provider: string;
  accent?: string;
  gender?: string;
  age?: string;
  preview_audio_url?: string;
}

export interface RetellCall {
  call_id: string;
  call_type: string;
  agent_id: string;
  call_status: string;
  start_timestamp?: number;
  end_timestamp?: number;
  duration_ms?: number;
  from_number?: string;
  to_number?: string;
  direction: string;
  transcript?: string;
  recording_url?: string;
  call_cost?: {
    combined_cost: number;
    total_duration_seconds: number;
  };
}

export interface RetellPhoneNumber {
  phone_number: string;
  phone_number_pretty: string;
  phone_number_type: string;
  inbound_agent_id?: string;
  outbound_agent_id?: string;
  inbound_agent_version?: number;
  outbound_agent_version?: number;
  area_code?: number;
  nickname?: string;
}

export interface CreateAgentParams {
  agent_name: string;
  voice_id: string;
  language?: string;
  response_engine?: {
    type: string;
    llm_id?: string;
  };
  webhook_url?: string;
  begin_message?: string;
}

export interface UpdateAgentParams {
  agent_name?: string;
  voice_id?: string;
  language?: string;
  webhook_url?: string;
}

class RetellService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = RETELL_API_KEY;
    this.baseUrl = RETELL_BASE_URL;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('Retell API não configurada');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Retell API error', { 
        endpoint, 
        status: response.status, 
        error: errorBody,
        apiKeyPrefix: this.apiKey.substring(0, 10)
      });
      
      // Tentar parsear erro JSON
      let errorMessage = errorBody;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.message || errorBody;
      } catch (e) {
        // Manter errorBody como string
      }
      
      throw new Error(`Retell API error: ${response.status} - ${errorMessage}`);
    }

    return response.json();
  }

  async listAgents(): Promise<RetellAgent[]> {
    return this.request<RetellAgent[]>('/list-agents');
  }

  async getAgent(agentId: string): Promise<RetellAgent> {
    return this.request<RetellAgent>(`/get-agent/${agentId}`);
  }

  async createAgent(params: CreateAgentParams): Promise<RetellAgent> {
    return this.request<RetellAgent>('/create-agent', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async updateAgent(agentId: string, params: UpdateAgentParams): Promise<RetellAgent> {
    return this.request<RetellAgent>(`/update-agent/${agentId}`, {
      method: 'PATCH',
      body: JSON.stringify(params),
    });
  }

  async deleteAgent(agentId: string): Promise<void> {
    await this.request(`/delete-agent/${agentId}`, {
      method: 'DELETE',
    });
  }

  async listVoices(): Promise<RetellVoice[]> {
    return this.request<RetellVoice[]>('/list-voices');
  }

  async listVoicesPtBR(): Promise<RetellVoice[]> {
    const allVoices = await this.listVoices();
    const ptBRVoices = allVoices.filter(v => 
      v.accent?.toLowerCase().includes('brazil') ||
      v.voice_id.toLowerCase().includes('portugese-brazilian') ||
      v.voice_id.toLowerCase().includes('portuguese-brazilian')
    );
    const multilingualVoices = allVoices.filter(v =>
      v.provider === 'elevenlabs' || v.provider === 'openai'
    ).slice(0, 20);
    
    const combined = [...ptBRVoices];
    multilingualVoices.forEach(v => {
      if (!combined.find(c => c.voice_id === v.voice_id)) {
        combined.push(v);
      }
    });
    
    return combined;
  }

  async listCalls(limit: number = 50): Promise<RetellCall[]> {
    return this.request<RetellCall[]>('/v2/list-calls', {
      method: 'POST',
      body: JSON.stringify({ limit }),
    });
  }

  async getActiveCalls(): Promise<{ count: number; calls: RetellCall[] }> {
    try {
      const recentCalls = await this.listCalls(100);
      const activeCalls = recentCalls.filter(call => 
        call.call_status === 'ongoing' || 
        call.call_status === 'ringing' ||
        call.call_status === 'in_progress'
      );
      return { count: activeCalls.length, calls: activeCalls };
    } catch (error) {
      logger.error('Erro ao buscar chamadas ativas', { error });
      return { count: 0, calls: [] };
    }
  }

  async getAvailableSlots(maxConcurrent: number = 20): Promise<number> {
    const { count } = await this.getActiveCalls();
    const available = Math.max(0, maxConcurrent - count);
    logger.info(`Slots disponíveis: ${available} (${count} ativas de ${maxConcurrent} max)`);
    return available;
  }

  async getCall(callId: string): Promise<RetellCall> {
    return this.request<RetellCall>(`/get-call/${callId}`);
  }

  async createPhoneCall(params: {
    from_number: string;
    to_number: string;
    override_agent_id?: string;
    metadata?: Record<string, string>;
    voicemail_detection?: {
      provider: 'twilio';
      voicemail_detection_timeout_ms?: number;
      max_voicemail_duration_seconds?: number;
    };
  }): Promise<RetellCall> {
    return this.request<RetellCall>('/v2/create-phone-call', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async createPhoneCallWithVoicemailDetection(params: {
    from_number: string;
    to_number: string;
    override_agent_id?: string;
    metadata?: Record<string, string>;
  }): Promise<RetellCall> {
    return this.createPhoneCall({
      ...params,
      voicemail_detection: {
        provider: 'twilio',
        voicemail_detection_timeout_ms: 10000,
        max_voicemail_duration_seconds: 12,
      },
    });
  }

  async listPhoneNumbers(): Promise<RetellPhoneNumber[]> {
    return this.request<RetellPhoneNumber[]>('/list-phone-numbers');
  }
}

export const retellService = new RetellService();
