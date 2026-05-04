import { logger } from '@/lib/logger';

export interface CreateAgentDto {
  name: string;
  type: 'inbound' | 'outbound' | 'transfer';
  systemPrompt: string;
  firstMessage?: string;
  voiceId?: string;
  llmModel?: string;
  temperature?: number;
}

export interface UpdateAgentDto {
  name?: string;
  type?: 'inbound' | 'outbound' | 'transfer';
  systemPrompt?: string;
  firstMessage?: string;
  voiceId?: string;
  llmModel?: string;
  temperature?: number;
  status?: 'active' | 'inactive';
}

export interface TestCallDto {
  agentId: string;
  toNumber: string;
  variables?: Record<string, string>;
}

export interface VoiceAgent {
  id: string;
  name: string;
  type: 'inbound' | 'outbound' | 'transfer';
  status: 'active' | 'inactive' | 'archived';
  systemPrompt: string;
  firstMessage?: string;
  voiceId?: string;
  llmProvider: string;
  llmModel: string;
  temperature: number;
  maxTokens?: number;
  interruptSens?: number;
  responseDelay?: number;
  organizationId?: string;
  retellAgentId?: string;
  config?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceCall {
  id: string;
  agentId: string;
  retellCallId?: string;
  direction: 'inbound' | 'outbound';
  fromNumber: string;
  toNumber: string;
  status: 'initiated' | 'ringing' | 'ongoing' | 'ended' | 'failed';
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  transcript?: Array<{ role: string; content: string; timestamp: number }>;
  recordingUrl?: string;
  summary?: string;
  qualityScore?: number;
  sentimentScore?: number;
  latencyMs?: number;
  interruptionsCount?: number;
  cost?: number;
  disconnectReason?: string;
  createdAt: string;
}

export interface VoiceAnalytics {
  totalCalls: number;
  totalDuration: number;
  avgDuration: number;
  totalCost: number;
  callsByStatus: Record<string, number>;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  database: string;
  environment: string;
}

export interface ProviderStatus {
  configured: boolean;
  status: 'not_tested' | 'connected' | 'error';
  error?: string;
}

export interface ConfigStatus {
  retell: ProviderStatus;
  twilio: ProviderStatus;
  openai: ProviderStatus;
}

class VoiceAIPlatformClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.VOICE_AI_PLATFORM_URL || 'https://plataformai.global';
    this.apiKey = process.env.VOICE_AI_PLATFORM_API_KEY || '';
  }

  async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const options: RequestInit = {
      method,
      ...(body && { body: JSON.stringify(body) }),
    };
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error('Voice AI Platform API error', {
          status: response.status,
          endpoint,
          error: errorBody,
        });
        throw new Error(`Voice AI Platform Error: ${response.status} - ${errorBody}`);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const contentLength = response.headers.get('content-length');
      const contentType = response.headers.get('content-type');
      
      if (contentLength === '0' || !contentType?.includes('application/json')) {
        return undefined as T;
      }

      const text = await response.text();
      if (!text || text.trim() === '') {
        return undefined as T;
      }

      return JSON.parse(text) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        logger.error('Voice AI Platform API timeout', { endpoint });
        throw new Error('Voice AI Platform request timed out');
      }
      throw error;
    }
  }

  isConfigured(): boolean {
    return !!(this.baseUrl && this.apiKey);
  }

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  async listAgents(): Promise<VoiceAgent[]> {
    return this.request<VoiceAgent[]>('/api/agents');
  }

  async createAgent(data: CreateAgentDto): Promise<VoiceAgent> {
    return this.request<VoiceAgent>('/api/agents', 'POST', data as unknown as Record<string, unknown>);
  }

  async getAgent(id: string): Promise<VoiceAgent> {
    return this.request<VoiceAgent>(`/api/agents/${id}`);
  }

  async updateAgent(id: string, data: UpdateAgentDto): Promise<VoiceAgent> {
    return this.request<VoiceAgent>(`/api/agents/${id}`, 'PATCH', data as unknown as Record<string, unknown>);
  }

  async deleteAgent(id: string): Promise<void> {
    await this.request<void>(`/api/agents/${id}`, 'DELETE');
  }

  async listCalls(params?: { limit?: number; offset?: number }): Promise<VoiceCall[]> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    const queryString = query.toString();
    return this.request<VoiceCall[]>(`/api/calls${queryString ? `?${queryString}` : ''}`);
  }

  async getCall(id: string): Promise<VoiceCall> {
    return this.request<VoiceCall>(`/api/calls/${id}`);
  }

  async testCall(data: TestCallDto): Promise<{ callId: string; status: string }> {
    return this.request<{ callId: string; status: string }>('/api/calls/test', 'POST', data as unknown as Record<string, unknown>);
  }

  async getAnalytics(): Promise<VoiceAnalytics> {
    return this.request<VoiceAnalytics>('/api/calls/analytics');
  }

  async getConfig(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/config');
  }

  async getConfigStatus(): Promise<ConfigStatus> {
    return this.request<ConfigStatus>('/api/config/status');
  }

  async testVoiceProvider(): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>('/api/config/test-voice-provider', 'POST');
  }

  async testTelephonyProvider(): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>('/api/config/test-telephony-provider', 'POST');
  }

  async testLLMProvider(): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>('/api/config/test-llm-provider', 'POST');
  }

  async listOrganizations(): Promise<Array<{ id: string; name: string }>> {
    return this.request<Array<{ id: string; name: string }>>('/api/organizations');
  }

  async listRetellAgents(): Promise<Array<{ agent_id: string; agent_name: string }>> {
    return this.request<Array<{ agent_id: string; agent_name: string }>>(
      '/api/integrations/retell/agents'
    );
  }

  async listTwilioPhoneNumbers(): Promise<Array<{ sid: string; phoneNumber: string; friendlyName: string }>> {
    return this.request<Array<{ sid: string; phoneNumber: string; friendlyName: string }>>(
      '/api/config/twilio/phone-numbers'
    );
  }

  async createCall(data: {
    externalCallId: string;
    agentId: string;
    direction: 'inbound' | 'outbound';
    fromNumber: string;
    toNumber: string;
    status?: string;
    metadata?: Record<string, unknown>;
  }): Promise<VoiceCall> {
    return this.request<VoiceCall>('/api/calls', 'POST', data as unknown as Record<string, unknown>);
  }

  async updateCall(callId: string, data: {
    status?: string;
    endedAt?: string;
    duration?: number;
    transcript?: Array<{ role: string; content: string; timestamp: number }>;
    recordingUrl?: string;
    summary?: string;
    qualityScore?: number;
    sentimentScore?: number;
    disconnectReason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<VoiceCall> {
    return this.request<VoiceCall>(`/api/calls/${callId}`, 'PATCH', data as unknown as Record<string, unknown>);
  }

  async syncCallFromWebhook(data: {
    externalCallId: string;
    agentId?: string;
    direction?: 'inbound' | 'outbound';
    fromNumber?: string;
    toNumber?: string;
    status?: string;
    endedAt?: string;
    duration?: number;
    transcript?: Array<{ role: string; content: string; timestamp: number }>;
    recordingUrl?: string;
    summary?: string;
    qualityScore?: number;
    sentimentScore?: number;
    disconnectReason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<VoiceCall | null> {
    try {
      const existingCalls = await this.listCalls({ limit: 100 });
      const existingCall = existingCalls.find(c => c.retellCallId === data.externalCallId);
      
      if (existingCall) {
        return this.updateCall(existingCall.id, {
          status: data.status,
          endedAt: data.endedAt,
          duration: data.duration,
          transcript: data.transcript,
          recordingUrl: data.recordingUrl,
          summary: data.summary,
          qualityScore: data.qualityScore,
          sentimentScore: data.sentimentScore,
          disconnectReason: data.disconnectReason,
          metadata: data.metadata,
        });
      } else if (data.agentId && data.fromNumber && data.toNumber) {
        return this.createCall({
          externalCallId: data.externalCallId,
          agentId: data.agentId,
          direction: data.direction || 'outbound',
          fromNumber: data.fromNumber,
          toNumber: data.toNumber,
          status: data.status,
          metadata: data.metadata,
        });
      }
      
      logger.warn('Cannot sync call - missing required fields', { externalCallId: data.externalCallId });
      return null;
    } catch (error) {
      logger.error('Failed to sync call from webhook', { 
        externalCallId: data.externalCallId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }
}

export const voiceAIPlatform = new VoiceAIPlatformClient();
