import Link from 'next/link';
import { BotMessageSquare, Twitter, Linkedin, Facebook } from 'lucide-react';
import { Button } from '../ui/button';
import VersionBadge from '../version-badge';

const footerLinks = {
  produto: [
    { label: 'Funcionalidades', href: '#features' },
    { label: 'Preços', href: '#pricing' },
    { label: 'Testemunhos', href: '#testimonials' },
    { label: 'Login', href: '/login' },
  ],
  empresa: [
    { label: 'Sobre Nós', href: '#' },
    { label: 'Carreiras', href: '#' },
    { label: 'Contato', href: '#contact' },
  ],
  recursos: [
    { label: 'Blog', href: '#' },
    { label: 'Documentação', href: '#' },
    { label: 'Status do Sistema', href: '#' },
  ],
};

export function Footer() {
  return (
    <footer className="bg-muted/30 border-t border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-foreground">
              <BotMessageSquare className="h-7 w-7 text-primary" />
              <span>Master IA</span>
            </Link>
            <p className="mt-4 text-muted-foreground max-w-xs">
              Transforme seu WhatsApp em uma máquina de vendas e atendimento.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Produto</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.produto.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-muted-foreground hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Empresa</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.empresa.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-muted-foreground hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
           <div>
            <h3 className="font-semibold text-foreground">Recursos</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.recursos.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-muted-foreground hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center">
            <div className="flex flex-col sm:flex-row items-center gap-4">
                 <p className="text-sm text-muted-foreground">
                    © {new Date().getFullYear()} Master IA. Todos os direitos reservados.
                </p>
                <VersionBadge prefix="v" />
            </div>
          <div className="flex items-center gap-1 mt-4 sm:mt-0">
             <Link href="#" passHref><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary"><Twitter /></Button></Link>
             <Link href="#" passHref><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary"><Facebook /></Button></Link>
             <Link href="#" passHref><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary"><Linkedin /></Button></Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
