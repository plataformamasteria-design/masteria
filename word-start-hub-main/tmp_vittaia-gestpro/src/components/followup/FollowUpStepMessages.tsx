import React from 'react';
import { Plus, GripVertical, Trash2, MessageSquare, Mic, Image, FileText, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { CommandStepFileUpload } from '../commands/CommandStepFileUpload';

export interface FollowUpMessage {
  id?: string;
  message_order: number;
  message_type: 'text' | 'audio' | 'image' | 'pdf' | 'video';
  content?: string;
  file_url?: string;
  file_name?: string;
}

interface FollowUpStepMessagesProps {
  messages: FollowUpMessage[];
  onChange: (messages: FollowUpMessage[]) => void;
  organizationId: string;
}

function SortableMessageItem({ 
  message, 
  index, 
  onUpdate, 
  onRemove, 
  canRemove,
  organizationId
}: { 
  message: FollowUpMessage; 
  index: number; 
  onUpdate: (message: FollowUpMessage) => void; 
  onRemove: () => void;
  canRemove: boolean;
  organizationId: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: message.id || `msg-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return <MessageSquare className="h-4 w-4" />;
      case 'audio': return <Mic className="h-4 w-4" />;
      case 'image': return <Image className="h-4 w-4" />;
      case 'pdf': return <FileText className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'p-4 transition-shadow',
        isDragging && 'shadow-lg ring-2 ring-primary/20 opacity-90'
      )}
    >
      <div className="flex gap-3">
        {/* Drag Handle */}
        <button
          type="button"
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Message Number */}
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">
          {index + 1}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-3">
          {/* Type Selector */}
          <Select
            value={message.message_type}
            onValueChange={(value: 'text' | 'audio' | 'image' | 'pdf' | 'video') => 
              onUpdate({ ...message, message_type: value, content: undefined, file_url: undefined, file_name: undefined })
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue>
                <span className="flex items-center gap-2">
                  {getTypeIcon(message.message_type)}
                  {message.message_type === 'text' && 'Texto'}
                  {message.message_type === 'audio' && 'Áudio'}
                  {message.message_type === 'image' && 'Imagem'}
                  {message.message_type === 'pdf' && 'PDF'}
                  {message.message_type === 'video' && 'Vídeo'}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Texto
                </span>
              </SelectItem>
              <SelectItem value="audio">
                <span className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Áudio
                </span>
              </SelectItem>
              <SelectItem value="image">
                <span className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Imagem
                </span>
              </SelectItem>
              <SelectItem value="video">
                <span className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Vídeo
                </span>
              </SelectItem>
              <SelectItem value="pdf">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  PDF
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Content Input based on type */}
          {message.message_type === 'text' ? (
            <Textarea
              placeholder="Digite a mensagem..."
              value={message.content || ''}
              onChange={(e) => onUpdate({ ...message, content: e.target.value })}
              rows={2}
            />
          ) : (
            <CommandStepFileUpload
              type={message.message_type}
              fileUrl={message.file_url}
              fileName={message.file_name}
              organizationId={organizationId}
              onUpload={(url, name) => onUpdate({ ...message, file_url: url, file_name: name })}
              onRemove={() => onUpdate({ ...message, file_url: undefined, file_name: undefined })}
            />
          )}
        </div>

        {/* Remove Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
          onClick={onRemove}
          disabled={!canRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

export function FollowUpStepMessages({ messages, onChange, organizationId }: FollowUpStepMessagesProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = messages.findIndex(m => (m.id || `msg-${messages.indexOf(m)}`) === active.id);
      const newIndex = messages.findIndex(m => (m.id || `msg-${messages.indexOf(m)}`) === over.id);

      const newMessages = arrayMove(messages, oldIndex, newIndex).map((msg, index) => ({
        ...msg,
        message_order: index + 1,
      }));

      onChange(newMessages);
    }
  };

  const addMessage = () => {
    onChange([
      ...messages,
      {
        message_order: messages.length + 1,
        message_type: 'text',
        content: '',
      },
    ]);
  };

  const updateMessage = (index: number, updatedMessage: FollowUpMessage) => {
    const newMessages = [...messages];
    newMessages[index] = updatedMessage;
    onChange(newMessages);
  };

  const removeMessage = (index: number) => {
    if (messages.length <= 1) return;
    const newMessages = messages.filter((_, i) => i !== index).map((msg, i) => ({
      ...msg,
      message_order: i + 1,
    }));
    onChange(newMessages);
  };

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={messages.map((m, i) => m.id || `msg-${i}`)}
          strategy={verticalListSortingStrategy}
        >
          {messages.map((message, index) => (
            <SortableMessageItem
              key={message.id || `msg-${index}`}
              message={message}
              index={index}
              onUpdate={(updated) => updateMessage(index, updated)}
              onRemove={() => removeMessage(index)}
              canRemove={messages.length > 1}
              organizationId={organizationId}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={addMessage}
      >
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Mensagem
      </Button>
    </div>
  );
}
