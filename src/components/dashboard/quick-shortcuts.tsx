import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, MessageSquareText, UserPlus } from 'lucide-react';

export function QuickShortcuts() {
  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="text-lg">Atalhos Rápidos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Link href="/campaigns" passHref>
          <Button variant="outline" className="w-full justify-center">
            <PlusCircle className="mr-2 h-4 w-4" />
            Campanha
          </Button>
        </Link>
        <Link href="/templates" passHref>
          <Button variant="outline" className="w-full justify-center">
            <MessageSquareText className="mr-2 h-4 w-4" />
            Modelo
          </Button>
        </Link>
        <Link href="/contacts" passHref>
          <Button variant="outline" className="w-full justify-center">
            <UserPlus className="mr-2 h-4 w-4" />
            Contato
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
