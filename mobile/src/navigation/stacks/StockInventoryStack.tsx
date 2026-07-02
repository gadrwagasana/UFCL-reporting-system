import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StockInventoryStackParamList } from '../types';
import { StockLevelsScreen } from '../../screens/stock/StockLevelsScreen';

const Stack = createNativeStackNavigator<StockInventoryStackParamList>();

export function StockInventoryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StockInventoryList" component={StockLevelsScreen} />
    </Stack.Navigator>
  );
}
