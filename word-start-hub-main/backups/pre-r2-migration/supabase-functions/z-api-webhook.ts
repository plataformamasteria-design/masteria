import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract organization_id from URL query parameter
    const url = new URL(req.url);
    const organizationId = url.searchParams.get('organization_id');

    if (!organizationId) {
      console.error('[z-api-webhook] organization_id is required in URL');
      return new Response(
        JSON.stringify({ error: 'organization_id é obrigatório na URL como query parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[z-api-webhook] Processing webhook for organization:', organizationId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Received Z-API webhook:', JSON.stringify(body, null, 2));

    // Extract external message ID for deduplication
    const externalMessageId = body.messageId || body.message?.id || body.data?.header?.messageId || null;
    console.log('Extracted external_message_id:', externalMessageId);

    // Check for duplicate message in this organization
    if (externalMessageId) {
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('id')
        .eq('external_message_id', externalMessageId)
        .eq('organization_id', organizationId)
        .maybeSingle();
      
      if (existingMessage) {
        console.log('⚠️ Duplicate message detected, ignoring:', externalMessageId);
        return new Response(
          JSON.stringify({ success: true, message: 'Duplicate message ignored', external_message_id: externalMessageId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Extract phone number from Z-API payload
    const phone = body.phone;
    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find or create chat by phone for this organization
    let { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('phone', phone)
      .eq('organization_id', organizationId)
      .single();

    if (chatError && chatError.code !== 'PGRST116') {
      console.error('Error fetching chat:', chatError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch chat', details: chatError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new chat if doesn't exist
    if (!chat) {
      console.log('Creating new chat for phone:', phone, 'organization:', organizationId);
      
      // Detect if this is a group message
      const isGroup = body.isGroup === true || body.isGroupMsg === true || phone.includes('@g.us');
      
      const { data: newChat, error: createError } = await supabase
        .from('chats')
        .insert({
          phone: phone,
          wa_name: isGroup ? null : (body.chatName || body.senderName || phone),
          wa_photo_url: body.photo || body.senderPhoto || null,
          agent_off: false,
          organization_id: organizationId,
          // Group specific fields
          is_group: isGroup,
          group_name: isGroup ? (body.chatName || body.groupName || phone) : null,
          group_description: isGroup ? (body.groupDescription || null) : null,
          group_photo_url: isGroup ? (body.photo || body.groupPhoto || null) : null,
          participant_count: isGroup ? (body.participantCount || body.participants?.length || 0) : 0,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating chat:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create chat', details: createError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      chat = newChat;
      console.log('Created chat:', chat, 'isGroup:', isGroup);

      // Automatically add "Lead Frio" tag to new individual chats (not groups)
      if (!isGroup) {
        const { data: leadFrioTag } = await supabase
          .from('tags')
          .select('id')
          .eq('organization_id', organizationId)
          .ilike('name', 'Lead Frio')
          .maybeSingle();

        if (leadFrioTag) {
          await supabase
            .from('chat_tags')
            .insert({
              chat_id: chat.id,
              tag_id: leadFrioTag.id,
              organization_id: organizationId,
            });
          console.log('Added "Lead Frio" tag to new chat:', chat.id);
        }
      }
    } else {
      // Determine if message is from the company or lead
      // fromMe = true significa que foi enviada por nós (empresa), is_from_user = true
      // fromMe = false significa que foi recebida do lead, is_from_user = false
      const isFromUser = body.fromMe === true || body.fromMe === 'true' || body.fromMe === 1;
      const isGroup = chat.is_group === true;
      
      // Update chat info if it exists
      console.log('Updating existing chat:', chat.id, 'isGroup:', isGroup);
      
      const updateData: any = {
        wa_photo_url: body.photo || body.senderPhoto || chat.wa_photo_url,
      };
      
      if (isGroup) {
        // Update group specific fields
        if (body.chatName || body.groupName) updateData.group_name = body.chatName || body.groupName;
        if (body.groupDescription) updateData.group_description = body.groupDescription;
        if (body.participantCount || body.participants?.length) {
          updateData.participant_count = body.participantCount || body.participants?.length;
        }
        if (body.photo || body.groupPhoto) updateData.group_photo_url = body.photo || body.groupPhoto;
      } else {
        // Only update name if message is FROM the lead (is_from_user = false)
        if (!isFromUser) {
          updateData.wa_name = body.chatName || body.senderName || chat.wa_name;
        }
      }
      
      await supabase
        .from('chats')
        .update(updateData)
        .eq('id', chat.id);
    }

    // Insert message

    // Helper function to upload base64 to Supabase Storage
    const uploadBase64ToStorage = async (base64Data: string, fileName: string, mimeType: string) => {
      try {
        // Remove data:mime;base64, prefix if present
        const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
        
        // Decode base64 to binary
        const binaryString = atob(base64Clean);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Create file path
        const fileExt = fileName.split('.').pop() || 'bin';
        const filePath = `${chat.id}/${Date.now()}.${fileExt}`;
        
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('chat-files')
          .upload(filePath, bytes, {
            contentType: mimeType,
            upsert: false
          });
        
        if (uploadError) {
          console.error('Error uploading to storage:', uploadError);
          return null;
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('chat-files')
          .getPublicUrl(filePath);
        
        return publicUrl;
      } catch (error) {
        console.error('Error processing base64:', error);
        return null;
      }
    };

    // Determine message type and extract content
    let messageType = 'text';
    let content = null;
    let fileUrl = null;
    let fileName = null;
    let fileSize = null;

    // Helper to extract phone from vcard
    const extractPhoneFromVcard = (vcard: string): string => {
      const match = vcard.match(/waid=(\d+)/);
      return match ? `+${match[1]}` : '';
    };

    if (body.text?.message) {
      messageType = 'text';
      content = body.text.message;
    } else if (body.image?.imageUrl || body.image?.imageBase64) {
      messageType = 'image';
      if (body.image.imageBase64) {
        fileUrl = await uploadBase64ToStorage(body.image.imageBase64, body.image.caption || 'image.jpg', 'image/jpeg');
      } else {
        fileUrl = body.image.imageUrl;
      }
      fileName = body.image.caption || 'image.jpg';
      content = body.image.caption || null;
    } else if (body.audio?.audioUrl || body.audio?.audioBase64) {
      messageType = 'audio';
      if (body.audio.audioBase64) {
        fileUrl = await uploadBase64ToStorage(body.audio.audioBase64, 'audio.mp3', 'audio/mpeg');
      } else {
        fileUrl = body.audio.audioUrl;
      }
      fileName = 'audio.mp3';
    } else if (body.document?.documentUrl || body.document?.documentBase64) {
      const docFileName = body.document.fileName || 'document';
      if (docFileName.toLowerCase().endsWith('.pdf')) {
        messageType = 'pdf';
      } else {
        messageType = 'document';
      }
      if (body.document.documentBase64) {
        const mimeType = messageType === 'pdf' ? 'application/pdf' : 'application/octet-stream';
        fileUrl = await uploadBase64ToStorage(body.document.documentBase64, docFileName, mimeType);
      } else {
        fileUrl = body.document.documentUrl;
      }
      fileName = docFileName;
      fileSize = body.document.fileSize || null;
    } else if (body.video?.videoUrl || body.video?.videoBase64) {
      messageType = 'video';
      if (body.video.videoBase64) {
        fileUrl = await uploadBase64ToStorage(body.video.videoBase64, body.video.caption || 'video.mp4', 'video/mp4');
      } else {
        fileUrl = body.video.videoUrl;
      }
      fileName = body.video.caption || 'video.mp4';
      content = body.video.caption || null;
    } else if (body.message?.contactMessage || body.contactMessage) {
      // Contact message
      messageType = 'contact';
      const contactMsg = body.message?.contactMessage || body.contactMessage;
      const phone = extractPhoneFromVcard(contactMsg.vcard || '');
      content = JSON.stringify({
        display_name: contactMsg.displayName || 'Contato',
        phone: phone,
        vcard: contactMsg.vcard
      });
    } else if (body.message?.locationMessage || body.locationMessage || body.data?.message?.locationMessage) {
      // Location message
      messageType = 'location';
      const locMsg = body.message?.locationMessage || body.locationMessage || body.data?.message?.locationMessage;
      content = JSON.stringify({
        latitude: locMsg.degreesLatitude,
        longitude: locMsg.degreesLongitude,
        name: locMsg.name || null,
        address: locMsg.address || null
      });
    } else if (body.message?.interactiveMessage?.nativeFlowMessage?.buttons || body.data?.message?.interactiveMessage?.nativeFlowMessage?.buttons) {
      // Check for PIX message
      const buttons = body.message?.interactiveMessage?.nativeFlowMessage?.buttons || body.data?.message?.interactiveMessage?.nativeFlowMessage?.buttons;
      const pixButton = buttons?.find((b: any) => b.name === 'payment_info');
      if (pixButton) {
        messageType = 'pix';
        try {
          const pixParams = JSON.parse(pixButton.buttonParamsJson);
          const pixSettings = pixParams.payment_settings?.[0]?.pix_static_code;
          content = JSON.stringify({
            key: pixSettings?.key || '',
            key_type: pixSettings?.key_type || '',
            merchant_name: pixSettings?.merchant_name || 'PIX',
            reference_id: pixParams.reference_id || null
          });
        } catch (e) {
          content = JSON.stringify({ key: '', key_type: '', merchant_name: 'PIX' });
        }
      }
    }

    // Determine if message is from user/lead (reuse if already calculated, or calculate now)
    // fromMe = true significa que foi enviada por nós (empresa)
    // fromMe = false significa que foi recebida do lead/participante
    const isFromUser = body.fromMe === true || body.fromMe === 'true' || body.fromMe === 1;
    const isGroupMessage = chat.is_group === true;
    
    // Extract sender name for group messages - apenas para msgs recebidas (fromMe: false)
    let senderName = null;
    if (isGroupMessage && !isFromUser) {
      // Extrair nome do remetente de diferentes formatos de payload
      senderName = body.senderName || 
                   body.participant?.name || 
                   body.pushname || 
                   body.notifyName ||
                   body.sender?.pushname ||
                   body.sender?.name ||
                   null;
      console.log('[z-api-webhook] Group message sender:', senderName);
    }
    
    // If message is from company (fromMe: true) and is text without signature, add generic signature
    if (isFromUser && messageType === 'text' && content && !content.includes('*')) {
      content = `*Equipe*\n${content}`;
      console.log('Added generic signature to company message:', content);
    }
    
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        chat_id: chat.id,
        content: content,
        message_type: messageType,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        is_from_user: isFromUser,
        external_message_id: externalMessageId,
        organization_id: organizationId,
        sender_name: senderName,
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating message:', messageError);
      return new Response(
        JSON.stringify({ error: 'Failed to create message', details: messageError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created message:', message);

    return new Response(
      JSON.stringify({
        success: true,
        chat_id: chat.id,
        message_id: message.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
