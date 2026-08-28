import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CustomersStackParamList } from '../types';
import { CustomersListScreen } from '../../screens/customers/CustomersListScreen';
import { CustomerFormScreen }  from '../../screens/customers/CustomerFormScreen';
import { CustomerDetailScreen } from '../../screens/customers/CustomerDetailScreen';

const Stack = createNativeStackNavigator<CustomersStackParamList>();

export function CustomersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CustomersList"  component={CustomersListScreen} />
      <Stack.Screen name="CustomerForm"   component={CustomerFormScreen}  />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
    </Stack.Navigator>
  );
}
