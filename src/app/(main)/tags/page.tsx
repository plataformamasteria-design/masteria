// src/app/(main)/tags/page.tsx
import { PageHeader } from '@/components/page-header';
import { TagsManager } from '@/components/settings/tags-manager';

export default function TagsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Gestão de Tags"
                description="Crie, edite e remova as tags para organizar seus contatos."
            />
            <TagsManager />
        </div>
    );
}
