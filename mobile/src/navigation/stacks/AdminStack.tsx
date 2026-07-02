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
      <Stack.Screen name="Changes"          component={ChangesScreen} />
    </Stack.Navigator>
  );
}
