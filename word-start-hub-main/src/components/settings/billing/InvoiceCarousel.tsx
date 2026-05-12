import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CheckCircle, Clock, XCircle, CreditCard } from "lucide-react";

export function InvoiceCarousel({ payments, onPayInvoice }: { payments: any[]; onPayInvoice: (p: any) => void }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const sorted = [...payments].sort((a, b) => a.reference_month.localeCompare(b.reference_month));

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    useEffect(() => {
        const idx = sorted.findIndex(p => p.reference_month === currentMonth);
        if (idx >= 0) setActiveIndex(idx);
        else setActiveIndex(sorted.length - 1);
    }, [payments.length]);

    if (sorted.length === 0) return null;

    const formatMonth = (m: string) => {
        const [y, mo] = m.split("-");
        const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        return `${months[parseInt(mo) - 1]} ${y}`;
    };

    const canPrev = activeIndex > 0;
    const canNext = activeIndex < sorted.length - 1;

    const getVisibleCards = () => {
        const start = Math.max(0, Math.min(activeIndex - 1, sorted.length - 3));
        const end = Math.min(sorted.length, start + 3);
        return sorted.slice(start, end).map((p, i) => ({ ...p, _idx: start + i }));
    };

    const visible = getVisibleCards();

    return (
        <div className="relative mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-border/50 bg-card/80 backdrop-blur-sm shadow-lg transition-all duration-500 hover:scale-110 disabled:opacity-30" disabled={!canPrev} onClick={() => setActiveIndex(i => Math.max(0, i - 1))}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex gap-1.5">
                    {sorted.map((_, i) => (
                        <button key={i} onClick={() => setActiveIndex(i)} className={`h-1.5 rounded-full transition-all duration-700 ease-out ${i === activeIndex ? 'w-6 bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]' : 'w-1.5 bg-muted-foreground/20 hover:bg-muted-foreground/40'}`} />
                    ))}
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-border/50 bg-card/80 backdrop-blur-sm shadow-lg transition-all duration-500 hover:scale-110 disabled:opacity-30" disabled={!canNext} onClick={() => setActiveIndex(i => Math.min(sorted.length - 1, i + 1))}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex justify-center gap-4 px-2">
                {visible.map((p) => {
                    const isPaid = p.status === "paid";
                    const isPending = p.status === "pending";
                    const isCurrent = p._idx === activeIndex;
                    const isCenter = p.reference_month === currentMonth;

                    return (
                        <div key={p.id} className="transition-all duration-700 ease-out" style={{ transform: isCurrent ? 'scale(1.05)' : 'scale(0.92)', opacity: isCurrent ? 1 : 0.6, filter: isCurrent ? 'none' : 'blur(1px)' }}>
                            <div className={`relative w-48 rounded-2xl p-5 border transition-all duration-700 overflow-hidden ${isCurrent ? 'shadow-2xl border-primary/30' : 'shadow-md border-border/30'}`} style={{
                                background: isPaid ? 'linear-gradient(135deg, hsl(var(--primary)/0.08), hsl(142 76% 36%/0.08))' : isPending ? 'linear-gradient(135deg, hsl(var(--card)), hsl(45 93% 47%/0.08))' : 'linear-gradient(135deg, hsl(var(--card)), hsl(var(--destructive)/0.08))',
                            }}>
                                {isCurrent && (
                                    <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
                                        boxShadow: isPaid ? '0 0 40px hsl(142 76% 36%/0.15)' : isPending ? '0 0 40px hsl(45 93% 47%/0.15)' : '0 0 40px hsl(var(--destructive)/0.15)',
                                    }} />
                                )}
                                {isCenter && (
                                    <div className="absolute top-2 right-2">
                                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
                                    </div>
                                )}
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{formatMonth(p.reference_month)}</p>
                                <p className="text-2xl font-bold text-foreground mb-3 tracking-tight">R$ {Number(p.amount).toFixed(2)}</p>
                                <Badge variant={isPaid ? "default" : isPending ? "secondary" : "destructive"} className="gap-1.5 mb-3 text-[11px] font-medium">
                                    {isPaid ? <CheckCircle className="h-3 w-3" /> : isPending ? <Clock className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                    {isPaid ? "Pago" : isPending ? "Pendente" : "Vencido"}
                                </Badge>
                                {p.payment_date && <p className="text-[10px] text-muted-foreground mb-1">Pago em {new Date(p.payment_date).toLocaleDateString("pt-BR")}</p>}
                                {p.due_date && !isPaid && <p className="text-[10px] text-muted-foreground mb-2">Vence em {new Date(p.due_date).toLocaleDateString("pt-BR")}</p>}
                                {!isPaid && (
                                    <Button size="sm" variant={isCurrent ? "default" : "outline"} className="w-full mt-1 h-8 text-xs gap-1.5 rounded-lg transition-all duration-300" onClick={() => onPayInvoice(p)}>
                                        <CreditCard className="h-3.5 w-3.5" /> Pagar
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
