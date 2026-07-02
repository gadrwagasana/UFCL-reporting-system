import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StockMovementsStackParamList } from '../types';
import { StockMovementsScreen }     from '../../screens/stock/StockMovementsScreen';
import { StockMovementFormScreen }  from '../../screens/stock/StockMovementFormScreen';

const Stack = createNativeStackNavigator<StockMovementsStackParamList>();

export function StockMovementsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StockMovementsList" component={StockMovementsScreen} />
      <Stack.Screen name="StockMovementForm"  component={StockMovementFormScreen} />
    </Stack.Navigator>
  );
}
