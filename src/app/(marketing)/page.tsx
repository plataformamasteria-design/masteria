import { SiteHeader } from './_components/site-header';
import { HeroSection } from './_components/hero-section';
import { FeaturesGrid } from './_components/features-grid';
import { SiteFooter } from './_components/footer';

export default function SitePage() {
  return (
    <div className="relative z-10 flex min-h-screen flex-col w-full">
      <SiteHeader />
      <main className="flex-1 w-full relative z-10">
        <HeroSection />
        <FeaturesGrid />
      </main>
      <SiteFooter />
    </div>
  );
}
