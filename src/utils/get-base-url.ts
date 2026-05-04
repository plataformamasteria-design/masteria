export function getBaseUrl(): string {
  // Prioriza domínio customizado (masteria.app)
  if (process.env.NEXT_PUBLIC_CUSTOM_DOMAIN) {
    return `https://${process.env.NEXT_PUBLIC_CUSTOM_DOMAIN}`;
  }
  
  // Em produção/desenvolvimento: usar o endereço atual 
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  
  if (process.env.NEXT_PUBLIC_BASE_URL && !process.env.NEXT_PUBLIC_BASE_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  
  return 'http://localhost:5000';
}
