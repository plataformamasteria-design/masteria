import React from 'react';
import AppShell from '@/components/AppShell';
import PagePermissionGuard from '@/components/PagePermissionGuard';
import { TeamManager } from '@/components/teams/TeamManager';

const Teams = () => {
  return (
    <AppShell>
      <PagePermissionGuard page="teams">
        <TeamManager />
      </PagePermissionGuard>
    </AppShell>
  );
};

export default Teams;
