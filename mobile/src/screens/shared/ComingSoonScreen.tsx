import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { EmptyState } from '../../components/EmptyState';
import { Colors } from '../../theme';

export function ComingSoonScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <EmptyState
          icon="construct-outline"
          title="Coming in Sprint 2"
          subtitle="This screen is planned and will be built in the next sprint."
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
