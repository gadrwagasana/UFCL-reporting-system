import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CustomersStackParamList } from '../types';
import { CustomersListScreen } from '../../screens/customers/CustomersListScreen';
import { CustomerFormScreen }  from '../../screens/customers/CustomerFormScreen';

const Stack = createNativeStackNavigator<CustomersStackParamList>();

export function CustomersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CustomersList" component={CustomersListScreen} />
      <Stack.Screen name="CustomerForm"  component={CustomerFormScreen}  />
    </Stack.Navigator>
  );
}
