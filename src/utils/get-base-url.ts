export function getBaseUrl(): string {
  // CORREÇÃO: Forçar uso do domínio público da Railway para evitar erros com envs configuradas como localhost
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }

  // Prioriza domínio customizado (masteria.app)
  if (process.env.NEXT_PUBLIC_CUSTOM_DOMAIN && !process.env.NEXT_PUBLIC_CUSTOM_DOMAIN.includes('localhost')) {
    return `https://${process.env.NEXT_PUBLIC_CUSTOM_DOMAIN}`;
  }
  
  // Em produção/desenvolvimento: usar o endereço atual 
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  
  if (process.env.NEXT_PUBLIC_BASE_URL && !process.env.NEXT_PUBLIC_BASE_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  
  return 'https://masteria.app';
}
