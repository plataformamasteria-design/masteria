import useSWR from "swr";
import { supabase } from "@/lib/supabase";

const fetcher = async (mes: string) => {
    if (!mes) return null;
    const { data, error } = await supabase.from("config_mensal").select("*").eq("mes_referencia", mes).single();
    // Se não existir, retorna null ao invés de lançar erro fatal
    if (error && error.code !== "PGRST116") throw new Error(error.message);
    return data || null;
};

export function useConfigGlobal(mes: string) {
    const { data, error, mutate, isLoading } = useSWR(
        mes ? ["config_mensal", mes] : null,
        () => fetcher(mes),
        { revalidateOnFocus: true, dedupingInterval: 60000 }
    );

    return { config: data, isLoading, isError: !!error, mutate };
}
