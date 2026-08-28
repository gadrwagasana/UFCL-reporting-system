import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PolesProductionStackParamList } from './types';
import { PolesProductionScreen }       from '../screens/poles/PolesProductionScreen';
import { PolesProductionCreateScreen } from '../screens/poles/PolesProductionCreateScreen';
import { PolesProductionDetailScreen } from '../screens/poles/PolesProductionDetailScreen';
import { PoleBatchListScreen }    from '../screens/poles/PoleBatchListScreen';
import { PoleBatchCreateScreen }  from '../screens/poles/PoleBatchCreateScreen';
import { PoleBatchInspectScreen } from '../screens/poles/PoleBatchInspectScreen';
import { PurchasedPoleQCScreen }        from '../screens/poles/PurchasedPoleQCScreen';
import { PurchasedPoleQCInspectScreen } from '../screens/poles/PurchasedPoleQCInspectScreen';
import { PoleRejectionHoldsScreen }     from '../screens/poles/PoleRejectionHoldsScreen';

const Stack = createNativeStackNavigator<PolesProductionStackParamList>();

export function PolesProductionStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="PolesProductionList"   component={PolesProductionScreen} />
      <Stack.Screen name="PolesProductionCreate" component={PolesProductionCreateScreen} />
      <Stack.Screen name="PolesProductionDetail" component={PolesProductionDetailScreen} />
      {/* Pole Production Phase 1 — new batch+output-lines capability, reached via a stack push (see types.ts) */}
      <Stack.Screen name="PoleBatchList"    component={PoleBatchListScreen} />
      <Stack.Screen name="PoleBatchCreate"  component={PoleBatchCreateScreen} />
      <Stack.Screen name="PoleBatchInspect" component={PoleBatchInspectScreen} />
      {/* Pole Production Phase 2 — Purchased Finished Poles + the mobile
          rejection-holds screen Phase 1 deferred (now covers both sources) */}
      <Stack.Screen name="PurchasedPoleQC"        component={PurchasedPoleQCScreen} />
      <Stack.Screen name="PurchasedPoleQCInspect" component={PurchasedPoleQCInspectScreen} />
      <Stack.Screen name="PoleRejectionHolds"     component={PoleRejectionHoldsScreen} />
    </Stack.Navigator>
  );
}
