import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProductsStackParamList } from '../types';
import { ProductsListScreen } from '../../screens/products/ProductsListScreen';
import { ProductFormScreen }  from '../../screens/products/ProductFormScreen';

const Stack = createNativeStackNavigator<ProductsStackParamList>();

export function ProductsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProductsList" component={ProductsListScreen} />
      <Stack.Screen name="ProductForm"  component={ProductFormScreen}  />
    </Stack.Navigator>
  );
}
