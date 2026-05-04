import { PageHeader } from '@/components/page-header';
import { getCompanyIdFromSession } from '@/app/actions';
import MarketingClient from './marketing-client';

export default async function MarketingPage() {
    const companyId = await getCompanyIdFromSession();

    return (
        <div className="space-y-8">
            <MarketingClient companyId={companyId} />
        </div>
    );
}
