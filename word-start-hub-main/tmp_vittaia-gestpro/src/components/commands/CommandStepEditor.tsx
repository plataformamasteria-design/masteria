import React, { useRef } from 'react';
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
import { CommandStepFileUpload } from './CommandStepFileUpload';
import { VariablePicker } from '@/components/automations/VariablePicker';

interface CommandStep {
  id?: string;
  step_order: number;
  message_type: 'text' | 'audio' | 'image' | 'pdf' | 'video';
  content?: string;
  file_url?: string;
  file_name?: string;
}

interface CommandStepEditorProps {
  steps: CommandStep[];
  onChange: (steps: CommandStep[]) => void;
  organizationId: string;
}

function SortableStepItem({ 
  step, 
  index, 
  onUpdate, 
  onRemove, 
  canRemove,
  organizationId
}: { 
  step: CommandStep; 
  index: number; 
  onUpdate: (step: CommandStep) => void; 
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
  } = useSortable({ id: step.id || `step-${index}` });

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

        {/* Step Number */}
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">
          {index + 1}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-3">
          {/* Type Selector */}
          <Select
            value={step.message_type}
            onValueChange={(value: 'text' | 'audio' | 'image' | 'pdf' | 'video') => 
              onUpdate({ ...step, message_type: value, content: undefined, file_url: undefined, file_name: undefined })
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue>
                <span className="flex items-center gap-2">
                  {getTypeIcon(step.message_type)}
                  {step.message_type === 'text' && 'Texto'}
                  {step.message_type === 'audio' && 'Áudio'}
                  {step.message_type === 'image' && 'Imagem'}
                  {step.message_type === 'pdf' && 'PDF'}
                  {step.message_type === 'video' && 'Vídeo'}
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
          {step.message_type === 'text' ? (
            <div className="flex items-start gap-1">
              <Textarea
                placeholder="Digite a mensagem... Use {{campo}} para campos personalizados"
                value={step.content || ''}
                onChange={(e) => onUpdate({ ...step, content: e.target.value })}
                rows={2}
                className="flex-1"
              />
              <VariablePicker
                compact
                onInsert={(variable) => {
                  const newContent = (step.content || '') + variable;
                  onUpdate({ ...step, content: newContent });
                }}
              />
            </div>
          ) : (
            <CommandStepFileUpload
              type={step.message_type}
              fileUrl={step.file_url}
              fileName={step.file_name}
              organizationId={organizationId}
              onUpload={(url, name) => onUpdate({ ...step, file_url: url, file_name: name })}
              onRemove={() => onUpdate({ ...step, file_url: undefined, file_name: undefined })}
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

export function CommandStepEditor({ steps, onChange, organizationId }: CommandStepEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = steps.findIndex(s => (s.id || `step-${steps.indexOf(s)}`) === active.id);
      const newIndex = steps.findIndex(s => (s.id || `step-${steps.indexOf(s)}`) === over.id);

      const newSteps = arrayMove(steps, oldIndex, newIndex).map((step, index) => ({
        ...step,
        step_order: index + 1,
      }));

      onChange(newSteps);
    }
  };

  const addStep = () => {
    onChange([
      ...steps,
      {
        step_order: steps.length + 1,
        message_type: 'text',
        content: '',
      },
    ]);
  };

  const updateStep = (index: number, updatedStep: CommandStep) => {
    const newSteps = [...steps];
    newSteps[index] = updatedStep;
    onChange(newSteps);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    const newSteps = steps.filter((_, i) => i !== index).map((step, i) => ({
      ...step,
      step_order: i + 1,
    }));
    onChange(newSteps);
  };

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={steps.map((s, i) => s.id || `step-${i}`)}
          strategy={verticalListSortingStrategy}
        >
          {steps.map((step, index) => (
            <SortableStepItem
              key={step.id || `step-${index}`}
              step={step}
              index={index}
              onUpdate={(updated) => updateStep(index, updated)}
              onRemove={() => removeStep(index)}
              canRemove={steps.length > 1}
              organizationId={organizationId}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={addStep}
      >
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Mensagem
      </Button>
    </div>
  );
}
