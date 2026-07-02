import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminStackParamList } from '../types';
import { AdminHomeScreen }      from '../../screens/admin/AdminHomeScreen';
import { SecGovScreen }         from '../../screens/admin/SecGovScreen';
import { AuditScreen }          from '../../screens/admin/AuditScreen';
import { UsersScreen }          from '../../screens/admin/UsersScreen';
import { UserDetailScreen }     from '../../screens/admin/UserDetailScreen';
import { UserPermissionsScreen }from '../../screens/admin/UserPermissionsScreen';
import { RolesScreen }          from '../../screens/admin/RolesScreen';
import { RoleDetailScreen }     from '../../screens/admin/RoleDetailScreen';
import { TrashScreen }          from '../../screens/admin/TrashScreen';
import { ChangesScreen }        from '../../screens/admin/ChangesScreen';
import { AutomationHomeScreen }        from '../../screens/automation/AutomationHomeScreen';
import { AutomationRulesScreen }       from '../../screens/automation/AutomationRulesScreen';
import { AutomationRuleDetailScreen }  from '../../screens/automation/AutomationRuleDetailScreen';
import { AutomationEscalationsScreen } from '../../screens/automation/AutomationEscalationsScreen';
import { AutomationHistoryScreen }     from '../../screens/automation/AutomationHistoryScreen';
import { AutomationJobsScreen }        from '../../screens/automation/AutomationJobsScreen';

const Stack = createNativeStackNavigator<AdminStackParamList>();

export function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminHome"        component={AdminHomeScreen} />
      <Stack.Screen name="SecGov"           component={SecGovScreen} />
      <Stack.Screen name="Audit"            component={AuditScreen} />
      <Stack.Screen name="Users"            component={UsersScreen} />
      <Stack.Screen name="UserDetail"       component={UserDetailScreen} />
      <Stack.Screen name="UserPermissions"  component={UserPermissionsScreen} />
      <Stack.Screen name="Roles"            component={RolesScreen} />
      <Stack.Screen name="RoleDetail"       component={RoleDetailScreen} />
      <Stack.Screen name="Trash"            component={TrashScreen} />
      <Stack.Screen name="Changes"               component={ChangesScreen} />
      <Stack.Screen name="AutomationHome"        component={AutomationHomeScreen} />
      <Stack.Screen name="AutomationRules"       component={AutomationRulesScreen} />
      <Stack.Screen name="AutomationRuleDetail"  component={AutomationRuleDetailScreen} />
      <Stack.Screen name="AutomationEscalations" component={AutomationEscalationsScreen} />
      <Stack.Screen name="AutomationHistory"     component={AutomationHistoryScreen} />
      <Stack.Screen name="AutomationJobs"        component={AutomationJobsScreen} />
    </Stack.Navigator>
  );
}
