// MenuPlaceholder.js — stand-in for the menu screen. Receives the selected table.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from './theme';

export default function MenuPlaceholder({ user, table, onBack }) {
  const n = String(table.id).padStart(2, '0');
  return (
    <View style={s.root}>
      <Text style={s.small}>{user.fullName}</Text>
      <Text style={s.title}>Table {n}</Text>
      <Text style={s.text}>
        The menu with allergen labels is the next screen. Orders will be sent to this table.
      </Text>
      <Pressable onPress={onBack} style={s.btn} accessibilityRole="button">
        <Text style={s.btnText}>Change table</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', padding: 28 },
  small: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#6F6258', marginBottom: 10 },
  title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 44, color: C.espresso },
  text: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24, color: '#5C5148', textAlign: 'center', maxWidth: 380, marginTop: 12 },
  btn: { marginTop: 28, borderWidth: 1.5, borderColor: C.gold, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 26 },
  btnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: C.espresso },
});