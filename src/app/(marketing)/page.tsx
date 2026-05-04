
import { Header } from '@/components/landing/header';
import { HeroSection } from '@/components/landing/hero-section';
import { FeaturesSection } from '@/components/landing/features-section';
import { TestimonialsSection } from '@/components/landing/testimonials-section';
import { PricingSection } from '@/components/landing/pricing-section';
import { ContactSection } from '@/components/landing/contact-section';
import { Footer } from '@/components/landing/footer';
import { ThemeToggle } from '@/components/landing/theme-toggle';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <TestimonialsSection />
        <PricingSection />
        <ContactSection />
      </main>
      <Footer />
      <ThemeToggle />
    </div>
  );
}
