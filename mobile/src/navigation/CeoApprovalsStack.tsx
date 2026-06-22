import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CeoApprovalsStackParamList } from './types';
import { ApprovalsScreen }      from '../screens/ceo/ApprovalsScreen';
import { ApprovalDetailScreen } from '../screens/ceo/ApprovalDetailScreen';

const Stack = createNativeStackNavigator<CeoApprovalsStackParamList>();

export function CeoApprovalsStack() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="PendingApprovals" component={ApprovalsScreen} />
      <Stack.Screen name="ApprovalDetail"   component={ApprovalDetailScreen} />
    </Stack.Navigator>
  );
}
