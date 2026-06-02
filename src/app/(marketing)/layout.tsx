import { Space_Grotesk } from 'next/font/google';
import { Providers } from '@/components/providers';
import { ThemeToggle } from '@/components/landing/theme-toggle';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] });

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className={`bg-background h-screen w-full overflow-y-auto overflow-x-hidden text-foreground ${spaceGrotesk.className} relative selection:bg-emerald-500/30`}>
        {/* Luzes globais para marketing */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          <div className="absolute -top-[20%] -left-[10%] h-[600px] w-[600px] rounded-full bg-emerald-500/10 blur-[120px]" />
          <div className="absolute top-[20%] -right-[10%] h-[400px] w-[400px] rounded-full bg-cyan-500/5 blur-[100px]" />
          <div className="absolute -bottom-[10%] left-[20%] h-[600px] w-[600px] rounded-full bg-purple-500/5 blur-[150px]" />
        </div>
        
        <div className="relative z-10 w-full min-h-full flex flex-col">
          {children}
        </div>
        <ThemeToggle />
      </div>
    </Providers>
  );
}
