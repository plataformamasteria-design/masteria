import React from 'react';
import { cn } from '@/lib/utils';

interface WhatsAppPreviewProps {
  header?: {
    type: 'text' | 'image' | 'video' | 'document';
    content?: string;
    url?: string;
  };
  body: string;
  footer?: string;
  buttons?: Array<{
    type: 'quick_reply' | 'url' | 'phone_number';
    text: string;
    url?: string;
  }>;
  className?: string;
}

export function WhatsAppPreview({
  header,
  body,
  footer,
  buttons,
  className
}: WhatsAppPreviewProps) {
  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      <div className="relative">
        <p className="text-center text-xs text-zinc-500 mb-4 font-medium uppercase tracking-wider">
          Prévia do modelo
        </p>
        
        {/* WhatsApp Background Pattern (Dark Mode) */}
        <div className="relative rounded-xl overflow-hidden bg-[#0b141a] p-4 min-h-[300px] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] border border-white/5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        >
          {/* Message Bubble (Incoming Dark) */}
          <div className="relative max-w-[340px]">
            <div className="bg-[#202c33] rounded-lg shadow-sm overflow-hidden rounded-tl-none mt-2">
              {/* Header */}
              {header && (
                <div className="border-b border-white/5">
                  {header.type === 'text' && header.content && (
                    <div className="p-3 font-semibold text-[#e9edef]">
                      {header.content}
                    </div>
                  )}
                  {header.type === 'image' && header.url && (
                    <div className="relative w-full h-48 bg-[#111b21]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={header.url} 
                        alt="Header" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {header.type === 'video' && header.url && (
                    <div className="relative w-full h-48 bg-[#111b21] flex items-center justify-center">
                      <video 
                        src={header.url} 
                        className="w-full h-full object-cover"
                        controls
                      />
                    </div>
                  )}
                  {header.type === 'document' && header.content && (
                    <div className="p-3 flex items-center gap-2 bg-[#111b21]/50">
                      <svg className="w-5 h-5 text-[#8696a0]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-[#e9edef] truncate">{header.content}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Body */}
              <div className="p-3">
                <div className="text-[14.2px] leading-snug text-[#e9edef] whitespace-pre-wrap break-words">
                  {body}
                </div>
              </div>
              
              {/* Footer */}
              {footer && (
                <div className="px-3 pb-2">
                  <p className="text-xs text-[#8696a0]">
                    {footer}
                  </p>
                </div>
              )}
              
              {/* Timestamp */}
              <div className="px-3 pb-2 flex items-center justify-end gap-1">
                <span className="text-[10px] text-[#8696a0]">
                  00:13
                </span>
              </div>
            </div>
            
            {/* Buttons */}
            {buttons && buttons.length > 0 && (
              <div className="mt-1 bg-[#202c33] rounded-lg shadow-sm overflow-hidden divide-y divide-white/5">
                {buttons.map((button, index) => (
                  <button
                    key={index}
                    className="w-full p-3 text-sm font-medium text-[#00a884] hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                    disabled
                  >
                    {button.type === 'url' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    )}
                    {button.type === 'phone_number' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    )}
                    {button.type === 'quick_reply' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    )}
                    <span>{button.text}</span>
                  </button>
                ))}
              </div>
            )}
            
            {/* Footer Text */}
            <div className="mt-3 text-center">
              <p className="text-[11px] text-zinc-500 font-medium">
                Sua marca aparecerá aqui
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
