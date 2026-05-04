'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Image as ImageIcon, 
  Video, 
  FileText, 
  Phone, 
  ExternalLink,
  Copy,
  Globe
} from 'lucide-react';

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'PHONE_NUMBER' | 'URL' | 'COPY_CODE';
    text: string;
    phone_number?: string;
    url?: string;
    example?: string[];
  }>;
  example?: {
    header_text?: string[];
    header_handle?: string[];
    body_text?: string[][];
  };
}

interface TemplatePreviewProps {
  components: TemplateComponent[];
  variableMappings?: Record<string, { type: 'dynamic' | 'fixed'; value: string }>;
  contactFieldsMap?: Record<string, string>; // Para mostrar os nomes dos campos dinâmicos
  mediaUrl?: string | null;
  className?: string;
  compact?: boolean; // Modo compacto para caber em espaços menores
}

const CONTACT_SAMPLE_DATA: Record<string, string> = {
  name: 'João Silva',
  phone: '(11) 99999-9999',
  email: 'joao@exemplo.com',
  company: 'Exemplo Ltda',
  city: 'São Paulo',
  addressStreet: 'Av. Paulista, 1000',
  addressCity: 'São Paulo',
};

export function TemplatePreview({
  components,
  variableMappings = {},
  contactFieldsMap = {},
  mediaUrl,
  className = '',
  compact = false,
}: TemplatePreviewProps) {
  
  const headerComponent = components?.find(c => c.type === 'HEADER');
  const bodyComponent = components?.find(c => c.type === 'BODY');
  const footerComponent = components?.find(c => c.type === 'FOOTER');
  const buttonsComponent = components?.find(c => c.type === 'BUTTONS');

  const replaceVariables = (text: string): React.ReactNode[] => {
    if (!text) return [text];
    
    const parts = text.split(/(\{\{.*?\}\})/);
    
    return parts.map((part, index) => {
      const match = part.match(/\{\{(.*?)\}\}/);
      if (match) {
        const varName = match[1];
        if (!varName) {
          return <span key={index}>{part}</span>;
        }
        const mapping = variableMappings[varName];
        
        if (mapping?.type === 'fixed' && mapping.value) {
          return (
            <span key={index} className="font-semibold text-green-600 dark:text-green-400">
              {mapping.value}
            </span>
          );
        }
        
        if (mapping?.type === 'dynamic' && mapping.value) {
          const fieldLabel = contactFieldsMap[mapping.value] || mapping.value;
          const sampleValue = (CONTACT_SAMPLE_DATA as Record<string, string>)[mapping.value] || `[${fieldLabel.toUpperCase()}]`;
          return (
            <span key={index} className="font-semibold text-blue-600 dark:text-blue-400">
              {sampleValue}
            </span>
          );
        }
        
        return (
          <span key={index} className="font-semibold text-yellow-600 dark:text-yellow-400">
            {part}
          </span>
        );
      }
      
      return <span key={index}>{part}</span>;
    });
  };

  const renderHeader = () => {
    if (!headerComponent) return null;

    if (headerComponent.format === 'TEXT') {
      return (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 p-4 rounded-t-2xl border-b border-green-200 dark:border-green-800">
          <p className="font-bold text-lg text-green-900 dark:text-green-100">
            {replaceVariables(headerComponent.text || '')}
          </p>
        </div>
      );
    }

    if (headerComponent.format && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComponent.format)) {
      const hasMedia = mediaUrl || headerComponent.example?.header_handle?.[0];
      const mediaHeightClass = compact ? 'h-32' : 'aspect-video';
      
      return (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-t-2xl overflow-hidden">
          {hasMedia ? (
            <div className={`relative ${mediaHeightClass} bg-gray-200 dark:bg-gray-700 flex items-center justify-center`}>
              {headerComponent.format === 'IMAGE' && mediaUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img 
                  src={mediaUrl} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                />
              )}
              {headerComponent.format === 'VIDEO' && (
                <div className="flex flex-col items-center gap-2 text-gray-600 dark:text-gray-300">
                  <Video className={compact ? "h-8 w-8" : "h-12 w-12"} />
                  <span className="text-sm">Vídeo anexado</span>
                </div>
              )}
              {headerComponent.format === 'DOCUMENT' && (
                <div className="flex flex-col items-center gap-2 text-gray-600 dark:text-gray-300">
                  <FileText className={compact ? "h-8 w-8" : "h-12 w-12"} />
                  <span className="text-sm">Documento anexado</span>
                </div>
              )}
            </div>
          ) : (
            <div className={`${mediaHeightClass} bg-gray-200 dark:bg-gray-700 flex flex-col items-center justify-center gap-2 text-gray-500`}>
              {headerComponent.format === 'IMAGE' && <ImageIcon className={compact ? "h-8 w-8" : "h-12 w-12"} />}
              {headerComponent.format === 'VIDEO' && <Video className={compact ? "h-8 w-8" : "h-12 w-12"} />}
              {headerComponent.format === 'DOCUMENT' && <FileText className={compact ? "h-8 w-8" : "h-12 w-12"} />}
              <span className="text-sm">Mídia necessária</span>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const renderButtons = () => {
    if (!buttonsComponent?.buttons || buttonsComponent.buttons.length === 0) {
      return null;
    }

    return (
      <div className="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
        {buttonsComponent.buttons.map((button, index) => {
          let icon = null;
          let colorClass = 'text-blue-600 dark:text-blue-400';
          
          if (button.type === 'PHONE_NUMBER') {
            icon = <Phone className="h-4 w-4" />;
            colorClass = 'text-green-600 dark:text-green-400';
          } else if (button.type === 'URL') {
            icon = <ExternalLink className="h-4 w-4" />;
            colorClass = 'text-blue-600 dark:text-blue-400';
          } else if (button.type === 'COPY_CODE') {
            icon = <Copy className="h-4 w-4" />;
            colorClass = 'text-purple-600 dark:text-purple-400';
          }

          return (
            <button
              key={index}
              className={`w-full py-3 px-4 flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${colorClass} font-medium`}
              disabled
            >
              {icon}
              <span>{button.text}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const hasContent = headerComponent || bodyComponent || footerComponent;

  if (!hasContent) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-gray-500">
          Selecione um template para visualizar o preview
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Preview da Mensagem</CardTitle>
          <Badge variant="outline" className="gap-1">
            <Globe className="h-3 w-3" />
            WhatsApp
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-w-sm mx-auto">
          {/* WhatsApp message bubble */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {renderHeader()}
            
            <div className="p-4 space-y-3">
              {bodyComponent?.text && (
                <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
                  {replaceVariables(bodyComponent.text)}
                </p>
              )}
              
              {footerComponent?.text && (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                  {footerComponent.text}
                </p>
              )}
            </div>
            
            {renderButtons()}
          </div>
          
          {/* Legend */}
          <div className="mt-4 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-600" />
              <span className="text-gray-600 dark:text-gray-400">Valor fixo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-600" />
              <span className="text-gray-600 dark:text-gray-400">Campo dinâmico (exemplo)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-yellow-600" />
              <span className="text-gray-600 dark:text-gray-400">Variável não mapeada</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
