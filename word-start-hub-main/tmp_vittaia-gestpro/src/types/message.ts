export interface Message {
  id: string;
  chat_id: string;
  content: string | null;
  message_type: 'text' | 'audio' | 'image' | 'pdf' | 'video' | 'document' | 'system' | 'contact' | 'location' | 'pix';
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_mime_type?: string | null;
  is_from_user: boolean;
  created_at: string;
  read_at: string | null;
  delivered_at: string | null;
  failed_at?: string | null;
  error_message?: string | null;

  // Sync with WhatsApp / backend
  external_message_id?: string | null;
  platform_deleted_at?: string | null;

  // Quoted replies
  quoted_message_id?: string | null;
  quoted_external_message_id?: string | null;
  quoted_preview?: any;

  private?: boolean;
  sent_by?: string;
  sender_name?: string | null;

  // Group sender identification (for opening the lead card from group messages)
  sender_phone?: string | null;
  sender_jid?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  sent_from_platform?: boolean | null;
  reactions?: Array<{ emoji: string; participant: string; }>;
}

export interface ContactData {
  display_name: string;
  phone: string;
  vcard?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface PixData {
  key: string;
  key_type: string;
  merchant_name: string;
  reference_id?: string;
}

export interface MessagesByDay {
  date: string;
  messages: Message[];
}
