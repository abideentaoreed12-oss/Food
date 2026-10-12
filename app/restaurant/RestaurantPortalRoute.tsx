'use client';

import React from 'react';
import { RestaurantPortal } from '../../src/components/restaurant/RestaurantPortal';
import { PortalAuthGuard } from '../../src/components/auth/PortalAuthGuard';

export function RestaurantPortalRoute() {
  return (
    <PortalAuthGuard requiredRole="restaurant">
      <RestaurantPortal />
    </PortalAuthGuard>
  );
}
