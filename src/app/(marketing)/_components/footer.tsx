import Link from "next/link";
import { Bot } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-zinc-950/50 backdrop-blur-lg pt-16 pb-8">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
            <Link href="/site" className="flex items-center space-x-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/50">
                <Bot className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-white">Master<span className="text-emerald-600 dark:text-emerald-400">IA</span></span>
            </Link>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-sm">
              Plataforma completa de gestão de conversas e automação com Inteligência Artificial para vendas no WhatsApp.
            </p>
          </div>
          
          <div>
            <h4 className="text-zinc-900 dark:text-white font-semibold mb-4">Produto</h4>
            <ul className="space-y-2">
              <li><Link href="#" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">Recursos</Link></li>
              <li><Link href="#" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">Preços</Link></li>
              <li><Link href="#" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">Integrações</Link></li>
              <li><Link href="#" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">Agentes IA</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-zinc-900 dark:text-white font-semibold mb-4">Empresa</h4>
            <ul className="space-y-2">
              <li><Link href="/termos" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">Termos de Serviço</Link></li>
              <li><Link href="/politicas" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">Privacidade</Link></li>
              <li><Link href="#" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">Contato</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-zinc-200 dark:border-white/5 flex flex-col md:flex-row items-center justify-between">
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} MasterIA. Todos os direitos reservados.
          </p>
          <div className="flex space-x-4 mt-4 md:mt-0">
            {/* Social links could go here */}
          </div>
        </div>
      </div>
    </footer>
  );
}
