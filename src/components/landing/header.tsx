'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BotMessageSquare, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '#features', label: 'Funcionalidades' },
  { href: '#pricing', label: 'Preços' },
  { href: '#testimonials', label: 'Testemunhos' },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-colors duration-300',
        scrolled || mobileMenuOpen ? 'bg-background/80 backdrop-blur-sm border-b border-border' : 'bg-transparent'
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-foreground">
            <BotMessageSquare className="h-7 w-7 text-primary" />
            <span>Master IA</span>
          </Link>
          
          <nav className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          
          <div className="hidden md:flex items-center gap-2">
            <Link href="/login" passHref>
              <Button variant="outline">Login</Button>
            </Link>
            <Link href="/register" passHref>
              <Button>Comece Grátis</Button>
            </Link>
          </div>
          
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-foreground"
            >
              {mobileMenuOpen ? <X /> : <Menu />}
              <span className="sr-only">Toggle menu</span>
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden pb-4 border-b border-border bg-background/95">
          <nav className="flex flex-col items-center space-y-4 pt-4">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-base font-medium text-foreground hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="flex flex-col w-full px-4 gap-2">
                <Link href="/login" passHref>
                    <Button variant="outline" className="w-full">Login</Button>
                </Link>
                <Link href="/register" passHref>
                    <Button className="w-full">Comece Grátis</Button>
                </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
