import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Card, Screen, Subtitle, Title } from '../src/components/Screen';
import { listTrips, type StoredTrip } from '../src/database';
import { useTripStore } from '../src/stores/app';
import { colors } from '../src/theme';

export default function Trips() {
  const [trips, setTrips] = useState<StoredTrip[]>([]); const version = useTripStore((s) => s.historyVersion);
  useEffect(() => { void listTrips().then(setTrips); }, [version]);
  return <Screen><Title>Trip history</Title><Subtitle>Trips and telemetry batches are stored only on this device in SQLite.</Subtitle>{trips.length ? trips.map((trip) => <Card key={trip.id}><Text style={styles.empty}>{trip.name ?? new Date(trip.startedAt).toLocaleString()}</Text><Text style={styles.body}>{trip.distanceKm.toFixed(2)} km / {Math.round(trip.durationSeconds / 60)} min / {trip.averageLitresPer100Km === null ? 'Average pending' : `${trip.averageLitresPer100Km.toFixed(1)} L/100 km`}</Text><Text style={styles.meta}>{trip.sampleCount} samples</Text></Card>) : <Card><Text style={styles.empty}>No recorded trips</Text><Text style={styles.body}>A trip begins after valid speed data is detected. Short trips wait for enough distance before showing an average.</Text></Card>}</Screen>;
}
const styles = StyleSheet.create({ empty: { color: colors.text, fontSize: 20, fontWeight: '800' }, body: { color: colors.muted, lineHeight: 22 }, meta: { color: colors.unavailable } });
