// src/components/ui/simple-markdown-parser.tsx
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

// Componente aprimorado para renderizar conteúdo Markdown básico em JSX
export const SimpleMarkdownParser = ({ content }: { content: string }): React.ReactElement => {
    const sections = content.split('---');

    return (
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
            {sections.map((section, sectionIndex) => (
                 <div key={sectionIndex} className="space-y-4">
                     {section.trim().split('\n').map((line, index) => {
                        if (line.startsWith('# ')) {
                            return <h1 key={index} className="text-3xl font-bold mt-8 mb-4 border-b pb-2">{line.substring(2)}</h1>;
                        }
                        if (line.startsWith('## ')) {
                            return (
                                <CardHeader key={index} className="p-0 mt-6 mb-2">
                                    <CardTitle className="text-2xl">{line.substring(3)}</CardTitle>
                                </CardHeader>
                            )
                        }
                        if (line.startsWith('### ')) {
                            return <h3 key={index} className="text-xl font-semibold mt-4 mb-2">{line.substring(4)}</h3>;
                        }
                         if (line.startsWith('- **')) {
                            const match = line.match(/- \*\*(.*?):\*\* (.*)/);
                            return (
                                <p key={index} className="my-1">
                                    <strong className="font-semibold text-primary">{match ? `${match[1]}:` : ''}</strong>
                                    {' '}
                                    {match ? match[2] : line.substring(2)}
                                </p>
                            );
                        }
                        if (line.startsWith('- ')) {
                            return (
                                <div key={index} className="flex items-start gap-3">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                                    <span>{line.substring(2)}</span>
                                </div>
                            )
                        }
                        if (line.match(/\[(.*?)\]\((.*?)\)/)) { // Basic link support
                            const match = line.match(/\[(.*?)\]\((.*?)\)/);
                            if (!match) return <p key={index}>{line}</p>;
                            
                            const textBefore = line.substring(0, match.index);
                            const linkText = match[1] || '';
                            const linkHref = match[2] || '#';
                            const textAfter = line.substring((match.index || 0) + match[0].length);

                            return (
                                <p key={index} className="my-2">
                                    {textBefore}
                                    <Link href={linkHref} className="text-primary hover:underline">{linkText}</Link>
                                    {textAfter}
                                </p>
                            );
                        }
                        if (line.trim() === '') {
                            return null;
                        }
                        return <CardDescription key={index}>{line}</CardDescription>;
                    })}
                 </div>
            ))}
        </div>
    );
};
