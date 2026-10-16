import { memo } from 'react';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Screen, Title } from '../src/components/Screen';
import { useConnectionStore, useSettingsStore, useTelemetryStore, useTripStore } from '../src/stores/app';
import { formatElapsed, formatLiveNumber, fuelLitres } from '../src/dashboard-values';
import { colors } from '../src/theme';

const Value = memo(function Value({ id, label, unit, digits = 0, elapsed = false, litres = false }: { id: string; label: string; unit: string; digits?: number; elapsed?: boolean; litres?: boolean }) {
  const sample = useTelemetryStore((s) => s.values[id]);
  const connected = useConnectionStore((s) => s.status === 'READY');
  const valid = connected && sample?.quality === 'VALID';
  const raw = valid ? sample?.value : undefined;
  const value = elapsed ? formatElapsed(raw) : formatLiveNumber(litres ? fuelLitres(raw) : raw, digits);
  return <Card style={styles.valueCard}>
    <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={styles.label}>{label}</Text>
    <View style={styles.numberBox}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} maxFontSizeMultiplier={1.2} accessibilityLabel={`${label}: ${value} ${unit}`} style={[styles.value, elapsed && styles.clockValue, !valid && styles.unavailable]}>{value}</Text></View>
    <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={styles.unit}>{litres && valid ? `${formatLiveNumber(raw)}% · ლიტრი ≈` : unit}</Text>
  </Card>;
});
const Connection = memo(function Connection() {
  const status = useConnectionStore((s) => s.status);
  const latency = useConnectionStore((s) => s.latencyMs);
  return <View style={styles.connection}><Text numberOfLines={1} style={[styles.connected, status !== 'READY' && styles.unavailable]}>{status === 'READY' ? '● დაკავშირებულია' : '○ არ არის კავშირი'}</Text><Text numberOfLines={1} style={styles.latency}>{latency ?? '—'} ms</Text></View>;
});
const Trip = memo(function Trip() {
  const trip = useTripStore((s) => s.active);
  return <Card style={styles.tripCard}>
    <Text style={styles.sectionLabel}>მიმდინარე მგზავრობა</Text>
    <View style={styles.tripRow}><View style={styles.tripColumn}><Text style={styles.tripValue} numberOfLines={1} adjustsFontSizeToFit>{(trip?.distanceKm ?? 0).toFixed(2)}</Text><Text style={styles.unit}>კმ ამ სესიაში</Text></View><View style={styles.tripColumn}><Text style={styles.tripValue} numberOfLines={1} adjustsFontSizeToFit>{trip?.averageLitresPer100Km == null ? '—' : trip.averageLitresPer100Km.toFixed(1)}</Text><Text style={styles.unit}>ლ / 100 კმ</Text></View></View>
    <View style={styles.tripRow}>
      <View style={styles.tripColumn}><Text style={styles.splitValue} numberOfLines={1}>{(trip?.engineRunningKm ?? 0).toFixed(2)}</Text><Text style={styles.splitLabel}>კმ · ძრავი ჩართული</Text></View>
      <View style={styles.tripColumn}><Text style={styles.splitValue} numberOfLines={1}>{(trip?.engineOffKm ?? 0).toFixed(2)}</Text><Text style={styles.splitLabel}>კმ · ძრავის გარეშე</Text></View>
      <View style={styles.tripColumn}><Text style={styles.splitValue} numberOfLines={1}>{(trip?.unknownPropulsionKm ?? 0).toFixed(2)}</Text><Text style={styles.splitLabel}>კმ · უცნობი რეჟიმი</Text></View>
    </View>
    <Text style={styles.footnote}>კავშირის შემდეგ. ძრავის გარეშე მანძილი ფასდება RPM=0-ით; ეს არ ზომავს აგრეგატების ზუსტ წვლილს.</Text>
  </Card>;
});
const KeepAwake = () => { useKeepAwake(); return null; };
export default function Dashboard() {
  const keepAwake = useSettingsStore((s) => s.keepAwake);
  return <Screen>{keepAwake ? <KeepAwake /> : null}<Title>მიმოხილვა</Title><Connection />
    <View style={styles.row}><Value id="speed" label="სიჩქარე" unit="კმ/სთ" /><Value id="rpm" label="ძრავის ბრუნი" unit="ბრ/წთ" /></View>
    <View style={styles.row}><Value id="engineRunTime" label="ძრავის გაშვებიდან" unit="სთ : წთ : წმ · ECU" elapsed /><Value id="fuelLevel" label="საწვავი ავზში" unit="ლიტრი · შეფასება" litres digits={1} /></View>
    <Trip />
    <View style={styles.row}><Value id="hvBatterySoc" label="ბატარეის დატენვა" unit="% · ECU მაჩვენებელი" digits={1} /><Value id="coolantTemperature" label="ძრავის ტემპერატურა" unit="°C" /></View>
    <Card style={styles.navigation}>{[['ბატარეა და გაგრილება', '/battery'], ['მგზავრობები', '/trips'], ['დიაგნოსტიკა', '/diagnostics'], ['პარამეტრები', '/settings']].map(([label, path], index) => <Pressable accessibilityRole="button" key={path} onPress={() => router.push(path as never)} style={({ pressed }) => [styles.navRow, index > 0 && styles.separator, pressed && styles.pressed]}><Text style={styles.navText}>{label}</Text><Text style={styles.chevron}>›</Text></Pressable>)}</Card>
  </Screen>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  valueCard: { flex: 1, minWidth: 0, height: 184, padding: 16, justifyContent: 'space-between', gap: 0 },
  label: { color: colors.muted, fontSize: 15, lineHeight: 19, fontWeight: '500', height: 46 },
  numberBox: { height: 62, justifyContent: 'center' },
  value: { color: colors.text, fontSize: 32, lineHeight: 44, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  clockValue: { fontSize: 24, lineHeight: 36, letterSpacing: -0.5 },
  unit: { color: colors.muted, fontSize: 11, lineHeight: 15, height: 32 },
  connection: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  connected: { color: colors.normal, fontSize: 13, fontWeight: '500' },
  latency: { color: colors.muted, fontSize: 13, width: 88, textAlign: 'right', fontVariant: ['tabular-nums'] },
  unavailable: { color: colors.unavailable },
  tripCard: { height: 264, justifyContent: 'space-between' },
  sectionLabel: { color: colors.text, fontSize: 17, fontWeight: '600' },
  tripRow: { flexDirection: 'row', gap: 16 },
  tripColumn: { flex: 1, minWidth: 0 },
  tripValue: { color: colors.text, fontSize: 30, lineHeight: 38, height: 40, fontWeight: '600', fontVariant: ['tabular-nums'] },
  footnote: { color: colors.muted, fontSize: 12, lineHeight: 16, height: 48 },
  splitValue: { color: colors.text, fontSize: 21, lineHeight: 29, fontWeight: '600', fontVariant: ['tabular-nums'] },
  splitLabel: { color: colors.muted, fontSize: 11, lineHeight: 16, height: 32 },
  navigation: { padding: 0, gap: 0, overflow: 'hidden' },
  navRow: { height: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  navText: { color: colors.accent, fontSize: 16 },
  chevron: { color: colors.unavailable, fontSize: 26 },
  pressed: { backgroundColor: colors.raised },
});
