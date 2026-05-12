import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Clock, CheckCircle2, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface BookingConfig {
  organization_name: string;
  widget_title: string;
  widget_description: string;
  primary_color: string;
  working_days: number[];
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  max_advance_days: number;
  min_advance_hours: number;
  services: Array<{ name: string; duration: number; description: string }>;
  require_phone: boolean;
  require_email: boolean;
  require_notes: boolean;
}

interface Slot {
  start: string;
  end: string;
  available: boolean;
}

// Format phone as (XX) XXXXX-XXXX
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// Format local date as YYYY-MM-DD without UTC shift
function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const calendarId = searchParams.get("c") || searchParams.get("calendar");

  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<any>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'jrxpjzgifyzhvwjfpofz';
  const apiUrl = `https://${projectId}.supabase.co/functions/v1/public-booking-api`;

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/config?slug=${slug}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro");
        setConfig(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const loadSlots = async (date: Date) => {
    setLoadingSlots(true);
    try {
      const dateStr = toLocalDateStr(date);
      let url = `${apiUrl}/availability?slug=${slug}&date=${dateStr}`;
      if (calendarId) url += `&calendar_id=${calendarId}`;
      const res = await fetch(url);
      const data = await res.json();
      setSlots(data.available_slots || []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    loadSlots(date);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_slug: slug,
          client_name: name,
          client_phone: phone,
          client_email: email || undefined,
          client_notes: notes || undefined,
          start_time: selectedSlot.start,
          end_time: selectedSlot.end,
          calendar_id: calendarId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBookingResult(data.booking);
      setStep(3);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Calendar grid
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const days: Array<{ date: Date; currentMonth: boolean }> = [];

    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), currentMonth: false });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), currentMonth: true });
    }
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), currentMonth: false });
      }
    }
    return days;
  }, [currentMonth]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = config ? new Date(today.getTime() + config.max_advance_days * 86400000) : null;

  const primaryColor = config?.primary_color || "#3B82F6";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: primaryColor }} />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <p className="text-destructive font-medium">{error || "Agendamento não disponível"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-xl border-0">
        <CardContent className="p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{config.widget_title}</h1>
            <p className="text-gray-500 mt-1">{config.widget_description}</p>
            <p className="text-sm font-medium mt-1" style={{ color: primaryColor }}>{config.organization_name}</p>
          </div>

          {/* Step indicators */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3].map(s => (
              <div key={s} className="w-2 h-2 rounded-full transition-colors" style={{ backgroundColor: step >= s ? primaryColor : "#e5e7eb" }} />
            ))}
          </div>

          {step === 1 && (
            <>
              {/* Calendar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 rounded-lg hover:bg-gray-100">
                    <ChevronLeft className="h-5 w-5 text-gray-600" />
                  </button>
                  <span className="font-semibold text-gray-900">
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </span>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 rounded-lg hover:bg-gray-100">
                    <ChevronRight className="h-5 w-5 text-gray-600" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                  {weekdayNames.map(d => (
                    <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map(({ date, currentMonth: isCurrent }, i) => {
                    const dayDate = new Date(date);
                    dayDate.setHours(0, 0, 0, 0);
                    const isPast = dayDate < today;
                    const isBeyondMax = maxDate ? dayDate > maxDate : false;
                    const isWorkingDay = config.working_days.includes(dayDate.getDay());
                    const isDisabled = !isCurrent || isPast || isBeyondMax || !isWorkingDay;
                    const isSelected = selectedDate && dayDate.getTime() === selectedDate.getTime();
                    const isToday = dayDate.getTime() === today.getTime();

                    return (
                      <button
                        key={i}
                        disabled={isDisabled}
                        onClick={() => handleSelectDate(dayDate)}
                        className={cn(
                          "aspect-square rounded-lg text-sm transition-all",
                          isDisabled && "text-gray-300 cursor-not-allowed",
                          !isDisabled && "hover:bg-gray-100 text-gray-900 cursor-pointer",
                          !isCurrent && "text-gray-300",
                          isToday && "font-bold ring-2",
                        )}
                        style={{
                          ...(isSelected ? { backgroundColor: primaryColor, color: "white" } : {}),
                          ...(isToday && !isSelected ? { ringColor: primaryColor } : {}),
                        }}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              {selectedDate && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                  </h3>
                  {loadingSlots ? (
                    <div className="flex justify-center py-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: primaryColor }} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                      {slots.filter(s => s.available).length === 0 ? (
                        <p className="col-span-3 text-center text-gray-500 py-4 bg-gray-50 rounded-lg">Sem horários disponíveis</p>
                      ) : (
                        slots.map((slot, i) => {
                          const time = new Date(slot.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                          const isSlotSelected = selectedSlot?.start === slot.start;
                          return (
                            <button
                              key={i}
                              disabled={!slot.available}
                              onClick={() => { setSelectedSlot(slot); setStep(2); }}
                              className={cn(
                                "py-3 px-2 rounded-lg text-sm border transition-all text-center",
                                !slot.available && "bg-gray-50 text-gray-400 line-through cursor-not-allowed",
                                slot.available && "hover:border-blue-300 cursor-pointer border-gray-200",
                              )}
                              style={isSlotSelected ? { backgroundColor: primaryColor, color: "white", borderColor: primaryColor } : {}}
                            >
                              {time}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>

              {selectedSlot && selectedDate && (
                <div className="bg-gray-50 p-4 rounded-lg mb-4 flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(selectedSlot.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} - {new Date(selectedSlot.end).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" required />
              </div>

              <div className="space-y-2">
                <Label>Telefone *</Label>
                <Input
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  required
                />
              </div>

              {config.require_email && (
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
                </div>
              )}

              {config.require_notes && (
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Alguma observação..." rows={3} />
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !name || !phone}
                style={{ backgroundColor: primaryColor }}
              >
                {submitting ? "Agendando..." : "Confirmar Agendamento"}
              </Button>
            </form>
          )}

          {step === 3 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#22c55e" }}>
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Agendamento Confirmado!</h2>
              <p className="text-gray-500 mb-4">Seu horário foi reservado com sucesso.</p>

              {selectedDate && selectedSlot && (
                <div className="bg-gray-50 p-4 rounded-lg mb-6 text-left">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-500 text-sm">Data</span>
                    <span className="text-gray-900 text-sm font-medium">
                      {selectedDate.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-500 text-sm">Horário</span>
                    <span className="text-gray-900 text-sm font-medium">
                      {new Date(selectedSlot.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {bookingResult?.cancellation_token && (
                    <div className="flex justify-between py-2">
                      <span className="text-gray-500 text-sm">Código de cancelamento</span>
                      <span className="text-gray-900 text-sm font-medium font-mono">
                        {bookingResult.cancellation_token.slice(0, 8)}...
                      </span>
                    </div>
                  )}
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => { setStep(1); setSelectedDate(null); setSelectedSlot(null); setName(""); setPhone(""); setEmail(""); setNotes(""); setBookingResult(null); }}
              >
                Fazer novo agendamento
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
