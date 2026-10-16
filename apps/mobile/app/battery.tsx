import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Card, Screen, Subtitle, Title } from '../src/components/Screen';
import { useConnectionStore, useTelemetryStore, useFanStore } from '../src/stores/app';
import { Button } from '../src/components/Controls';
import { setBatteryFanLevel, stopBatteryFanControl } from '../src/connection';
import { colors } from '../src/theme';

const Metric = ({ label, value }: { label: string; value: string }) => <View style={styles.metricRow}><Text style={styles.metricLabel} numberOfLines={2}>{label}</Text><Text style={styles.metricNumber} numberOfLines={1} adjustsFontSizeToFit>{value}</Text></View>;

export default function Battery() {
  const values = useTelemetryStore((s) => s.values);
  const connection = useConnectionStore();
  const fan = useFanStore();
  const chooseFan = (level: number) => Alert.alert('ქულერის დონე', `დავაყენო ${level} / 6? მართვა გაგრძელდება გვერდიდან გასვლისა და სხვა აპში გადასვლის შემდეგაც, Bluetooth კავშირის არსებობისას.`, [
    { text: 'გაუქმება', style: 'cancel' },
    { text: 'დაყენება', onPress: () => { void setBatteryFanLevel(level).catch((error: unknown) => Alert.alert('ქულერი', error instanceof Error ? error.message : String(error))); } },
  ]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const number = (id: string): number | undefined => {
    const sample = values[id];
    return connection.status === 'READY' && sample?.quality === 'VALID' && now - sample.timestamp < 10000 && typeof sample.value === 'number' ? sample.value : undefined;
  };
  const format = (id: string, unit: string, digits = 1) => { const value = number(id); return value === undefined ? '—' : `${value.toFixed(digits)} ${unit}`; };
  const soc = number('hvBatterySoc');
  return <Screen>
    <Title>ჰიბრიდის ბატარეა</Title>
    <Subtitle>Prius C · 2013 US · {connection.transport === 'SIMULATOR' ? 'სიმულაცია — საცდელი მონაცემები' : connection.status === 'READY' ? 'მანქანასთან დაკავშირებულია' : 'მანქანა არ არის დაკავშირებული'}</Subtitle>
    <Card>
      <Text style={styles.label}>დატენვის მაჩვენებელი</Text>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{soc === undefined ? '—' : `${soc.toFixed(1)}%`}</Text>
      <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, Math.max(0, soc ?? 0))}%` }]} /></View>
      <Text style={styles.detail}>OBD 015B · გამოჩნდება მხოლოდ ECU-ს მხარდაჭერისას. ეს მაჩვენებელი არ ზომავს ბატარეის რეალურ ტევადობას ან ჯანმრთელობას.</Text>
    </Card>
    <Card>
      <Text style={styles.label}>საერთო ბატარეა</Text>
      <Metric label="HV ძაბვა" value={format('hvBatteryVoltage', 'V', 1)} />
      <Metric label="დენი" value={format('hvBatteryCurrent', 'A', 1)} />
      <Text style={styles.detail}>დატენვის ძაბვას მხოლოდ HV ბატარეის გაზომვიდან ვაჩვენებთ. ნომინალური ძაბვა გაზომილი დატენვის ძაბვა არ არის.</Text>
      <Metric label="ECU კვების ძაბვა" value={format('moduleVoltage', 'V', 2)} />
      <Text style={styles.detail}>ECU-ს კვება დაბალი ძაბვის სისტემაა; ის HV ბატარეის ძაბვას არ აჩვენებს.</Text>
    </Card>
    <Card>
      <Text style={styles.label}>ქარხნული მონაცემები</Text>
      <Text style={styles.metric}>20 NiMH მოდული · 144 V ნომინალური</Text>
      <Text style={styles.metric}>ნომინალური ტევადობა: 6.5 Ah · ≈ 0.94 kWh</Text>
      <Text style={styles.detail}>წყარო: Toyota 2013 Prius c Owner’s Manual, გვ. 495. ენერგია გამოთვლილია: 144 V × 6.5 Ah. რეალური დარჩენილი ტევადობა (Ah / kWh) ამ ეტაპზე გაზომილი არ არის. თითოეული მოდულის დატენვის პროცენტი ძაბვიდან ვერ განისაზღვრება.</Text>
    </Card>
    <Card>
      <Text style={styles.label}>ცალკეული ბლოკების ძაბვა</Text>
      <Text style={styles.detail}>Toyota-ს ბლოკების წაკითხვის ბრძანება ამ პროფილისთვის ჯერ დასადასტურებელია. მაჩვენებლები ხელმისაწვდომი გახდება რეალური ECU პასუხების შემოწმების შემდეგ.</Text>
    </Card>
    <Card>
      <Text style={styles.label}>ბატარეის გაგრილების ქულერი</Text>
      <Metric label="ტემპერატურა" value={format('hvBatteryTemperatureMax', '°C', 1)} />
      <Metric label="მოთხოვნილი დონე" value={format('batteryFanRequestedLevel', '', 0)} />
      <Text style={styles.status}>{fan.message}</Text>
      <View style={styles.fanRow}>{[1, 2, 3].map((level) => <View key={level} style={styles.fanButton}><Button disabled={connection.status !== 'READY' || fan.busy} onPress={() => chooseFan(level)}>{fan.level === level ? `✓ ${level}` : String(level)}</Button></View>)}</View>
      <View style={styles.fanRow}>{[4, 5, 6].map((level) => <View key={level} style={styles.fanButton}><Button disabled={connection.status !== 'READY' || fan.busy} onPress={() => chooseFan(level)}>{fan.level === level ? `✓ ${level}` : String(level)}</Button></View>)}</View>
      <Button onPress={stopBatteryFanControl}>ხელით მართვის შეწყვეტა / Auto</Button>
      <Text style={styles.detail}>1 — დაბალი · 6 — მაქსიმალური. ჩართვა შესაძლებელია მოძრაობის დროსაც. არჩეული დონე შენარჩუნდება სხვა გვერდზე ან აპში გადასვლისას. შესაწყვეტად დააჭირე Auto-ს ან სრულად დახურე აპი. კავშირის დაკარგვა მართვას შეაჩერებს. დადასტურება ნიშნავს ECU-ს მოთხოვნილ დონეს, არა გაზომილ ბრუნს. Auto წყვეტს ხელით ბრძანებების გამეორებას; ავტომატური რეჟიმის დაბრუნება აქ არ დასტურდება. თუ ხელით დონე დარჩა, გამორთე და ხელახლა ჩართე მანქანა.</Text>
    </Card>
  </Screen>;
}
const styles = StyleSheet.create({
  fanRow: { flexDirection: 'row', gap: 10 },
  fanButton: { flex: 1 },
  label: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  value: { color: colors.accent, fontSize: 44, lineHeight: 54, height: 60, fontWeight: '600', fontVariant: ['tabular-nums'] },
  metricRow: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 12 },
  metricLabel: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 15, lineHeight: 20 },
  metricNumber: { width: 110, color: colors.text, fontSize: 20, fontWeight: '500', textAlign: 'right', fontVariant: ['tabular-nums'] },
  metric: { color: colors.text, fontSize: 18, fontWeight: '600' },
  status: { color: colors.attention, fontSize: 17, fontWeight: '600' },
  detail: { color: colors.muted, lineHeight: 22 },
  track: { height: 10, backgroundColor: colors.raised, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, backgroundColor: colors.accent },
});
