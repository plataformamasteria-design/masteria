// src/app/(main)/admin/layout.tsx
import { getUserSession } from "@/app/actions";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
    const sessionData = await getUserSession();

    if (sessionData.user?.role !== 'superadmin') {
        redirect('/dashboard');
    }

    return <>{children}</>;
}
