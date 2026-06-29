import React, { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useOfflineStore } from '../stores/offlineStore';
import { startNetworkMonitor, stopNetworkMonitor } from '../services/networkMonitor';
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
import { VatNavigator }                  from './VatNavigator';
import { HarvestSupervisorNavigator }   from './HarvestSupervisorNavigator';
import { SawmillSupervisorNavigator }   from './SawmillSupervisorNavigator';
import { PolesSupervisorNavigator }     from './PolesSupervisorNavigator';
import { VatSupervisorNavigator }       from './VatSupervisorNavigator';
import { FinanceNavigator }             from './FinanceNavigator';

export function MainNavigator() {
  const role      = useAuthStore((s) => s.user?.role) as UserRole | undefined;
  const loadQueue = useOfflineStore((s) => s.loadQueue);

  // Services are started here — after the user is authenticated — not at app
  // startup. This guarantees the Login screen renders with zero dependencies.
  useEffect(() => {
    loadQueue();
    startNetworkMonitor();
    return () => stopNetworkMonitor();
  }, [loadQueue]);

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

    case 'harvesting-supervisor':
      return <HarvestSupervisorNavigator />;

    case 'sawmill-supervisor':
      return <SawmillSupervisorNavigator />;

    case 'poles-supervisor':
      return <PolesSupervisorNavigator />;

    case 'vat-supervisor':
      return <VatSupervisorNavigator />;

    case 'finance':
      return <FinanceNavigator />;

    default:
      return <ComingSoonScreen />;
  }
}
