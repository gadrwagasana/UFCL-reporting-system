import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StockCatalogStackParamList } from '../types';
import { StockCatalogScreen }    from '../../screens/stock/StockCatalogScreen';
import { StockItemFormScreen }   from '../../screens/stock/StockItemFormScreen';
import { StockCategoriesScreen } from '../../screens/stock/StockCategoriesScreen';

const Stack = createNativeStackNavigator<StockCatalogStackParamList>();

export function StockCatalogStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StockCatalogList" component={StockCatalogScreen} />
      <Stack.Screen name="StockItemForm"    component={StockItemFormScreen} />
      <Stack.Screen name="StockCategories"  component={StockCategoriesScreen} />
    </Stack.Navigator>
  );
}
