'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Edit, MoreVertical, Trash2, Copy, BarChart3 } from 'lucide-react';

interface TemplateCategory {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
}

interface Template {
  id: string;
  name: string;
  content: string;
  categoryId?: string | null;
  category?: TemplateCategory | null;
  variables: string[];
  usageCount: number;
  active: boolean;
  isPredefined: boolean;
}

interface TemplateCardProps {
  template: Template;
  onEdit: (template: Template) => void;
  onDelete: (template: Template) => void;
  onUse: (template: Template) => void;
}

export function TemplateCard({
  template,
  onEdit,
  onDelete,
  onUse,
}: TemplateCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const truncateContent = (content: string, maxLength = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(template.content);
  };

  return (
    <Card className="group hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate mb-1">{template.name}</h3>
            {template.category && (
              <Badge variant="outline" className="mb-2">
                {template.category.icon && (
                  <span className="mr-1">{template.category.icon}</span>
                )}
                {template.category.name}
              </Badge>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onUse(template)}>
                <Copy className="mr-2 h-4 w-4" />
                Usar Template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyContent}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar Conteúdo
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onEdit(template)}
                disabled={template.isPredefined}
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(template)}
                disabled={template.isPredefined}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <p className={isExpanded ? '' : 'line-clamp-3'}>
              {isExpanded ? template.content : truncateContent(template.content)}
            </p>
            {template.content.length > 100 && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs mt-1"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? 'Ver menos' : 'Ver mais'}
              </Button>
            )}
          </div>

          {template.variables.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.variables.map((variable) => (
                <Badge
                  key={variable}
                  variant="secondary"
                  className="text-xs font-mono"
                >
                  {`{{${variable}}}`}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <BarChart3 className="h-4 w-4" />
          <span>{template.usageCount} uso{template.usageCount !== 1 ? 's' : ''}</span>
        </div>
        <Button size="sm" onClick={() => onUse(template)}>
          Usar Template
        </Button>
      </CardFooter>
    </Card>
  );
}
