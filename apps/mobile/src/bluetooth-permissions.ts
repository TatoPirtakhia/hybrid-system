import { PermissionsAndroid, Platform } from 'react-native';

export const requestBluetoothPermissions = async (mode: 'BLE' | 'ANDROID_CLASSIC'): Promise<void> => {
  if (Platform.OS !== 'android') return;
  if (Platform.Version < 31) {
    if (mode === 'ANDROID_CLASSIC') return;
    throw new Error('Android 11 and older require a location permission for BLE scanning. This app intentionally does not request location; use Wi-Fi OBD or Android Bluetooth Classic pairing.');
  }
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ]);
  if (result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] !== PermissionsAndroid.RESULTS.GRANTED || result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Nearby devices permission is required to find and connect to the OBD adapter.');
  }
};
