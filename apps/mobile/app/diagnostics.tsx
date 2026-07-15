import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { readStoredDtcs } from '../src/connection';
import { Button } from '../src/components/Controls';
import { Card, Screen, Subtitle, Title } from '../src/components/Screen';
import { colors } from '../src/theme';

export default function Diagnostics() {
  const [codes, setCodes] = useState<string[]>([]); const [raw, setRaw] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const scan = async () => { setLoading(true); setError(''); try { const result = await readStoredDtcs(); setCodes(result.codes); setRaw(result.raw); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setLoading(false); } };
  return <Screen><Title>Diagnostics</Title><Subtitle>Stored standard OBD codes are read on demand and saved locally. Codes are never cleared automatically.</Subtitle><Button disabled={loading} onPress={() => void scan()}>{loading ? 'Scanning...' : 'Read stored DTCs'}</Button>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<Card><Text style={styles.label}>Scan result</Text><Text style={styles.body}>{codes.length ? codes.join('\n') : raw ? 'No stored codes reported' : 'No scan yet'}</Text>{raw ? <Text selectable style={styles.raw}>{raw}</Text> : null}</Card><Card><Text style={styles.warning}>Clearing codes is intentionally unavailable in this Milestone 1-3 UI.</Text><Text style={styles.body}>A future two-step flow must warn that freeze-frame and useful diagnostic evidence may be removed.</Text></Card></Screen>;
}
const styles = StyleSheet.create({ label: { color: colors.text, fontWeight: '800', fontSize: 18 }, body: { color: colors.muted, fontSize: 16, lineHeight: 22 }, warning: { color: colors.attention, fontWeight: '800' }, error: { color: colors.warning }, raw: { color: colors.unavailable, fontFamily: 'monospace' } });
