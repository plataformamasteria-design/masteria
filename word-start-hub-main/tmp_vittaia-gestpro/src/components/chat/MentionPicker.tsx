import React, { useEffect, useState, useRef, useMemo } from 'react';
import { AtSign, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { cn } from '@/lib/utils';
import { formatBrPhoneFromDigits } from '@/lib/group-participants';

interface Participant {
  id: string;
  phone: string;       // Real phone number (participant_phone)
  jid: string;         // Full JID for mentions (participant_jid)
  name: string | null;
  isAdmin: boolean;
}

interface MentionPickerProps {
  filter: string;
  chatId: string;
  onSelect: (participant: Participant) => void;
  onClose: () => void;
  visible: boolean;
}

export function MentionPicker({ filter, chatId, onSelect, onClose, visible }: MentionPickerProps) {
  const { currentOrganization } = useOrganization();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentOrganization?.id && visible && chatId) {
      fetchParticipants();
    }
  }, [currentOrganization?.id, visible, chatId]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const filteredParticipants = getFilteredParticipants();
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredParticipants.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredParticipants.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredParticipants[selectedIndex]) {
            onSelect(filteredParticipants[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, selectedIndex, filter, participants, onSelect, onClose]);

  const fetchParticipants = async () => {
    if (!currentOrganization?.id || !chatId) return;

    setLoading(true);
    try {
      // Fetch group participants - include ALL participants for mentions
      // Even those without phone numbers can be mentioned via their JID
      const { data, error } = await supabase
        .from('group_participants')
        .select('id, participant_jid, participant_phone, display_name, is_admin')
        .eq('group_chat_id', chatId)
        .order('is_admin', { ascending: false })
        .order('display_name', { ascending: true, nullsFirst: false })
        .limit(100);

      if (error) throw error;

      // Map all participants - include those with LID-only JIDs for mentions
      // JID is required for WhatsApp mentions to work correctly
      const mapped: Participant[] = (data || [])
        .filter(p => {
          // Must have a JID to enable mentions (works with both LIDs and real phone JIDs)
          return p.participant_jid && p.participant_jid.length > 0;
        })
        .map(p => ({
          id: p.id,
          // phone might be null for LID-only participants - that's OK for mentions
          phone: p.participant_phone || '',
          jid: p.participant_jid,
          name: p.display_name,
          isAdmin: p.is_admin,
        }));

      console.log('[MentionPicker] Loaded', mapped.length, 'participants for mentions');
      setParticipants(mapped);
    } catch (error) {
      console.error('Error fetching participants:', error);
      setParticipants([]);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredParticipants = useMemo(() => {
    return () => {
      // Remove @ prefix and normalize
      const normalizedFilter = filter.toLowerCase().replace(/^@/, '').trim();
      
      if (!normalizedFilter) return participants;
      
      return participants.filter(p => {
        const nameMatch = p.name?.toLowerCase().includes(normalizedFilter);
        const phoneMatch = p.phone.includes(normalizedFilter);
        return nameMatch || phoneMatch;
      });
    };
  }, [filter, participants]);

  if (!visible) return null;

  const filteredParticipants = getFilteredParticipants();

  return (
    <div 
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50"
    >
      <div className="p-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AtSign className="h-4 w-4" />
          <span>Mencionar participante</span>
        </div>
      </div>

      {loading ? (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : filteredParticipants.length === 0 ? (
        <div className="p-4 text-center text-sm text-muted-foreground">
          {filter.length > 1 
            ? 'Nenhum participante encontrado'
            : 'Nenhum participante no grupo'}
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          {filteredParticipants.map((participant, index) => (
            <button
              key={participant.id}
              type="button"
              className={cn(
                'w-full flex items-start gap-3 p-3 text-left transition-colors',
                index === selectedIndex 
                  ? 'bg-primary/10' 
                  : 'hover:bg-muted/50'
              )}
              onClick={() => onSelect(participant)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
                <User className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {participant.name ? (
                    <p className="text-sm font-medium text-foreground truncate">
                      {participant.name}
                    </p>
                  ) : null}
                  {participant.isAdmin && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      Admin
                    </span>
                  )}
                </div>
                {participant.phone && participant.phone.length >= 8 ? (
                  <p className="text-xs text-muted-foreground">
                    {formatBrPhoneFromDigits(participant.phone)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Número não disponível
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="p-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
        ↑↓ navegar • Enter selecionar • Esc fechar
      </div>
    </div>
  );
}
