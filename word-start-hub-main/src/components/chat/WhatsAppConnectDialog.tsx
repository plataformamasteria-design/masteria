import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, QrCode, Keyboard, RefreshCw, CheckCircle2, ArrowRight, Phone, Settings2 } from 'lucide-react';
import { useWhatsAppConnection } from '@/hooks/useWhatsAppConnection';
import { cn } from '@/lib/utils';
import whatsappIcon from '@/assets/whatsapp-icon.png';
import vittaQrLogo from '@/assets/vitta-qr-logo.png';

interface WhatsAppConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}

type ConnectionMode = 'qrcode' | 'pairing';
type Step = 'phone' | 'connect' | 'success';

export function WhatsAppConnectDialog({
  open,
  onOpenChange,
  onConnected,
}: WhatsAppConnectDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [mode, setMode] = useState<ConnectionMode>('qrcode');
  const [step, setStep] = useState<Step>('phone');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdatingWebhook, setIsUpdatingWebhook] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const {
    loadingAction,
    status,
    connectionData,
    reconnect,
    getQRCode,
    getPairingCode,
    checkStatusSilent,
    clearConnectionData,
    updateWebhook,
  } = useWhatsAppConnection();

  // Poll for connection status silently when showing QR code
  useEffect(() => {
    if (step === 'connect' && connectionData?.qrcode && !status.connected) {
      pollingRef.current = setInterval(async () => {
        try {
          const result = await checkStatusSilent();
          if (result?.connected) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
            }
            setStep('success');
            setTimeout(() => {
              onConnected?.();
            }, 2000);
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 3000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [step, connectionData?.qrcode, status.connected, checkStatusSilent, onConnected]);

  // Check for success when status changes
  useEffect(() => {
    if (status.connected && step === 'connect') {
      setStep('success');
      setTimeout(() => {
        onConnected?.();
      }, 2000);
    }
  }, [status.connected, step, onConnected]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('phone');
      setPhoneNumber('');
      setMode('qrcode');
      clearConnectionData();
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    }
  }, [open, clearConnectionData]);

  const handleConnect = async () => {
    try {
      await reconnect(phoneNumber);
      setStep('connect');
      
      setTimeout(() => {
        getQRCode();
      }, 1000);
    } catch (error) {
      console.error('Error connecting:', error);
    }
  };

  const handleRefreshQR = async () => {
    setIsRefreshing(true);
    try {
      await getQRCode();
    } catch (error) {
      console.error('Error refreshing QR:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGetPairingCode = async () => {
    if (!phoneNumber) return;
    
    try {
      await getPairingCode(phoneNumber);
      setMode('pairing');
    } catch (error) {
      console.error('Error getting pairing code:', error);
    }
  };

  const handleUpdateWebhook = async () => {
    setIsUpdatingWebhook(true);
    try {
      await updateWebhook();
    } catch (error) {
      console.error('Error updating webhook:', error);
    } finally {
      setIsUpdatingWebhook(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits;
  };

  const formatPairingCodeDisplay = (code: string) => {
    // Format pairing code with spaces for better readability
    if (code.length === 8) {
      return `${code.slice(0, 4)} ${code.slice(4)}`;
    }
    return code;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-gradient-to-br from-card via-card to-muted/30 border-border/50">
        {/* Success Step */}
        {step === 'success' && (
          <div className="flex flex-col items-center justify-center py-16 px-8">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
              <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-xl shadow-green-500/40">
                <CheckCircle2 className="h-10 w-10 text-white animate-scale-in" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Conectado!</h3>
            <p className="text-muted-foreground text-sm text-center">
              Seu WhatsApp foi conectado com sucesso
            </p>
          </div>
        )}

        {/* Phone Step */}
        {step === 'phone' && (
          <div className="flex flex-col">
            {/* Header with gradient */}
            <div className="relative px-8 pt-10 pb-8 bg-gradient-to-br from-green-500/10 via-transparent to-transparent">
              <div className="absolute top-6 right-6 opacity-10">
                <img src={whatsappIcon} alt="WhatsApp" className="h-32 w-32" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 shadow-lg shadow-green-500/30 mb-4 overflow-hidden">
                  <img src={whatsappIcon} alt="WhatsApp" className="w-full h-full object-cover" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-1">
                  Conectar WhatsApp
                </h2>
                <p className="text-muted-foreground text-sm">
                  Informe o número que será conectado
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="px-8 pb-8 space-y-6">
              <div className="space-y-2">
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Input
                    id="phone"
                    placeholder="5511999999999"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                    className="pl-11 h-12 text-lg font-mono bg-muted/50 border-border/50 focus:border-green-500/50 focus:ring-green-500/20"
                  />
                </div>
                <p className="text-xs text-muted-foreground px-1">
                  Código do país + DDD + número
                </p>
              </div>

              <Button 
                onClick={handleConnect} 
                disabled={loadingAction || !phoneNumber || phoneNumber.length < 10}
                className="w-full h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium shadow-lg shadow-green-500/30 transition-all duration-300"
              >
                {loadingAction ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Connect Step */}
        {step === 'connect' && (
          <div className="flex flex-col">
            {/* Mode Toggle */}
            <div className="flex justify-center pt-6 pb-4">
              <div className="inline-flex items-center p-1 rounded-full bg-muted/80 backdrop-blur-sm border border-border/50">
                <button
                  onClick={() => setMode('qrcode')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                    mode === 'qrcode' 
                      ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <QrCode className="h-4 w-4" />
                  QR Code
                </button>
                <button
                  onClick={handleGetPairingCode}
                  disabled={loadingAction}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                    mode === 'pairing' 
                      ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {loadingAction && mode !== 'qrcode' && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Keyboard className="h-4 w-4" />
                  Código
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-8 pb-8">
              {mode === 'qrcode' ? (
                <div className="flex flex-col items-center gap-6">
                  {/* QR Code Container */}
                  <div className="relative group">
                    {connectionData?.qrcode ? (
                      <>
                        {/* Decorative frame */}
                        <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-green-500/20 via-transparent to-green-500/10 blur-xl opacity-60" />
                        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-green-500/30 to-green-600/30" />
                        
                        {/* QR Code */}
                        <div className="relative p-3 rounded-xl bg-white shadow-xl">
                          <img
                            src={connectionData.qrcode.startsWith('data:') 
                              ? connectionData.qrcode 
                              : `data:image/png;base64,${connectionData.qrcode}`}
                            alt="QR Code"
                            className="w-56 h-56 grayscale contrast-125"
                          />
                          
                          {/* Vitta logo overlay */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-14 h-14 rounded-xl overflow-hidden shadow-lg">
                              <img src={vittaQrLogo} alt="Vitta" className="w-full h-full object-cover" />
                            </div>
                          </div>
                        </div>

                        {/* Refresh button */}
                        <button
                          onClick={handleRefreshQR}
                          disabled={isRefreshing}
                          className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-2 rounded-full bg-card border border-border shadow-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:border-green-500/50 transition-all duration-300"
                        >
                          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                          Atualizar
                        </button>
                      </>
                    ) : loadingAction ? (
                      <div className="w-64 h-64 flex items-center justify-center rounded-2xl bg-muted/50 border border-border/50">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="h-10 w-10 animate-spin text-green-500" />
                          <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="w-64 h-64 flex flex-col items-center justify-center rounded-2xl bg-muted/50 border border-border/50 gap-3">
                        <QrCode className="h-16 w-16 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">QR Code não disponível</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRefreshQR}
                          disabled={isRefreshing}
                          className="gap-1.5"
                        >
                          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                          Carregar
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Instructions */}
                  <div className="w-full space-y-3 pt-4">
                    {[
                      { icon: '📱', text: 'Abra o WhatsApp no celular' },
                      { icon: '⚙️', text: 'Vá em Configurações > Aparelhos conectados' },
                      { icon: '🔗', text: 'Toque em Conectar um aparelho' },
                      { icon: '📷', text: 'Escaneie o QR Code acima' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="text-base">{item.icon}</span>
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* Webhook button (DELETE/UPDATE support) */}
                  <div className="w-full pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleUpdateWebhook}
                      disabled={isUpdatingWebhook || loadingAction}
                      className="w-full gap-2"
                    >
                      {isUpdatingWebhook ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Settings2 className="h-4 w-4" />
                      )}
                      Atualizar webhook
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground text-center">
                      Garante recebimento de eventos de edição/remoção e respostas citadas.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  {/* Pairing Code Display */}
                  {connectionData?.pairingCode ? (
                    <div className="relative">
                      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-green-500/20 via-transparent to-green-500/10 blur-xl opacity-60" />
                      <div className="relative px-8 py-6 rounded-2xl bg-gradient-to-br from-muted/80 to-muted border border-border/50 shadow-xl">
                        <p className="text-4xl font-mono font-bold tracking-[0.3em] text-foreground text-center">
                          {formatPairingCodeDisplay(connectionData.pairingCode)}
                        </p>
                        <div className="flex items-center justify-center gap-2 mt-3">
                          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                          <p className="text-xs text-muted-foreground">
                            Expira em alguns minutos
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : loadingAction ? (
                    <div className="px-8 py-6 flex items-center justify-center">
                      <Loader2 className="h-10 w-10 animate-spin text-green-500" />
                    </div>
                  ) : (
                    <div className="px-8 py-6 flex flex-col items-center gap-3 rounded-2xl bg-muted/50 border border-border/50">
                      <Keyboard className="h-12 w-12 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground text-center">
                        Clique em "Código" para gerar
                      </p>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="w-full space-y-3 pt-4">
                    {[
                      { icon: '📱', text: 'Abra o WhatsApp no celular' },
                      { icon: '⚙️', text: 'Vá em Configurações > Aparelhos conectados' },
                      { icon: '🔗', text: 'Toque em Conectar um aparelho' },
                      { icon: '📞', text: 'Escolha "Conectar com número de telefone"' },
                      { icon: '⌨️', text: 'Digite o código acima' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="text-base">{item.icon}</span>
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
