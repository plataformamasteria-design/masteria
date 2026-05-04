'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { MoreHorizontal, Phone, Eye, Pencil, Trash2, MessageCircle, MoveRight, Clock, Video } from 'lucide-react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '../ui/dropdown-menu';
import type { KanbanCard as KanbanCardType, KanbanStage } from '@/lib/types';
import { EditLeadDialog, DeleteLeadDialog, ViewLeadDialog, AddMeetingTimeDialog } from './lead-dialogs';

interface KanbanCardProps {
  card: KanbanCardType;
  index: number;
  stages: KanbanStage[];
  onUpdate: (leadId: string, data: { stageId?: string; title?: string; value?: number | null; notes?: string }) => Promise<void>;
  onDelete: (leadId: string) => Promise<void>;
  onOpenWhatsApp?: (phone: string) => void;
}

export function KanbanCard({ card, index, stages, onUpdate, onDelete, onOpenWhatsApp }: KanbanCardProps) {
  const router = useRouter();
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [meetingTimeOpen, setMeetingTimeOpen] = useState(false);

  const handleMoveStage = async (stageId: string) => {
    await onUpdate(card.id, { stageId });
  };

  const handleOpenWhatsApp = () => {
    if (card.contact?.phone) {
      const cleanPhone = card.contact.phone.replace(/\D/g, '');
      router.push(`/atendimentos?phone=${cleanPhone}`);
    }
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

  return (
    <>
      <Draggable draggableId={card.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
          >
            <Card
              className={`cursor-pointer transition-all hover:shadow-md bg-card ${snapshot.isDragging ? 'shadow-lg rotate-1 scale-[1.02]' : ''
                }`}
            >
              <CardHeader className="p-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div
                    {...provided.dragHandleProps}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarImage src={card.contact?.avatarUrl || ''} alt={card.contact?.name || 'Lead'} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {(card.contact?.name || 'L').substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-tight truncate">{card.contact?.name || 'Lead sem nome'}</p>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 flex-shrink-0 opacity-60 hover:opacity-100"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => setViewOpen(true)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver Detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditOpen(true)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar Lead
                      </DropdownMenuItem>

                      {isCallStage && (
                        <DropdownMenuItem onClick={() => setMeetingTimeOpen(true)}>
                          <Clock className="mr-2 h-4 w-4" />
                          {hasMeetingTime ? 'Editar Horário' : 'Adicionar Horário'}
                        </DropdownMenuItem>
                      )}

                      {card.contact?.phone && (
                        <DropdownMenuItem onClick={handleOpenWhatsApp}>
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Abrir WhatsApp
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <MoveRight className="mr-2 h-4 w-4" />
                          Mover para
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {stages.filter(s => s.id !== card.stageId).map((stage) => (
                            <DropdownMenuItem
                              key={stage.id}
                              onClick={() => handleMoveStage(stage.id)}
                            >
                              {stage.title}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="p-3 pt-0 space-y-2">
                {(card.value !== null && card.value !== undefined && Number(card.value) > 0) && (
                  <Badge variant="secondary" className="text-xs font-medium">
                    R$ {Number(card.value).toLocaleString('pt-BR')}
                  </Badge>
                )}

                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {card.contact?.phone && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Phone className="h-3 w-3 flex-shrink-0 text-muted-foreground/70" />
                      <span className="truncate font-mono text-[11px]">{card.contact.phone}</span>
                    </div>
                  )}
                </div>

                {card.notes && card.notes.includes('📅 Reunião agendada:') && (() => {
                  const meetingText = card.notes.match(/📅 Reunião agendada:[^\n]*/)?.[0] || '';
                  const displayText = isCancelledStage
                    ? meetingText.replace('📅 Reunião agendada:', '🚫 Reunião cancelada:')
                    : meetingText;
                  const badgeColors = isCancelledStage
                    ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                    : 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
                  return (
                    <div className="flex items-center gap-1 w-fit max-w-full">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 max-w-full ${badgeColors}`}>
                        <span className="truncate">{displayText}</span>
                      </Badge>
                      {meetLink && !isCancelledStage && (
                        <a
                          href={meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-shrink-0"
                          title="Abrir Google Meet"
                        >
                          <Badge variant="outline" className="text-[10px] px-1 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer">
                            <Video className="h-3 w-3" />
                          </Badge>
                        </a>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}
      </Draggable>

      <ViewLeadDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        card={card}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        onOpenWhatsApp={handleOpenWhatsApp}
      />
      <EditLeadDialog open={editOpen} onOpenChange={setEditOpen} card={card} onSave={onUpdate} />
      <AddMeetingTimeDialog open={meetingTimeOpen} onOpenChange={setMeetingTimeOpen} card={card} onSave={onUpdate} />
      <DeleteLeadDialog open={deleteOpen} onOpenChange={setDeleteOpen} card={card} onConfirm={onDelete} />
    </>
  );
}
