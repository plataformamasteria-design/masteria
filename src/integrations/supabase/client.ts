export const supabase = {
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
