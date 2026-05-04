export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

interface NotifyOptions {
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

const DEFAULT_DURATION = 4000;

const variantMap: Record<ToastVariant, { variant?: 'default' | 'destructive' }> = {
  default: { variant: 'default' },
  success: { variant: 'default' },
  error: { variant: 'destructive' },
  warning: { variant: 'destructive' },
  info: { variant: 'default' },
};

type ToastFunction = (...args: any[]) => any;

export function createToastNotifier(toast: ToastFunction) {
  return {
    notify: ({ variant, title, description, duration = DEFAULT_DURATION }: NotifyOptions) => {
      toast({
        ...variantMap[variant],
        title,
        description,
        duration,
      });
    },
    
    success: (title: string, description?: string) => {
      toast({
        variant: 'default',
        title,
        description,
        duration: DEFAULT_DURATION,
      });
    },
    
    error: (title: string, description?: string) => {
      toast({
        variant: 'destructive',
        title,
        description,
        duration: DEFAULT_DURATION,
      });
    },
    
    warning: (title: string, description?: string) => {
      toast({
        variant: 'destructive',
        title,
        description,
        duration: DEFAULT_DURATION,
      });
    },
    
    info: (title: string, description?: string) => {
      toast({
        variant: 'default',
        title,
        description,
        duration: DEFAULT_DURATION,
      });
    },
  };
}
