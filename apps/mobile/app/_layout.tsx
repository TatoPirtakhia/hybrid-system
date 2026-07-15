import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getDatabase } from '../src/database';
import { colors } from '../src/theme';

export default function RootLayout() {
  useEffect(() => { void getDatabase(); }, []);
  return <><StatusBar style="light" /><Stack screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerShadowVisible: false, contentStyle: { backgroundColor: colors.background } }}><Stack.Screen name="index" options={{ headerShown: false }} /><Stack.Screen name="safety" options={{ title: 'Safety notice' }} /><Stack.Screen name="setup" options={{ title: 'Adapter setup' }} /><Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} /><Stack.Screen name="diagnostics" options={{ title: 'Diagnostics' }} /><Stack.Screen name="trips" options={{ title: 'Trips' }} /><Stack.Screen name="battery" options={{ title: 'HV battery' }} /><Stack.Screen name="settings" options={{ title: 'Settings' }} /></Stack></>;
}
