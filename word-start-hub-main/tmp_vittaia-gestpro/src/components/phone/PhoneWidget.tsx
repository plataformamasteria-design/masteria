import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, X, PhoneCall, Mic, MicOff, Pause, Volume2, Delete, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Device, Call } from '@twilio/voice-sdk';
import { useEffect, useRef } from 'react';
import { usePhoneStore } from '@/store/usePhoneStore';

export function PhoneWidget() {
    const { isOpen, closePhone, phoneNumber, setPhoneNumber } = usePhoneStore();
    const [isCalling, setIsCalling] = useState(false);
    const [duration, setDuration] = useState(0);
    const [deviceReady, setDeviceReady] = useState(false);
    const [isSettingUp, setIsSettingUp] = useState(false);

    const deviceRef = useRef<Device | null>(null);
    const activeCallRef = useRef<Call | null>(null);

    const location = useLocation();

    const hiddenRoutes = ['/', '/auth', '/reset-password'];

    // Initialize Twilio Voice Device
    useEffect(() => {
        if (!isOpen) return;
        if (deviceReady || isSettingUp) return;

        const setupDevice = async () => {
            setIsSettingUp(true);
            try {
                const { data, error } = await supabase.functions.invoke("twilio-voip-token");
                if (error || !data?.token) {
                    throw new Error(error?.message || "Erro ao obter token. Configure o Twilio no Painel de Integrações Globais.");
                }

                const device = new Device(data.token, {
                    codecPreferences: ['opus', 'pcmu'] as any,
                    enableRingingState: true
                });

                device.on('registered', () => {
                    setDeviceReady(true);
                    toast.success("Dispositivo de Voz conectado! 📞");
                });

                device.on('error', (twilioError) => {
                    console.error("Twilio Error:", twilioError);
                    toast.error("Erro na telefonia: " + twilioError.message);
                });

                device.on('disconnect', () => {
                    setIsCalling(false);
                    setDuration(0);
                    activeCallRef.current = null;
                });

                device.register();
                deviceRef.current = device;
            } catch (err: any) {
                toast.error(err.message || "Falha na comunicação VOIP");
            } finally {
                setIsSettingUp(false);
            }
        };

        setupDevice();

        return () => {
            // Cleanup device if unmounting
        };
    }, [isOpen]);

    if (hiddenRoutes.includes(location.pathname)) return null;

    const handleKeyPress = (num: string) => {
        setPhoneNumber(phoneNumber + num);
    };

    const handleDelete = () => {
        setPhoneNumber(phoneNumber.slice(0, -1));
    };

    const handleCall = async () => {
        if (!phoneNumber) {
            toast.error("Digite um número válido");
            return;
        }
        if (!deviceRef.current || !deviceReady) {
            toast.error("Dispositivo não está pronto. Verifique as configurações Twilio.");
            return;
        }

        setIsCalling(true);
        toast.success(`Ligando para ${phoneNumber}...`);

        try {
            const call = await deviceRef.current.connect({ params: { To: phoneNumber } });
            activeCallRef.current = call;

            call.on('accept', () => {
                toast.success("Chamada em andamento");
            });

            call.on('disconnect', () => handleHangup());
            call.on('cancel', () => handleHangup());
            call.on('reject', () => {
                toast.error("Chamada rejeitada ou sem resposta.");
                handleHangup();
            });

        } catch (err: any) {
            toast.error("Não foi possível completar a chamada.");
            setIsCalling(false);
        }
    };

    const handleHangup = () => {
        if (activeCallRef.current) {
            activeCallRef.current.disconnect();
            activeCallRef.current = null;
        }
        setIsCalling(false);
        setDuration(0);
        toast.info("Chamada finalizada");
    };

    const formatDuration = (secs: number) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const dialPad = [
        { num: '1', letters: '' },
        { num: '2', letters: 'ABC' },
        { num: '3', letters: 'DEF' },
        { num: '4', letters: 'GHI' },
        { num: '5', letters: 'JKL' },
        { num: '6', letters: 'MNO' },
        { num: '7', letters: 'PQRS' },
        { num: '8', letters: 'TUV' },
        { num: '9', letters: 'WXYZ' },
        { num: '*', letters: '' },
        { num: '0', letters: '+' },
        { num: '#', letters: '' },
    ];

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="mb-4 w-80 bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden text-white"
                    >
                        <div className="p-6 pb-8 flex flex-col items-center">
                            <div className="flex justify-between items-center mb-6 pt-2 w-full">
                                <div className="text-white/80 font-medium text-sm ml-2">Phone</div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full text-white/50 hover:text-white hover:bg-white/10"
                                    onClick={() => closePhone()}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="h-24 w-full flex flex-col items-center justify-end pb-4 font-sans relative">
                                {isSettingUp && (
                                    <div className="absolute top-0 right-0">
                                        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                                    </div>
                                )}
                                {!isCalling ? (
                                    <div className="text-3xl font-bold tracking-tight text-center truncate w-full px-4 h-10">
                                        {phoneNumber || "Vitta Softphone"}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <span className="text-sm font-medium text-green-400 mb-1 animate-pulse">Em Chamada</span>
                                        <span className="text-2xl font-bold tracking-tight">{phoneNumber}</span>
                                        <span className="text-sm text-zinc-400 font-mono mt-1">{formatDuration(duration)}</span>
                                    </div>
                                )}
                                {!isCalling && phoneNumber && (
                                    <div className="w-full text-center mt-1">
                                        <button onClick={handleDelete} className="text-zinc-500 hover:text-white transition-colors">
                                            <Delete className="h-5 w-5 inline" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <AnimatePresence mode="wait">
                                {!isCalling ? (
                                    <motion.div
                                        key="dialpad"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="grid grid-cols-3 gap-x-6 gap-y-4 w-full"
                                    >
                                        {dialPad.map((key) => (
                                            <div key={key.num} className="flex justify-center">
                                                <button
                                                    onClick={() => handleKeyPress(key.num)}
                                                    className="w-[72px] h-[72px] rounded-full bg-white/5 hover:bg-white/15 active:bg-white/30 transition-all flex flex-col items-center justify-center border border-white/5 shadow-inner"
                                                >
                                                    <span className="text-3xl font-light leading-none">{key.num}</span>
                                                    {key.letters && <span className="text-[10px] tracking-widest text-zinc-500 font-bold uppercase">{key.letters}</span>}
                                                </button>
                                            </div>
                                        ))}

                                        <div className="col-span-3 flex justify-center mt-4">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/20"
                                                onClick={handleCall}
                                            >
                                                <Phone className="h-7 w-7 text-white fill-current" />
                                            </Button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="active-call"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="w-full pt-8 pb-4"
                                    >
                                        <div className="flex justify-center items-center gap-1.5 h-16 w-full mb-8">
                                            {[...Array(6)].map((_, i) => (
                                                <motion.div
                                                    key={i}
                                                    animate={{ height: ['20%', '80%', '20%'] }}
                                                    transition={{ repeat: Infinity, duration: 0.8 + (Math.random() * 0.5), ease: "easeInOut" }}
                                                    className="w-2 rounded-full bg-green-400/80"
                                                />
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-3 gap-6 mb-12">
                                            <button className="flex flex-col items-center gap-2 text-zinc-400 hover:text-white transition-colors">
                                                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center"><MicOff className="h-6 w-6" /></div>
                                                <span className="text-[11px] font-medium">Mute</span>
                                            </button>
                                            <button className="flex flex-col items-center gap-2 text-zinc-400 hover:text-white transition-colors">
                                                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center"><Pause className="h-6 w-6 fill-current" /></div>
                                                <span className="text-[11px] font-medium">Hold</span>
                                            </button>
                                            <button className="flex flex-col items-center gap-2 text-zinc-400 hover:text-white transition-colors">
                                                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center"><Volume2 className="h-6 w-6" /></div>
                                                <span className="text-[11px] font-medium">Speaker</span>
                                            </button>
                                        </div>

                                        <div className="flex justify-center">
                                            <button
                                                onClick={handleHangup}
                                                className="w-[72px] h-[72px] rounded-full bg-red-500 hover:bg-red-400 active:scale-95 transition-all flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.4)]"
                                            >
                                                <Phone className="h-8 w-8 text-white fill-white rotate-[135deg]" />
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
