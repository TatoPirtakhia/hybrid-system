import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { connectSimulator } from '../src/connection';
import { Button } from '../src/components/Controls';
import { Card, Screen, Subtitle, Title } from '../src/components/Screen';
import { useConnectionStore } from '../src/stores/app';
import { colors } from '../src/theme';

export default function Setup() {
  const connection = useConnectionStore();
  const connect = async () => { await connectSimulator(); router.replace('/dashboard'); };
  return <Screen><Title>Choose an adapter</Title><Subtitle>Connect directly to an ELM327 adapter without an account or backend.</Subtitle><Card><Text style={styles.cardTitle}>Bluetooth OBD</Text><Text style={styles.body}>Scan BLE adapters on iPhone and Android. Android also supports paired Bluetooth Classic ELM327 adapters.</Text><Button onPress={() => router.push('/bluetooth-setup')}>Scan Bluetooth adapters</Button></Card><Card><Text style={styles.cardTitle}>Simulator</Text><Text style={styles.body}>Test the dashboard without a vehicle.</Text><Button onPress={() => void connect()} disabled={connection.status === 'CONNECTING'}>{connection.status === 'CONNECTING' ? 'Connecting...' : 'Start simulation'}</Button></Card>{connection.error ? <Text accessibilityRole="alert" style={styles.error}>{connection.error}</Text> : null}</Screen>;
}
const styles = StyleSheet.create({ cardTitle: { color: colors.text, fontSize: 22, fontWeight: '800' }, body: { color: colors.muted, fontSize: 16, lineHeight: 23 }, error: { color: colors.warning } });
