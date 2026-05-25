'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import { MoreHorizontal, Phone, Eye, Pencil, Trash2, MessageCircle, MoveRight, Clock, Video } from 'lucide-react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '../ui/dropdown-menu';
import type { KanbanCard as KanbanCardType, KanbanStage } from '@/lib/types';
import { DeleteLeadDialog, AddMeetingTimeDialog } from './lead-dialogs';
import { LeadExpansiveDrawer } from './lead-expansive-drawer';
import { FirstContactTimer } from './first-contact-timer';

interface KanbanCardProps {
  card: KanbanCardType;
  index: number;
  stages: KanbanStage[];
  onUpdate: (leadId: string, data: { stageId?: string; title?: string; value?: number | null; notes?: string }) => Promise<void>;
  onDelete: (leadId: string) => Promise<void>;
  onOpenWhatsApp?: (phone: string) => void;
  onUpdateCards?: () => void;
  companyUsers?: any[];
}

export function KanbanCard({ card, index, stages, onUpdate, onDelete, onOpenWhatsApp, onUpdateCards, companyUsers = [] }: KanbanCardProps) {
  const router = useRouter();
  const [viewOpen, setViewOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<'overview' | 'chat'>('overview');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [meetingTimeOpen, setMeetingTimeOpen] = useState(false);

  const handleMoveStage = async (stageId: string) => {
    await onUpdate(card.id, { stageId });
  };

  const handleOpenWhatsApp = () => {
    setInitialTab('chat');
    setViewOpen(true);
  };

  const hasMeetingTime = card.notes?.includes('📅 Reunião agendada:');
  const meetLinkMatch = card.notes?.match(/Meet:\s*(https:\/\/meet\.google\.com\/[^\s\n]+)/);
  const meetLink = meetLinkMatch?.[1] || null;

  const currentStage = stages.find(s => s.id === card.stageId);
  const stageTitle = currentStage?.title?.toLowerCase() ?? '';
  const isCancelledStage = currentStage?.semanticType === 'meeting_cancelled' ||
    stageTitle.includes('desmarcad') ||
    stageTitle.includes('cancelad');
  const isCallStage = isCancelledStage ||
    stageTitle.includes('call') ||
    stageTitle.includes('agendad') ||
    stageTitle.includes('reunião') ||
    stageTitle.includes('ligação');

  // Preparar dados do contato e tags
  const contact = card.contact as any;
  let customFields = {};
  try {
    if (typeof contact?.customFields === 'string') {
      customFields = JSON.parse(contact.customFields);
    } else if (contact?.customFields && typeof contact.customFields === 'object') {
      customFields = contact.customFields;
    }
  } catch(e) {}
  const tags = contact?.tags || [];
  const displayTags = tags.slice(0, 2);
  const remainingTags = tags.length > 2 ? tags.length - 2 : 0;
  
  const hasCustomFields = Object.keys(customFields).length > 0;
  const createdAtFormatted = card.createdAt ? (() => {
    const d = new Date(card.createdAt);
    const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${date} • ${time}`;
  })() : '';

  // Resolver agente atribuído via conversa
  const assignedUserId = (card as any).conversation?.assignedTo;
  const assignedUser = assignedUserId
    ? companyUsers.find((u: any) => u.id === assignedUserId)
    : null;

  return (
    <>
      <Draggable draggableId={card.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
          >
            <Card
              onClick={() => { setInitialTab('overview'); setViewOpen(true); }}
              className={`cursor-pointer transition-all duration-200 rounded-lg ${
                snapshot.isDragging 
                  ? 'bg-background dark:bg-zinc-900/90 shadow-xl scale-[1.02] rotate-1 ring-1 ring-primary/20 z-50' 
                  : 'bg-white dark:bg-zinc-950 shadow-sm border border-border/40 hover:border-border/80 hover:shadow-md'
              }`}
            >
              <div className="p-3 flex flex-col gap-2 relative group">
                {/* Linha 1: Nome, Handle e Menu */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="font-bold text-[13px] text-foreground truncate">
                      {contact?.name || 'Lead sem nome'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-muted-foreground hidden md:block">{createdAtFormatted}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => { setInitialTab('overview'); setViewOpen(true); }}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar / Detalhes
                        </DropdownMenuItem>
                        {isCallStage && (
                          <DropdownMenuItem onClick={() => setMeetingTimeOpen(true)}>
                            <Clock className="mr-2 h-4 w-4" /> {hasMeetingTime ? 'Editar Horário' : 'Adicionar Horário'}
                          </DropdownMenuItem>
                        )}
                        {contact?.phone && (
                          <DropdownMenuItem onClick={handleOpenWhatsApp}>
                            <MessageCircle className="mr-2 h-4 w-4" /> Abrir WhatsApp
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <MoveRight className="mr-2 h-4 w-4" /> Mover para
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {stages.filter(s => s.id !== card.stageId).map((stage) => (
                              <DropdownMenuItem key={stage.id} onClick={() => handleMoveStage(stage.id)}>
                                {stage.title}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-red-500 dark:text-red-400 focus:text-red-500 focus:bg-red-500/10">
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Linha 2: Título da Oportunidade */}
                <div className="flex items-center min-w-0">
                  <span className="text-[12px] text-muted-foreground/90 truncate">
                    {card.title || 'Oportunidade'}
                  </span>
                </div>

                {/* Campos Personalizados */}
                {hasCustomFields && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {Object.entries(customFields).map(([k, v]) => {
                      if (!v) return null;
                      return (
                        <span key={k} className="text-[9px] bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded border border-border/40 truncate max-w-[120px]">
                          {k}: {String(v)}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Etiquetas — sempre visíveis quando existem */}
                {displayTags.length > 0 && (
                  <div className="flex items-center flex-wrap gap-1">
                    {displayTags.map((tag: any) => (
                      <div
                        key={tag.id}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border"
                        style={{
                          backgroundColor: tag.color ? `${tag.color}18` : undefined,
                          borderColor: tag.color ? `${tag.color}40` : undefined,
                          color: tag.color || undefined,
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || '#888' }} />
                        {tag.name}
                      </div>
                    ))}
                    {remainingTags > 0 && (
                      <div className="border border-border/50 bg-muted/30 text-muted-foreground px-1.5 py-0.5 rounded-full text-[9px]">
                        +{remainingTags}
                      </div>
                    )}
                  </div>
                )}

                {/* Linha inferior: valor (se não tiver tags) e status */}
                <div className="flex items-center justify-between gap-2 mt-1">
                  <div className="flex items-center gap-1 min-w-0">
                    {displayTags.length === 0 && (card.value !== null && card.value !== undefined && Number(card.value) > 0) && (
                      <div className="border border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded text-[10px]">
                        R$ {Number(card.value).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                    <span className="text-[10px] text-amber-600 dark:text-yellow-500/90 font-medium">Sem Tarefas</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-yellow-500"></div>
                  </div>
                </div>

                {/* Rodapé: Agente atribuído + Cronômetro */}
                {(assignedUser || card.createdAt) && (
                  <div className="flex items-center justify-between gap-1.5 mt-1 pt-1.5 border-t border-border/30">
                    {/* Agente */}
                    {assignedUser ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        {assignedUser.avatarUrl ? (
                          <img
                            src={assignedUser.avatarUrl}
                            alt={assignedUser.name}
                            className="w-4 h-4 rounded-full object-cover flex-shrink-0 ring-1 ring-border/40"
                          />
                        ) : (
                          <div className="w-4 h-4 rounded-full flex-shrink-0 bg-primary/20 flex items-center justify-center ring-1 ring-border/40">
                            <span className="text-[8px] font-bold text-primary">
                              {(assignedUser.name || '?')[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="text-[10px] text-muted-foreground truncate">{assignedUser.name || assignedUser.email}</span>
                      </div>
                    ) : <div />}

                    {/* Cronômetro de primeiro contato */}
                    {card.createdAt && (
                      <FirstContactTimer
                        leadCreatedAt={card.createdAt}
                        firstMessageAt={(card as any).firstMessageAt ?? null}
                        compact
                      />
                    )}
                  </div>
                )}

                {card.notes && card.notes.includes('📅 Reunião agendada:') && (() => {
                  const meetingText = card.notes.match(/📅 Reunião agendada:[^\n]*/)?.[0] || '';
                  const displayText = isCancelledStage
                    ? meetingText.replace('📅 Reunião agendada:', '🚫 Reunião cancelada:')
                    : meetingText;
                  const badgeColors = isCancelledStage
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                    : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
                  return (
                    <div className="flex items-center gap-1 mt-2 border-t border-border/40 pt-2 w-full">
                      <div className={`text-[10px] px-1.5 py-0.5 rounded border max-w-[85%] truncate ${badgeColors}`}>
                        {displayText}
                      </div>
                      {meetLink && !isCancelledStage && (
                        <a
                          href={meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-shrink-0 border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded px-1.5 py-0.5 hover:bg-blue-500/20 transition-colors"
                          title="Abrir Google Meet"
                        >
                          <Video className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  );
                })()}
              </div>
            </Card>
          </div>
        )}
      </Draggable>

      <LeadExpansiveDrawer
        open={viewOpen}
        onOpenChange={setViewOpen}
        card={card}
        stages={stages}
        initialTab={initialTab}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onOpenWhatsApp={handleOpenWhatsApp}
      />
      <AddMeetingTimeDialog open={meetingTimeOpen} onOpenChange={setMeetingTimeOpen} card={card} onSave={onUpdate} />
      <DeleteLeadDialog open={deleteOpen} onOpenChange={setDeleteOpen} card={card} onConfirm={onDelete} />
    </>
  );
}
