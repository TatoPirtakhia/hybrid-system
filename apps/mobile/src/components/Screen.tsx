import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

export const Screen = ({ children }: PropsWithChildren) => <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{children}</ScrollView></SafeAreaView>;
export const Title = ({ children }: PropsWithChildren) => <Text accessibilityRole="header" style={styles.title}>{children}</Text>;
export const Subtitle = ({ children }: PropsWithChildren) => <Text style={styles.subtitle}>{children}</Text>;
export const Card = ({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) => <View style={[styles.card, style]}>{children}</View>;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 12, gap: 16, flexGrow: 1 },
  title: { color: colors.text, fontSize: 34, fontWeight: '700', letterSpacing: -0.7 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, gap: 8 },
});
