import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { colors } from '../theme';
export const Button = ({ children, disabled, ...props }: PropsWithChildren<PressableProps>) => <Pressable accessibilityRole="button" disabled={disabled} style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]} {...props}><Text style={styles.text}>{children}</Text></Pressable>;
const styles = StyleSheet.create({ button: { minHeight: 50, paddingHorizontal: 20, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }, text: { fontSize: 17, fontWeight: '600', color: colors.onAccent }, pressed: { opacity: 0.75 }, disabled: { opacity: 0.35 } });
