import { Providers } from '@/components/providers';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      {children}
    </Providers>
  );
}
