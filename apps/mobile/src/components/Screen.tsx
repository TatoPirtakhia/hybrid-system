import type { PropsWithChildren } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors } from '../theme';

export const Screen = ({ children }: PropsWithChildren) => <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>{children}</ScrollView></SafeAreaView>;
export const Title = ({ children }: PropsWithChildren) => <Text accessibilityRole="header" style={styles.title}>{children}</Text>;
export const Subtitle = ({ children }: PropsWithChildren) => <Text style={styles.subtitle}>{children}</Text>;
export const Card = ({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) => <View style={[styles.card, style]}>{children}</View>;

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, gap: 16, flexGrow: 1 }, title: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8 }, subtitle: { color: colors.muted, fontSize: 17, lineHeight: 24 }, card: { padding: 18, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 } });
