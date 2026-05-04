"use client";

import React, { createContext, useContext } from 'react';

// Contexto Estático (Mock) para compatibilidade da Interface do FlowEditor exportado do legado.
// As queries reais da MasterIA utilizam a Server Action requireAuthOr401() e independem deste state para segurança.
const OrganizationContext = createContext({
    currentOrganization: { id: "masteria-org-id" }
});

export const OrganizationProvider = ({ children }: { children: React.ReactNode }) => {
    return (
        <OrganizationContext.Provider value={{ currentOrganization: { id: "masteria-org-id" } }}>
            {children}
        </OrganizationContext.Provider>
    );
};

export const useOrganization = () => {
    return useContext(OrganizationContext);
};
