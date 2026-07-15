import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Prius Companion', slug: 'prius-companion', version: '0.1.0', scheme: 'priuscompanion', orientation: 'default', userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: { supportsTablet: true, bundleIdentifier: 'app.priuscompanion.mobile', infoPlist: { NSBluetoothAlwaysUsageDescription: 'Connect to your nearby OBD-II adapter.', NSLocalNetworkUsageDescription: 'Connect directly to a Wi-Fi OBD-II adapter on your local network.' } },
  android: { package: 'app.priuscompanion.mobile', permissions: ['android.permission.BLUETOOTH_SCAN', 'android.permission.BLUETOOTH_CONNECT', 'android.permission.BLUETOOTH', 'android.permission.INTERNET'] },
  plugins: ['expo-router', 'expo-secure-store', 'expo-sqlite', ['react-native-ble-plx', { isBackgroundEnabled: false, modes: ['central'], bluetoothAlwaysPermission: 'Connect to your nearby OBD-II adapter.' }]],
  experiments: { typedRoutes: true },
  extra: { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? 'replace-with-eas-project-id' } },
};
export default config;
