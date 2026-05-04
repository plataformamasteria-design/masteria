/**
 * Types for incoming webhook events from external platforms
 * Supports Grapfy, custom integrations, and other platforms
 */

export type IncomingEventType =
  | 'lead.created'
  | 'lead.updated'
  | 'lead.qualified'
  | 'contact.created'
  | 'contact.updated'
  | 'contact.deleted'
  | 'message.received'
  | 'form.submitted'
  | 'conversion.completed'
  | 'pix_created'
  | 'order_approved'
  | 'custom';

export interface GrapfyPixCreatedPayload {
  eventId: string;
  eventType: 'pix_created';
  orderId: string;
  storeId: string;
  code: string;
  total: number;
  qrCode: string;
  pixExpirationAt: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string;
    document: string;
  };
  product: {
    id: string;
    name: string;
    quantity: number;
  };
  plan?: {
    id: string;
    name: string;
  };
  metadata?: {
    deviceType?: string;
    browser?: string;
    operationalSystem?: string;
  };
  createdAt: string;
  trankingParameters?: {
    utm_campaign?: string;
    utm_content?: string;
    utm_medium?: string;
    utm_source?: string;
    utm_term?: string;
  };
}

export interface GrapfyOrderApprovedPayload {
  eventId: string;
  eventType: 'order_approved';
  orderId: string;
  storeId: string;
  total: number;
  customer: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string;
    document: string;
  };
  product: {
    id: string;
    name: string;
  };
  plan?: {
    id: string;
    name: string;
  };
  approvedAt: string;
}

export interface IncomingWebhookPayload {
  event_type: IncomingEventType;
  timestamp: number;
  data: Record<string, any>;
  metadata?: {
    source?: string;
    campaignId?: string;
    userId?: string;
    trackingId?: string;
  };
}

export interface IncomingWebhookEvent {
  id: string;
  companyId: string;
  source: string;
  eventType: IncomingEventType;
  payload: IncomingWebhookPayload;
  headers?: Record<string, any>;
  ipAddress?: string;
  signatureValid: boolean;
  processedAt?: Date;
  createdAt: Date;
}

export interface IncomingWebhookConfig {
  id: string;
  companyId: string;
  name: string;
  source: string;
  secret: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookSignatureHeaders {
  signature: string;
  timestamp: string;
  nonce?: string;
}

export interface WebhookValidationResult {
  valid: boolean;
  reason?: string;
  timestamp?: number;
}
