import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { StockTransfersStackParamList } from '../types';
import { StockTransfersListScreen }    from '../../screens/stockTransfers/StockTransfersListScreen';
import { StockTransferFormScreen }     from '../../screens/stockTransfers/StockTransferFormScreen';
import { StockTransferDispatchScreen } from '../../screens/stockTransfers/StockTransferDispatchScreen';
import { StockTransferDetailScreen }   from '../../screens/stockTransfers/StockTransferDetailScreen';

const Stack = createNativeStackNavigator<StockTransfersStackParamList>();

export function StockTransfersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StockTransfersList"      component={StockTransfersListScreen} />
      <Stack.Screen name="StockTransferNewRequest" component={StockTransferFormScreen} />
      <Stack.Screen name="StockTransferDispatch"   component={StockTransferDispatchScreen} />
      <Stack.Screen name="StockTransferDetail"     component={StockTransferDetailScreen} />
    </Stack.Navigator>
  );
}
