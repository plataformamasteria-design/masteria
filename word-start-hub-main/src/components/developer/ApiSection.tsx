import { cn } from "@/lib/utils";

interface ApiSectionProps {
  id: string;
  title: string;
  description?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
}

export function ApiSection({ 
  id, 
  title, 
  description, 
  icon: Icon, 
  children,
  className
}: ApiSectionProps) {
  return (
    <section 
      id={id} 
      className={cn("scroll-mt-6 space-y-5", className)}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </section>
  );
}
