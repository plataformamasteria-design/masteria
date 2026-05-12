import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useProjectInitializer = () => {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeProject = async () => {
      try {
        // Verificar se já foi inicializado (localStorage para evitar múltiplas chamadas)
        const hasInitialized = localStorage.getItem('project_initialized');
        
        if (hasInitialized) {
          setInitialized(true);
          return;
        }

        console.log('Initializing project...');

        // Chamar edge function de inicialização
        const { error: initError } = await supabase.functions.invoke('initialize-project');

        if (initError) {
          console.error('Error initializing project:', initError);
          setError(initError.message);
        } else {
          console.log('Project initialized successfully');
          localStorage.setItem('project_initialized', 'true');
          setInitialized(true);
        }
      } catch (err) {
        console.error('Unexpected error during initialization:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    initializeProject();
  }, []);

  return { initialized, error };
};
