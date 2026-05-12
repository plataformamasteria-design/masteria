const mockSupabase: any = {
    from: (table: string) => {
        const chain: any = {
            select: () => chain,
            eq: () => chain,
            order: () => chain,
            delete: () => chain,
            insert: () => chain,
            update: () => chain,
            match: () => chain,
            single: async () => ({ data: null, error: null }),
            maybeSingle: async () => ({ data: null, error: null }),
            then: (resolve: any) => resolve({ data: [], error: null })
        };
        return chain;
    },
    functions: {
        invoke: async (name: string, payload: any) => ({ data: { message: "Mocked response" }, error: null })
    },
    auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null })
    }
};

export const supabase = mockSupabase as any;
export const SUPABASE_URL = "";
export const SUPABASE_PUBLISHABLE_KEY = "";
