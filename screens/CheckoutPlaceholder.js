// CheckoutPlaceholder.js — the next stage. It only SHOWS the order summary; no order is placed.
import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from './theme';
import { cartTotals, formatPrice } from './cartLogic';

export default function CheckoutPlaceholder({ table, cart, onBack }) {
  const t = cartTotals(cart.lines);
  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.card}>
          <Text style={s.title} accessibilityRole="header">Checkout</Text>
          <Text style={s.table}>Table {String(table.id).padStart(2, '0')}</Text>
          <View style={s.notice}>
            <Text style={s.noticeText}>Checkout is the next stage of the app. No order has been placed yet.</Text>
          </View>
          {cart.lines.map((l) => (
            <View key={l.key} style={s.line}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{l.quantity} × {l.name}</Text>
                {!!l.instructions && <Text style={s.note}>Note: {l.instructions}</Text>}
              </View>
              <Text style={s.name}>{formatPrice(l.unitCents * l.quantity)}</Text>
            </View>
          ))}
          <View style={s.totalRow}><Text style={s.total}>Total</Text><Text style={s.total}>{formatPrice(t.totalCents)}</Text></View>
          <Pressable onPress={onBack} accessibilityRole="button" style={s.btn}>
            <Text style={s.btnText}>Back to menu</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 520, backgroundColor: '#FBF8F2', borderRadius: 22, borderWidth: 1, borderColor: C.beige, padding: 26 },
  title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 32, color: C.espresso },
  table: { fontFamily: 'Inter_500Medium', fontSize: 13, color: C.gold, marginTop: 2 },
  notice: { marginVertical: 18, borderLeftWidth: 3, borderLeftColor: C.gold, backgroundColor: '#F0E6D8', borderRadius: 8, padding: 12 },
  noticeText: { fontFamily: 'Inter_500Medium', fontSize: 13.5, color: C.espresso, lineHeight: 20 },
  line: { flexDirection: 'row', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.beige },
  name: { fontFamily: 'Inter_500Medium', fontSize: 14.5, color: C.espresso },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12.5, fontStyle: 'italic', color: '#5C5148', marginTop: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 14, borderTopWidth: 1, borderTopColor: C.beige },
  total: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: C.espresso },
  btn: { marginTop: 22, height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: C.espresso },
});