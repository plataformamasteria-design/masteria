
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  FileText,
  ImageIcon,
  VideoIcon,
  FileQuestion,
  MessageSquareText,
  SendIcon,
} from 'lucide-react';
import type { Campaign } from '@/lib/types';
import * as React from 'react';

const headerIconConfig = {
  IMAGE: <ImageIcon className="h-4 w-4" />,
  VIDEO: <VideoIcon className="h-4 w-4" />,
  DOCUMENT: <FileText className="h-4 w-4" />,
  TEXT: <FileQuestion className="h-4 w-4" />,
  NONE: null,
};

const highlightVariables = (body: string): React.ReactNode[] => {
  if (!body) return [];
  return body.split(/(\{\{.*?\}\})/).map((part, index) =>
    part.match(/(\{\{.*?\}\})/) ? (
      <span key={index} className="font-bold text-primary">
        {part}
      </span>
    ) : (
      part
    )
  );
};


export function ReportMessagePreview({ campaign, mediaUrl }: { campaign: Campaign; mediaUrl?: string | null }): JSX.Element {
  const isSms = campaign.channel === 'SMS';
  const headerType = !isSms ? campaign.templateHeaderType : null;
  const HeaderIcon = headerType ? headerIconConfig[headerType as keyof typeof headerIconConfig] : null;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareText />
          Mensagem Enviada
        </CardTitle>
        <CardDescription>
          Pré-visualização do conteúdo enviado para os contatos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mediaUrl && (
          <div className="rounded-md overflow-hidden border bg-black/5 max-h-[300px] flex justify-center">
            {headerType === 'IMAGE' && (
              <img
                src={mediaUrl}
                alt="Preview da Campanha"
                className="max-h-[300px] object-contain"
              />
            )}
            {headerType === 'VIDEO' && (
              <video
                src={mediaUrl}
                controls
                className="max-h-[300px] w-full"
              />
            )}
          </div>
        )}

        <div className="space-y-4 p-4 border rounded-md bg-muted/50">
          {isSms ? (
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>Canal: SMS</span>
              <div className="flex items-center gap-2">
                <SendIcon className="h-4 w-4" />
                <span className="font-semibold">{campaign.smsGatewayName || 'Gateway Padrão'}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>Modelo: {campaign.templateName || 'N/A'}</span>
              {HeaderIcon && (
                <div className="flex items-center gap-2">
                  {HeaderIcon}
                  <span className="font-semibold">{headerType}</span>
                </div>
              )}
            </div>
          )}
          <div className="text-sm">
            {isSms
              ? campaign.message
              : (campaign.templateBody ? highlightVariables(campaign.templateBody) : 'Corpo da mensagem não disponível.')
            }
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
