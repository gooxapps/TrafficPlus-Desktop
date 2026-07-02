import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Clock } from 'lucide-react';

export default function ComingSoon({ onContactAdmin }: { onContactAdmin?: () => void }) {
  return (
    <div className="max-w-2xl mx-auto py-24">
      <Card className="text-center p-10">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-3">
            <Clock className="w-6 h-6 text-muted-foreground" /> Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">This feature is not yet available. An administrator can enable it from the Admin panel.</p>
          {onContactAdmin && (
            <div className="mt-6">
              <Button onClick={onContactAdmin}>Contact Admin</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
