'use client'

import { useState } from 'react'
import { Info, X } from 'lucide-react'
import { avisoAtribuicaoIncompleta } from '@/lib/atribuicao'

interface AtribuicaoIncompletaAlertProps {
  periodo: { inicio: Date | string; fim: Date | string }
}

const STORAGE_KEY = 'atribuicao_alert_dismissed'

export function AtribuicaoIncompletaAlert({ periodo }: AtribuicaoIncompletaAlertProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  })

  const { mostrar, mensagem } = avisoAtribuicaoIncompleta(periodo)

  if (!mostrar || dismissed) return null

  return (
    <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
      <Info size={18} className="mt-0.5 shrink-0 text-yellow-400" />
      <span className="flex-1">{mensagem}</span>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(STORAGE_KEY, '1')
          setDismissed(true)
        }}
        className="shrink-0 rounded p-1 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
        aria-label="Entendi"
      >
        <X size={16} />
      </button>
    </div>
  )
}
