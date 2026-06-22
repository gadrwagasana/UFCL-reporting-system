import React from 'react';
import { useAuthStore } from '../stores/authStore';
import { UserRole } from '../types/auth';
import { ComingSoonScreen } from '../screens/shared/ComingSoonScreen';

// Role navigators
import { CeoNavigator }            from './CeoNavigator';
import { SupervisorNavigator }     from './SupervisorNavigator';
import { HarvestNavigator }        from './HarvestNavigator';
import { SawmillNavigator }        from './SawmillNavigator';
import { PolesNavigator }          from './PolesNavigator';
import { MechanicianNavigator }    from './MechanicianNavigator';
import { OperationsNavigator }     from './OperationsNavigator';
import { LogisticsNavigator }      from './LogisticsNavigator';
import { SalesNavigator }          from './SalesNavigator';
import { StorekeeperNavigator }    from './StorekeeperNavigator';
import { VatNavigator }            from './VatNavigator';

export function MainNavigator() {
  const role = useAuthStore((s) => s.user?.role) as UserRole | undefined;

  switch (role) {
    case 'admin':
    case 'ceo':
      return <CeoNavigator />;

    case 'supervisor':
      return <SupervisorNavigator />;

    case 'harvesting-leader':
      return <HarvestNavigator />;

    case 'sawmill-leader':
      return <SawmillNavigator />;

    case 'poles-leader':
      return <PolesNavigator />;

    case 'mechanician':
      return <MechanicianNavigator />;

    case 'operations':
      return <OperationsNavigator />;

    case 'logistics':
    case 'logistics-officer':
      return <LogisticsNavigator />;

    case 'sales':
    case 'sales-staff':
      return <SalesNavigator />;

    case 'storekeeper':
    case 'storekeeper-assistant':
      return <StorekeeperNavigator />;

    case 'vat-leader':
      return <VatNavigator />;

    default:
      // 'finance' or unknown role
      return <ComingSoonScreen />;
  }
}
