
import { cookies } from 'next/headers';
import { getUserSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function DebugAuthPage() {
    const cookieStore = await cookies();
    const session = await getUserSession();

    const allCookies = cookieStore.getAll().map(c => ({
        name: c.name,
        value: c.value.substring(0, 15) + '...', // Mask value for security
    }));

    return (
        <div className="p-8 font-mono text-sm max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold mb-4">🔐 Auth Debugger</h1>

            <section className="border p-4 rounded bg-slate-100 dark:bg-slate-900">
                <h2 className="font-bold text-lg mb-2">1. Cookies (Server Side)</h2>
                {allCookies.length === 0 ? (
                    <p className="text-red-500">Nenhum cookie encontrado no request.</p>
                ) : (
                    <pre className="bg-black text-white p-4 rounded overflow-auto">
                        {JSON.stringify(allCookies, null, 2)}
                    </pre>
                )}
            </section>

            <section className="border p-4 rounded bg-slate-100 dark:bg-slate-900">
                <h2 className="font-bold text-lg mb-2">2. Session Action (getUserSession)</h2>
                <pre className="bg-black text-white p-4 rounded overflow-auto">
                    {JSON.stringify(session, null, 2)}
                </pre>
            </section>

            <section className="border p-4 rounded bg-slate-100 dark:bg-slate-900">
                <h2 className="font-bold text-lg mb-2">3. Environment</h2>
                <ul className="list-disc pl-5 space-y-1">
                    <li><strong>NODE_ENV:</strong> {process.env.NODE_ENV}</li>
                    <li><strong>NEXTAUTH_URL:</strong> {process.env.NEXTAUTH_URL}</li>
                    <li><strong>Timestamp:</strong> {new Date().toISOString()}</li>
                </ul>
            </section>

            <div className="mt-8 p-4 bg-yellow-100 text-yellow-800 rounded">
                <strong>Nota:</strong> Se você vê esta página, o Git Pull funcionou!
            </div>
        </div>
    );
}
