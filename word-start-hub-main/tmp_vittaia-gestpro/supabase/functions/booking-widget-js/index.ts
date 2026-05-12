import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/javascript; charset=utf-8',
  'Cache-Control': 'public, max-age=3600',
};

const widgetCode = `/**
 * Booking Widget - Embeddable scheduling system
 * Usage: 
 * <div id="booking-widget" data-slug="your-org-slug"></div>
 * <script src="https://YOUR_DOMAIN/booking-widget.js"></script>
 */
(function() {
  'use strict';

  // Configuration
  const API_BASE_URL = window.BOOKING_API_URL || 'https://hupfrxzhpukeqvgurbdn.supabase.co/functions/v1/public-booking-api';
  
  // Styles
  const styles = \`
    .bw-container {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 480px;
      margin: 0 auto;
      padding: 20px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    }
    .bw-container * {
      box-sizing: border-box;
    }
    .bw-header {
      text-align: center;
      margin-bottom: 24px;
    }
    .bw-title {
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 8px 0;
    }
    .bw-description {
      font-size: 14px;
      color: #666;
      margin: 0;
    }
    .bw-loading {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 40px;
    }
    .bw-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid var(--bw-primary, #3B82F6);
      border-radius: 50%;
      animation: bw-spin 1s linear infinite;
    }
    @keyframes bw-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .bw-error {
      text-align: center;
      padding: 20px;
      color: #dc2626;
      background: #fef2f2;
      border-radius: 8px;
    }
    .bw-calendar {
      margin-bottom: 20px;
    }
    .bw-calendar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .bw-month-title {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
    }
    .bw-nav-btn {
      width: 36px;
      height: 36px;
      border: none;
      background: #f5f5f5;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .bw-nav-btn:hover {
      background: #e5e5e5;
    }
    .bw-nav-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .bw-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
      margin-bottom: 8px;
    }
    .bw-weekday {
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      color: #666;
      padding: 8px 0;
    }
    .bw-days {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }
    .bw-day {
      aspect-ratio: 1;
      border: none;
      background: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      color: #1a1a1a;
      transition: all 0.2s;
    }
    .bw-day:hover:not(:disabled) {
      background: #f5f5f5;
    }
    .bw-day:disabled {
      color: #ccc;
      cursor: not-allowed;
    }
    .bw-day.bw-selected {
      background: var(--bw-primary, #3B82F6);
      color: white;
    }
    .bw-day.bw-today {
      font-weight: 700;
      border: 2px solid var(--bw-primary, #3B82F6);
    }
    .bw-day.bw-other-month {
      color: #ccc;
    }
    .bw-times {
      margin-bottom: 20px;
    }
    .bw-times-title {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 12px;
    }
    .bw-times-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      max-height: 240px;
      overflow-y: auto;
    }
    .bw-time-slot {
      padding: 12px 8px;
      border: 1px solid #e5e5e5;
      background: white;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      text-align: center;
      transition: all 0.2s;
    }
    .bw-time-slot:hover:not(:disabled) {
      border-color: var(--bw-primary, #3B82F6);
      background: #f0f7ff;
    }
    .bw-time-slot:disabled {
      background: #f5f5f5;
      color: #999;
      cursor: not-allowed;
      text-decoration: line-through;
    }
    .bw-time-slot.bw-selected {
      background: var(--bw-primary, #3B82F6);
      color: white;
      border-color: var(--bw-primary, #3B82F6);
    }
    .bw-no-slots {
      text-align: center;
      padding: 20px;
      color: #666;
      background: #f9f9f9;
      border-radius: 8px;
    }
    .bw-form {
      margin-top: 20px;
    }
    .bw-form-group {
      margin-bottom: 16px;
    }
    .bw-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #1a1a1a;
      margin-bottom: 6px;
    }
    .bw-input {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      font-size: 16px;
      transition: border-color 0.2s;
    }
    .bw-input:focus {
      outline: none;
      border-color: var(--bw-primary, #3B82F6);
    }
    .bw-textarea {
      resize: vertical;
      min-height: 80px;
    }
    .bw-btn {
      width: 100%;
      padding: 14px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .bw-btn-primary {
      background: var(--bw-primary, #3B82F6);
      color: white;
    }
    .bw-btn-primary:hover:not(:disabled) {
      opacity: 0.9;
    }
    .bw-btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .bw-btn-secondary {
      background: #f5f5f5;
      color: #1a1a1a;
      margin-top: 8px;
    }
    .bw-btn-secondary:hover {
      background: #e5e5e5;
    }
    .bw-success {
      text-align: center;
      padding: 40px 20px;
    }
    .bw-success-icon {
      width: 64px;
      height: 64px;
      background: #22c55e;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .bw-success-icon svg {
      width: 32px;
      height: 32px;
      color: white;
    }
    .bw-success-title {
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 8px;
    }
    .bw-success-text {
      font-size: 14px;
      color: #666;
      margin-bottom: 24px;
    }
    .bw-summary {
      background: #f9f9f9;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      text-align: left;
    }
    .bw-summary-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e5e5;
    }
    .bw-summary-item:last-child {
      border-bottom: none;
    }
    .bw-summary-label {
      color: #666;
      font-size: 14px;
    }
    .bw-summary-value {
      color: #1a1a1a;
      font-size: 14px;
      font-weight: 500;
    }
    .bw-step-indicator {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-bottom: 24px;
    }
    .bw-step {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #e5e5e5;
    }
    .bw-step.bw-active {
      background: var(--bw-primary, #3B82F6);
    }
  \`;

  // Utility functions
  const formatDate = (date) => {
    return date.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Widget Class
  class BookingWidget {
    constructor(container, slug) {
      this.container = container;
      this.slug = slug;
      this.config = null;
      this.selectedDate = null;
      this.selectedSlot = null;
      this.currentMonth = new Date();
      this.slots = [];
      this.step = 1; // 1: calendar, 2: form, 3: success
      this.booking = null;
      
      this.init();
    }

    async init() {
      this.injectStyles();
      this.render();
      await this.loadConfig();
    }

    injectStyles() {
      if (!document.getElementById('bw-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'bw-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
      }
    }

    async loadConfig() {
      try {
        const response = await fetch(\`\${API_BASE_URL}/config?slug=\${this.slug}\`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao carregar configuração');
        }
        
        this.config = data;
        this.container.style.setProperty('--bw-primary', data.primary_color || '#3B82F6');
        this.render();
      } catch (error) {
        this.renderError(error.message);
      }
    }

    async loadAvailability(date) {
      try {
        const dateStr = date.toISOString().split('T')[0];
        const response = await fetch(\`\${API_BASE_URL}/availability?slug=\${this.slug}&date=\${dateStr}\`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao carregar horários');
        }
        
        this.slots = data.available_slots || [];
        this.render();
      } catch (error) {
        console.error('Error loading availability:', error);
        this.slots = [];
        this.render();
      }
    }

    async submitBooking(formData) {
      try {
        const response = await fetch(\`\${API_BASE_URL}/book\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_slug: this.slug,
            client_name: formData.name,
            client_phone: formData.phone,
            client_email: formData.email,
            client_notes: formData.notes,
            start_time: this.selectedSlot.start,
            end_time: this.selectedSlot.end,
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao criar agendamento');
        }
        
        this.booking = data.booking;
        this.step = 3;
        this.render();
      } catch (error) {
        alert(error.message);
      }
    }

    selectDate(date) {
      this.selectedDate = date;
      this.selectedSlot = null;
      this.loadAvailability(date);
    }

    selectSlot(slot) {
      this.selectedSlot = slot;
      this.step = 2;
      this.render();
    }

    goBack() {
      if (this.step === 2) {
        this.step = 1;
        this.selectedSlot = null;
        this.render();
      }
    }

    reset() {
      this.step = 1;
      this.selectedDate = null;
      this.selectedSlot = null;
      this.booking = null;
      this.slots = [];
      this.render();
    }

    changeMonth(delta) {
      this.currentMonth = new Date(
        this.currentMonth.getFullYear(),
        this.currentMonth.getMonth() + delta,
        1
      );
      this.render();
    }

    render() {
      if (!this.config) {
        this.container.innerHTML = \`
          <div class="bw-container">
            <div class="bw-loading">
              <div class="bw-spinner"></div>
            </div>
          </div>
        \`;
        return;
      }

      if (this.step === 3) {
        this.renderSuccess();
        return;
      }

      if (this.step === 2) {
        this.renderForm();
        return;
      }

      this.renderCalendar();
    }

    renderError(message) {
      this.container.innerHTML = \`
        <div class="bw-container">
          <div class="bw-error">
            <p>\${message}</p>
          </div>
        </div>
      \`;
    }

    renderCalendar() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + (this.config.max_advance_days || 30));
      
      const year = this.currentMonth.getFullYear();
      const month = this.currentMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDay = firstDay.getDay();
      
      let daysHtml = '';
      
      // Previous month days
      for (let i = 0; i < startDay; i++) {
        const day = new Date(year, month, -startDay + i + 1);
        daysHtml += \`<button class="bw-day bw-other-month" disabled>\${day.getDate()}</button>\`;
      }
      
      // Current month days
      for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(year, month, day);
        const isToday = date.getTime() === today.getTime();
        const isPast = date < today;
        const isFuture = date > maxDate;
        const isWorkingDay = this.config.working_days.includes(date.getDay());
        const isSelected = this.selectedDate && 
          date.toDateString() === this.selectedDate.toDateString();
        
        const disabled = isPast || isFuture || !isWorkingDay;
        const classes = [
          'bw-day',
          isToday ? 'bw-today' : '',
          isSelected ? 'bw-selected' : '',
        ].filter(Boolean).join(' ');
        
        daysHtml += \`
          <button 
            class="\${classes}" 
            \${disabled ? 'disabled' : ''}
            data-date="\${date.toISOString()}"
          >\${day}</button>
        \`;
      }
      
      // Time slots HTML
      let timesHtml = '';
      if (this.selectedDate) {
        if (this.slots.length === 0) {
          timesHtml = \`<div class="bw-no-slots">Nenhum horário disponível nesta data</div>\`;
        } else {
          const availableSlots = this.slots.filter(s => s.available);
          if (availableSlots.length === 0) {
            timesHtml = \`<div class="bw-no-slots">Todos os horários estão ocupados</div>\`;
          } else {
            timesHtml = \`
              <div class="bw-times-title">Horários disponíveis</div>
              <div class="bw-times-grid">
                \${this.slots.map(slot => \`
                  <button 
                    class="bw-time-slot \${!slot.available ? '' : ''}" 
                    \${!slot.available ? 'disabled' : ''}
                    data-slot='\${JSON.stringify(slot)}'
                  >
                    \${formatTime(slot.start)}
                  </button>
                \`).join('')}
              </div>
            \`;
          }
        }
      }

      this.container.innerHTML = \`
        <div class="bw-container">
          <div class="bw-header">
            <h2 class="bw-title">\${this.config.widget_title}</h2>
            <p class="bw-description">\${this.config.widget_description}</p>
          </div>
          
          <div class="bw-step-indicator">
            <div class="bw-step bw-active"></div>
            <div class="bw-step"></div>
            <div class="bw-step"></div>
          </div>
          
          <div class="bw-calendar">
            <div class="bw-calendar-header">
              <button class="bw-nav-btn" data-nav="-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
              <span class="bw-month-title">\${monthNames[month]} \${year}</span>
              <button class="bw-nav-btn" data-nav="1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>
            
            <div class="bw-weekdays">
              \${weekdayNames.map(d => \`<div class="bw-weekday">\${d}</div>\`).join('')}
            </div>
            
            <div class="bw-days">
              \${daysHtml}
            </div>
          </div>
          
          <div class="bw-times">
            \${timesHtml}
          </div>
        </div>
      \`;

      this.bindCalendarEvents();
    }

    renderForm() {
      this.container.innerHTML = \`
        <div class="bw-container">
          <div class="bw-header">
            <h2 class="bw-title">Complete seu agendamento</h2>
            <p class="bw-description">\${formatDate(this.selectedDate)} às \${formatTime(this.selectedSlot.start)}</p>
          </div>
          
          <div class="bw-step-indicator">
            <div class="bw-step bw-active"></div>
            <div class="bw-step bw-active"></div>
            <div class="bw-step"></div>
          </div>
          
          <form class="bw-form" id="bw-booking-form">
            <div class="bw-form-group">
              <label class="bw-label">Nome completo *</label>
              <input type="text" class="bw-input" name="name" required placeholder="Seu nome">
            </div>
            
            <div class="bw-form-group">
              <label class="bw-label">Telefone *</label>
              <input type="tel" class="bw-input" name="phone" required placeholder="(00) 00000-0000">
            </div>
            
            \${this.config.require_email ? \`
              <div class="bw-form-group">
                <label class="bw-label">E-mail \${this.config.require_email ? '*' : ''}</label>
                <input type="email" class="bw-input" name="email" \${this.config.require_email ? 'required' : ''} placeholder="seu@email.com">
              </div>
            \` : ''}
            
            \${this.config.require_notes ? \`
              <div class="bw-form-group">
                <label class="bw-label">Observações</label>
                <textarea class="bw-input bw-textarea" name="notes" placeholder="Alguma observação?"></textarea>
              </div>
            \` : ''}
            
            <button type="submit" class="bw-btn bw-btn-primary">Confirmar Agendamento</button>
            <button type="button" class="bw-btn bw-btn-secondary" id="bw-back-btn">Voltar</button>
          </form>
        </div>
      \`;

      this.bindFormEvents();
    }

    renderSuccess() {
      this.container.innerHTML = \`
        <div class="bw-container">
          <div class="bw-success">
            <div class="bw-success-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2 class="bw-success-title">Agendamento Confirmado!</h2>
            <p class="bw-success-text">Você receberá uma confirmação em breve.</p>
            
            <div class="bw-summary">
              <div class="bw-summary-item">
                <span class="bw-summary-label">Data</span>
                <span class="bw-summary-value">\${formatDate(this.selectedDate)}</span>
              </div>
              <div class="bw-summary-item">
                <span class="bw-summary-label">Horário</span>
                <span class="bw-summary-value">\${formatTime(this.selectedSlot.start)}</span>
              </div>
            </div>
            
            <button class="bw-btn bw-btn-secondary" id="bw-new-booking">Fazer novo agendamento</button>
          </div>
        </div>
      \`;

      this.container.querySelector('#bw-new-booking').addEventListener('click', () => {
        this.reset();
      });
    }

    bindCalendarEvents() {
      // Navigation
      this.container.querySelectorAll('[data-nav]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.changeMonth(parseInt(btn.dataset.nav));
        });
      });

      // Day selection
      this.container.querySelectorAll('.bw-day:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
          this.selectDate(new Date(btn.dataset.date));
        });
      });

      // Time slot selection
      this.container.querySelectorAll('.bw-time-slot:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
          this.selectSlot(JSON.parse(btn.dataset.slot));
        });
      });
    }

    bindFormEvents() {
      const form = this.container.querySelector('#bw-booking-form');
      const backBtn = this.container.querySelector('#bw-back-btn');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const submitBtn = form.querySelector('[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Aguarde...';
        
        await this.submitBooking({
          name: formData.get('name'),
          phone: formData.get('phone'),
          email: formData.get('email'),
          notes: formData.get('notes'),
        });
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirmar Agendamento';
      });

      backBtn.addEventListener('click', () => {
        this.goBack();
      });
    }
  }

  // Auto-initialize widgets
  function initWidgets() {
    const containers = document.querySelectorAll('[data-booking-widget]');
    console.log('[BookingWidget] Found containers:', containers.length);
    
    containers.forEach(container => {
      const slug = container.getAttribute('data-booking-widget');
      console.log('[BookingWidget] Initializing widget for slug:', slug);
      if (slug && !container._bookingWidgetInitialized) {
        container._bookingWidgetInitialized = true;
        new BookingWidget(container, slug);
      }
    });

    // Also support old format
    document.querySelectorAll('#booking-widget').forEach(container => {
      const slug = container.dataset.slug;
      if (slug && !container._bookingWidgetInitialized) {
        container._bookingWidgetInitialized = true;
        new BookingWidget(container, slug);
      }
    });
  }

  // Export for manual initialization
  window.BookingWidget = BookingWidget;
  window.initBookingWidgets = initWidgets;

  // Auto-init on DOM ready with multiple fallbacks
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidgets);
  } else {
    // DOM already loaded, init immediately
    initWidgets();
  }

  // Also try after a short delay for dynamic content (WordPress, etc.)
  setTimeout(initWidgets, 100);
  setTimeout(initWidgets, 500);
  setTimeout(initWidgets, 1000);
})();`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[booking-widget-js] Serving widget JavaScript');

  return new Response(widgetCode, {
    status: 200,
    headers: corsHeaders,
  });
});
