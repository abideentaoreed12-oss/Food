'use client';

import React from 'react';
import { AdminPortal } from '../../src/components/admin/AdminPortal';
import { PortalAuthGuard } from '../../src/components/auth/PortalAuthGuard';

export function AdminPortalRoute() {
  return (
    <PortalAuthGuard requiredRole="admin">
      <AdminPortal />
    </PortalAuthGuard>
  );
}
