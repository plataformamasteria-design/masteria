import { Smartphone, FileAudio, Image as ImageIcon, FileText, Video, CheckCheck, GitBranch } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface MessageStep {
  id?: string;
  step_order: number;
  message_type: 'text' | 'audio' | 'image' | 'pdf' | 'video';
  content?: string;
  file_url?: string;
  file_name?: string;
}

interface MessagePreviewProps {
  steps: MessageStep[];
  automationMode?: boolean;
  automationName?: string;
}

export function MessagePreview({ steps, automationMode, automationName }: MessagePreviewProps) {
  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // Filter steps that have actual content
  const validSteps = steps.filter(s => s.content?.trim() || s.file_url || s.message_type !== 'text');

  const renderBubble = (step: MessageStep, index: number) => {
    switch (step.message_type) {
      case 'audio':
        return (
          <div key={step.id || `audio-${index}`} className="flex justify-end my-1 px-2">
            <div className="bg-[#d9fdd3] rounded-[1.25rem] rounded-tr-[4px] px-3 py-2.5 max-w-[85%] shadow-[0_1px_1px_rgba(0,0,0,0.08)] relative pb-6 border border-neutral-200/50 w-[240px]">
              {step.file_url ? (
                <audio controls src={step.file_url} className="w-full h-8 mb-1" />
              ) : (
                <div className="flex items-center gap-2">
                  <FileAudio className="h-5 w-5 text-[#00a884] shrink-0" />
                  <div className="flex-1 h-1.5 bg-[#b2f0a5] rounded-full">
                    <div className="h-1.5 bg-[#00a884] rounded-full w-2/3" />
                  </div>
                  <span className="text-[10px] font-medium text-emerald-800">0:12</span>
                </div>
              )}
              <div className="absolute bottom-1 right-2 flex items-center justify-end gap-1">
                <span className="text-[10px] text-neutral-500 font-medium">{time}</span>
                <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] ml-0.5" />
              </div>
            </div>
          </div>
        );
      case 'image':
        return (
          <div key={step.id || `image-${index}`} className="flex justify-end my-1 px-2">
            <div className="bg-[#d9fdd3] rounded-[1.25rem] rounded-tr-[4px] px-1 py-1 max-w-[85%] shadow-[0_1px_1px_rgba(0,0,0,0.08)] relative border border-neutral-200/50 w-[240px]">
              <div className="rounded-xl overflow-hidden mb-1.5 bg-[#b2f0a5]/50 flex items-center justify-center relative min-h-[140px]">
                {step.file_url ? (
                  <img src={step.file_url} alt="" className="w-full h-auto object-cover rounded-xl" />
                ) : (
                  <ImageIcon className="h-10 w-10 text-[#00a884]/40" />
                )}
              </div>
              {step.content && (
                <p className="text-[13px] text-[#111b21] px-2 pb-5 whitespace-pre-wrap font-normal leading-[1.3] w-full break-words">
                  {step.content}
                </p>
              )}
              <div className={cn("absolute bottom-1 right-2 flex items-center justify-end gap-1", !step.content ? "bottom-2 right-3 px-1 py-0.5 rounded-full bg-black/40 text-white" : "")}>
                <span className="text-[10px] font-medium text-neutral-500">{time}</span>
                <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] ml-0.5" />
              </div>
            </div>
          </div>
        );
      case 'video':
        return (
          <div key={step.id || `video-${index}`} className="flex justify-end my-1 px-2">
            <div className="bg-[#d9fdd3] rounded-[1.25rem] rounded-tr-[4px] px-1 py-1 max-w-[85%] shadow-[0_1px_1px_rgba(0,0,0,0.08)] relative border border-neutral-200/50 w-[240px]">
              <div className="rounded-xl overflow-hidden mb-1.5 bg-[#b2f0a5]/50 flex items-center justify-center relative min-h-[140px]">
                {step.file_url ? (
                  <video src={step.file_url} className="w-full h-auto object-cover rounded-xl" controls={false} />
                ) : (
                  <Video className="h-10 w-10 text-[#00a884]/40" />
                )}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-10 w-10 rounded-full bg-black/40 flex items-center justify-center p-2 backdrop-blur-sm">
                    <div className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-white ml-1.5" />
                  </div>
                </div>
              </div>
              {step.content && (
                <p className="text-[13px] text-[#111b21] px-2 pb-5 whitespace-pre-wrap font-normal leading-[1.3] w-full break-words">
                  {step.content}
                </p>
              )}
              <div className={cn("absolute bottom-1 right-2 flex items-center justify-end gap-1", !step.content ? "bottom-2 right-3 px-1 py-0.5 rounded-full bg-black/40 text-white" : "")}>
                <span className="text-[10px] font-medium text-neutral-500">{time}</span>
                <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] ml-0.5" />
              </div>
            </div>
          </div>
        );
      case 'pdf':
        return (
          <div key={step.id || `pdf-${index}`} className="flex justify-end my-1 px-2">
            <div className="bg-[#d9fdd3] rounded-[1.25rem] rounded-tr-[4px] px-2 py-2 max-w-[85%] shadow-[0_1px_1px_rgba(0,0,0,0.08)] relative pb-6 border border-neutral-200/50 min-w-[200px]">
              <div className="bg-[#00a884]/10 rounded-xl p-3 flex items-center gap-3">
                <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#111b21] truncate">{step.file_name || "documento.pdf"}</p>
                  <p className="text-[10px] text-emerald-800/80 font-medium">10 páginas • 2.5 MB</p>
                </div>
              </div>
              <div className="absolute bottom-1 right-2 flex items-center justify-end gap-1">
                <span className="text-[10px] text-neutral-500 font-medium">{time}</span>
                <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] ml-0.5" />
              </div>
            </div>
          </div>
        );
      default: // text
        if (!step.content?.trim()) return null;
        return (
          <div key={step.id || `text-${index}`} className="flex justify-end my-1 px-2">
            <div className="bg-[#d9fdd3] rounded-[1.25rem] rounded-tr-[4px] px-3 py-2 max-w-[85%] shadow-[0_1px_1px_rgba(0,0,0,0.08)] relative pb-6 border border-neutral-200/50">
              <p className="text-[13px] text-[#111b21] whitespace-pre-wrap leading-[1.3] font-normal w-full break-words">
                {step.content}
              </p>
              <div className="absolute bottom-1 right-2 flex items-center justify-end gap-1">
                <span className="text-[10px] text-neutral-500 font-medium">{time}</span>
                <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] ml-0.5" />
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full h-full flex justify-center items-center p-4 pointer-events-none">
      <div
        className="w-full max-w-[340px] aspect-[340/660] max-h-[85vh] shrink-0 flex flex-col rounded-[2.5rem] border-[12px] border-[#d4d5d9] bg-[#efeae2] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden ring-1 ring-[#a1a1aa] relative pointer-events-auto"
      >
        {/* iPhone Notch Container */}
        <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-20 pointer-events-none">
          <div className="w-[120px] h-[22px] bg-[#d4d5d9] rounded-b-[1.25rem]" />
        </div>

        {/* Header (WhatsApp Header Style) */}
        <div className="shrink-0 bg-[#008069] pt-10 pb-3 px-4 flex items-center gap-3 shadow-sm z-10 w-full">
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-white leading-tight truncate">Seu Lead Genérico</p>
            <p className="text-[11px] text-emerald-50/90 truncate">online</p>
          </div>
        </div>

        <ScrollArea className="flex-1 bg-[#efeae2] w-full">
          <div className="p-3 space-y-2 py-4 pb-20">
            <div className="flex justify-center my-3">
              <div className="bg-[#ffeebd] rounded-xl px-3 py-1.5 max-w-[85%] shadow-[0_1px_1px_rgba(0,0,0,0.05)] border border-[#f5e0a3]/30">
                <p className="text-[10px] text-[#7a6431] text-center font-medium tracking-wide">
                  As mensagens do disparo chegarão assim no WhatsApp do seu Lead.
                </p>
              </div>
            </div>

            {automationMode ? (
              <div className="flex justify-end my-1 px-2 mt-4">
                <div className="bg-[#d9fdd3] rounded-[1.25rem] rounded-tr-[4px] px-3 py-3 max-w-[90%] shadow-[0_1px_1px_rgba(0,0,0,0.08)] relative pb-7 border border-neutral-200/50 w-[260px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-lg bg-[#00a884]/15 flex items-center justify-center shrink-0">
                      <GitBranch className="h-4 w-4 text-[#00a884]" />
                    </div>
                    <p className="text-[12px] font-semibold text-[#111b21] leading-tight">
                      Automação I.A
                    </p>
                  </div>
                  {automationName ? (
                    <p className="text-[12px] text-[#111b21] leading-[1.4] font-normal">
                      Este lead será injetado no fluxo: <strong className="text-[#00a884]">{automationName}</strong>
                    </p>
                  ) : (
                    <p className="text-[12px] text-[#111b21]/60 italic leading-[1.4] font-normal">
                      Selecione uma automação ativa...
                    </p>
                  )}
                  <p className="text-[10px] text-[#667781] mt-1.5 leading-[1.3]">
                    Nenhuma mensagem manual será enviada. O fluxo definirá toda a interação.
                  </p>
                  <div className="absolute bottom-1 right-2 flex items-center justify-end gap-1">
                    <span className="text-[10px] text-neutral-500 font-medium">{time}</span>
                    <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] ml-0.5" />
                  </div>
                </div>
              </div>
            ) : validSteps.length === 0 ? (
              <div className="flex justify-end my-1 px-2 mt-6">
                <div className="bg-[#d9fdd3] rounded-[1.25rem] rounded-tr-[4px] px-3 py-2 max-w-[85%] shadow-[0_1px_1px_rgba(0,0,0,0.08)] relative pb-6 border border-neutral-200/50 opacity-60">
                  <p className="text-[13px] text-[#111b21] italic whitespace-pre-wrap leading-[1.3] font-normal w-full break-words">
                    Suas mensagens aparecerão aqui assim que preencher...
                  </p>
                  <div className="absolute bottom-1 right-2 flex items-center justify-end gap-1">
                    <span className="text-[10px] text-neutral-500 font-medium">{time}</span>
                    <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] ml-0.5" />
                  </div>
                </div>
              </div>
            ) : (
              validSteps.map((step, i) => renderBubble(step, i))
            )}
          </div>
        </ScrollArea>

        {/* Fake WhatsApp Input */}
        <div className="shrink-0 bg-[#f0f2f5] p-3 relative z-10 border-t border-neutral-200 flex items-center gap-3 w-full">
          <div className="flex-1 h-11 bg-white rounded-full border border-neutral-200 shadow-sm flex items-center px-5">
            <span className="text-sm text-neutral-400">Mensagem do lead...</span>
          </div>
          <div className="h-11 w-11 rounded-full bg-[#00a884] flex items-center justify-center shrink-0 shadow-sm opacity-50">
            <FileAudio className="h-5 w-5 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
