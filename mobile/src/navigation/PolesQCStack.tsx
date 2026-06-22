import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PolesQCStackParamList }      from './types';
import { PolesQCListScreen }          from '../screens/poles/PolesQCListScreen';
import { PolesQualityCheckScreen }    from '../screens/poles/PolesQualityCheckScreen';

const Stack = createNativeStackNavigator<PolesQCStackParamList>();

export function PolesQCStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="PolesQCList"   component={PolesQCListScreen} />
      <Stack.Screen name="PolesQCDetail" component={PolesQualityCheckScreen} />
    </Stack.Navigator>
  );
}
