
import React from 'react';

type PageHeaderProps = {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
};

export function PageHeader({ title, description, icon: Icon, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-8 h-8 text-muted-foreground" />}
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {title}
          </h1>
        </div>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto md:ml-auto">
        {children}
      </div>
    </div>
  );
}
