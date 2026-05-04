// src/app/(main)/changelog/page.tsx
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { promises as fs } from 'fs';
import path from 'path';

// Simples parser de Markdown para JSX
const SimpleMarkdownParser = ({ content }: { content: string }) => {
    const lines = content.split('\n');
    return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
            {lines.map((line, index) => {
                if (line.startsWith('## [')) { // Ex: ## [2.1.3] - 2025-08-14
                    const match = line.match(/## \[(.*?)\] - (.*)/);
                    return (
                        <div key={index} className="mt-8 mb-4 border-b pb-2">
                             <h2 className="text-2xl font-bold">{match ? match[1] : line.substring(3)}</h2>
                             <p className="text-sm text-muted-foreground">{match ? match[2] : ''}</p>
                        </div>
                    );
                }
                if (line.startsWith('### ')) {
                    return <h3 key={index} className="text-lg font-semibold mt-4 mb-2">{line.substring(4)}</h3>;
                }
                 if (line.startsWith('- **')) {
                    const match = line.match(/- \*\*(.*?):\*\* (.*)/);
                    return (
                        <p key={index} className="ml-4">
                            <strong className="font-semibold text-primary">{match ? `${match[1]}:` : ''}</strong>
                            {' '}
                            {match ? match[2] : line.substring(2)}
                        </p>
                    );
                }
                if (line.startsWith('- ')) {
                    return <li key={index} className="ml-6 list-disc">{line.substring(2)}</li>;
                }
                if (line.trim() === '') {
                    return <br key={index} />;
                }
                return <p key={index}>{line}</p>;
            })}
        </div>
    );
};


export default async function ChangelogPage() {
  // Lê o conteúdo do ficheiro CHANGELOG.md na raiz do projeto
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  let changelogContent = '';
  try {
    changelogContent = await fs.readFile(changelogPath, 'utf-8');
  } catch (error) {
    changelogContent = 'Erro ao carregar o changelog. Verifique se o ficheiro CHANGELOG.md existe na raiz do projeto.';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Histórico de Alterações (Changelog)"
        description="Acompanhe todas as novas funcionalidades, melhorias e correções implementadas na plataforma."
      />
      <Card>
        <CardContent className="p-6">
           <SimpleMarkdownParser content={changelogContent} />
        </CardContent>
      </Card>
    </div>
  );
}
