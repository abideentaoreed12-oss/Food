'use client';

import React from 'react';
import { CourierView } from '../../src/components/courier/CourierView';
import { PortalAuthGuard } from '../../src/components/auth/PortalAuthGuard';

export function CourierPortalRoute() {
  return (
    <PortalAuthGuard requiredRole="courier">
      <CourierView />
    </PortalAuthGuard>
  );
}
