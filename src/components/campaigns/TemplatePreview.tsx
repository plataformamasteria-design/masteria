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
        <div className="bg-[#111b21]/50 p-4 rounded-t-lg border-b border-white/5">
          <p className="font-bold text-lg text-[#e9edef]">
            {replaceVariables(headerComponent.text || '')}
          </p>
        </div>
      );
    }

    if (headerComponent.format && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComponent.format)) {
      const exampleHandle = headerComponent.example?.header_handle?.[0];
      const exampleUrlDirect = (headerComponent.example as any)?.header_url?.[0];
      const isExampleHandleUrl = exampleHandle?.startsWith('http');
      const exampleUrl = exampleUrlDirect || (isExampleHandleUrl ? exampleHandle : null);
      
      const displayUrl = mediaUrl || exampleUrl;
      const hasMedia = !!displayUrl || !!exampleHandle;

      const mediaHeightClass = compact ? 'h-32' : 'aspect-video';
      
      return (
        <div className="bg-[#111b21] rounded-t-lg overflow-hidden border-b border-white/5">
          {hasMedia ? (
            <div className={`relative ${mediaHeightClass} bg-[#111b21] flex items-center justify-center`}>
              {headerComponent.format === 'IMAGE' && displayUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img 
                  src={displayUrl} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                />
              )}
              {headerComponent.format === 'IMAGE' && !displayUrl && (
                <div className="flex flex-col items-center gap-2 text-[#8696a0]">
                  <ImageIcon className={compact ? "h-8 w-8" : "h-12 w-12"} />
                  <span className="text-sm">Imagem do modelo</span>
                </div>
              )}
              {headerComponent.format === 'VIDEO' && (
                <div className="flex flex-col items-center gap-2 text-[#8696a0]">
                  <Video className={compact ? "h-8 w-8" : "h-12 w-12"} />
                  <span className="text-sm">Vídeo anexado</span>
                </div>
              )}
              {headerComponent.format === 'DOCUMENT' && (
                <div className="flex flex-col items-center gap-2 text-[#8696a0]">
                  <FileText className={compact ? "h-8 w-8" : "h-12 w-12"} />
                  <span className="text-sm">Documento anexado</span>
                </div>
              )}
            </div>
          ) : (
            <div className={`${mediaHeightClass} bg-[#111b21] flex flex-col items-center justify-center gap-2 text-[#8696a0]`}>
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
      <div className="border-t border-white/5 divide-y divide-white/5">
        {buttonsComponent.buttons.map((button, index) => {
          let icon = null;
          let colorClass = 'text-[#00a884]';
          
          if (button.type === 'PHONE_NUMBER') {
            icon = <Phone className="h-4 w-4" />;
          } else if (button.type === 'URL') {
            icon = <ExternalLink className="h-4 w-4" />;
          } else if (button.type === 'COPY_CODE') {
            icon = <Copy className="h-4 w-4" />;
          }

          return (
            <button
              key={index}
              className={`w-full py-3 px-4 flex items-center justify-center gap-2 hover:bg-white/5 transition-colors ${colorClass} font-medium text-sm`}
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
      <div className={`p-6 text-center text-zinc-500 bg-transparent border-0 shadow-none ${className}`}>
        Selecione um template para visualizar o preview
      </div>
    );
  }

  return (
    <div className={`bg-transparent border-0 shadow-none text-white ${className}`}>
      {/* Container Whatsapp Dark Pattern (similar ao wrapper do whatsapp-preview.tsx) */}
      <div className="relative rounded-xl overflow-hidden bg-[#0b141a] p-4 min-h-[300px] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] border border-white/5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      >
        <div className="max-w-[340px] mx-auto">
          {/* WhatsApp message bubble */}
          <div className="bg-[#202c33] rounded-lg rounded-tl-none shadow-sm overflow-hidden mt-2">
            {renderHeader()}
            
            <div className="p-3 space-y-1">
              {bodyComponent?.text && (
                <div className="text-[14.2px] leading-snug text-[#e9edef] whitespace-pre-wrap break-words">
                  {replaceVariables(bodyComponent.text)}
                </div>
              )}
              
              {footerComponent?.text && (
                <p className="text-xs text-[#8696a0] mt-1">
                  {footerComponent.text}
                </p>
              )}
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-[10px] text-[#8696a0]">
                  00:13
                </span>
              </div>
            </div>
            
            {renderButtons()}
          </div>
          
          <div className="mt-3 text-center">
            <p className="text-[11px] text-zinc-500 font-medium">
              Sua marca aparecerá aqui
            </p>
          </div>
        </div>
      </div>
          
      {/* Legend */}
      <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          <span className="text-zinc-400">Valor fixo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          <span className="text-zinc-400">Campo dinâmico (exemplo)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
          <span className="text-zinc-400">Variável não mapeada</span>
        </div>
      </div>
    </div>
  );
}
