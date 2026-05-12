import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tags, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface MultiTagFilterProps {
  tags: Tag[];
  selectedTags: string[];
  onSelectedTagsChange: (tagIds: string[]) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export const MultiTagFilter: React.FC<MultiTagFilterProps> = ({
  tags,
  selectedTags,
  onSelectedTagsChange,
  placeholder = "Filtrar por etiquetas",
  className,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);

  const handleTagToggle = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onSelectedTagsChange(selectedTags.filter(id => id !== tagId));
    } else {
      onSelectedTagsChange([...selectedTags, tagId]);
    }
  };

  const clearAllTags = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectedTagsChange([]);
  };

  const selectedTagObjects = tags.filter(tag => selectedTags.includes(tag.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between gap-2 h-10",
            compact ? "w-auto min-w-[140px]" : "w-full sm:w-[220px]",
            className
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Tags className="h-4 w-4 shrink-0 text-muted-foreground" />
            {selectedTags.length === 0 ? (
              <span className="text-muted-foreground truncate">{placeholder}</span>
            ) : (
              <div className="flex items-center gap-1 min-w-0">
                {selectedTagObjects.slice(0, compact ? 1 : 2).map(tag => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="text-xs py-0 px-1.5 truncate max-w-[60px]"
                    style={{
                      backgroundColor: tag.color + '20',
                      color: tag.color,
                      borderColor: tag.color + '50',
                    }}
                  >
                    {tag.name}
                  </Badge>
                ))}
                {selectedTags.length > (compact ? 1 : 2) && (
                  <Badge variant="secondary" className="text-xs py-0 px-1.5">
                    +{selectedTags.length - (compact ? 1 : 2)}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {selectedTags.length > 0 && (
              <X
                className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={clearAllTags}
              />
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0 z-50 bg-popover" align="start">
        <div className="p-2 border-b border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Etiquetas</span>
            {selectedTags.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => onSelectedTagsChange([])}
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-[250px]">
          <div className="p-2 space-y-1">
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhuma etiqueta disponível
              </p>
            ) : (
              tags.map(tag => (
                <label
                  key={tag.id}
                  className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted transition-colors"
                >
                  <Checkbox
                    checked={selectedTags.includes(tag.id)}
                    onCheckedChange={() => handleTagToggle(tag.id)}
                  />
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm truncate flex-1">{tag.name}</span>
                </label>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
