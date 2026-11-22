// OrderConfirmation.js — shown right after an order has been saved.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from './theme';
import { formatPrice } from './cartLogic';
import { statusLabel } from './orderLogic';
import { web } from './menuUi';

const pad = (n) => String(n).padStart(2, '0');

export default function OrderConfirmation({ order, onDone }) {
  const ring = useRef(new Animated.Value(0)).current;
  const tick = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(ring, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }),
      Animated.spring(tick, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 10 }),
      Animated.timing(fade, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.wrap}>
          <Animated.View style={[s.circle, { transform: [{ scale: ring }] }]}>
            <Animated.Text style={[s.tick, { transform: [{ scale: tick }] }]}>✓</Animated.Text>
          </Animated.View>

          <Animated.View style={{ opacity: fade, width: '100%', alignItems: 'center' }}>
            <Text style={s.title} accessibilityRole="header">Thank you</Text>
            <Text style={s.message} accessibilityLiveRegion="polite">Your order has been received. Our team is preparing it with care.</Text>

            <View style={s.card}>
              <View style={s.facts}>
                <View style={s.fact}><Text style={s.factLabel}>Order number</Text><Text style={s.factValue}>{order.orderNumber}</Text></View>
                <View style={s.fact}><Text style={s.factLabel}>Table</Text><Text style={s.factValue}>{pad(order.tableId)}</Text></View>
                <View style={s.fact}>
                  <Text style={s.factLabel}>Status</Text>
                  <View style={s.status}><Text style={s.statusText}>{statusLabel(order.status)}</Text></View>
                </View>
              </View>

              {order.items.map((i, idx) => (
                <View key={idx} style={s.line}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{i.quantity} × {i.name}</Text>
                    {!!i.instructions && <Text style={s.note}>Note: {i.instructions}</Text>}
                  </View>
                  <Text style={s.name}>{formatPrice(i.lineTotalCents)}</Text>
                </View>
              ))}
              {!!order.note && <Text style={[s.note, { marginTop: 10 }]}>Kitchen note: {order.note}</Text>}
              {order.serviceChargeCents > 0 && (
                <View style={s.line}><Text style={s.rowText}>Service charge</Text><Text style={s.rowText}>{formatPrice(order.serviceChargeCents)}</Text></View>
              )}
              <View style={s.totalRow}><Text style={s.total}>Total</Text><Text style={s.total}>{formatPrice(order.totalCents)}</Text></View>
            </View>

            <Text style={s.footnote}>Live status updates will appear here once the kitchen dashboard is connected.</Text>

            <Pressable onPress={onDone} accessibilityRole="button" style={({ hovered }) => [s.btn, hovered && { backgroundColor: '#A8844F' }, web({ cursor: 'pointer' })]}>
              <Text style={s.btnText}>Back to menu</Text>
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  wrap: { width: '100%', maxWidth: 520, alignItems: 'center' },
  circle: { width: 92, height: 92, borderRadius: 46, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  tick: { fontSize: 46, color: C.espresso, fontFamily: 'Inter_600SemiBold', marginTop: -3 },
  title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 38, color: C.espresso, textAlign: 'center' },
  message: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 25, color: '#5C5148', textAlign: 'center', marginTop: 10, marginBottom: 24, maxWidth: 400 },
  card: { width: '100%', backgroundColor: '#FBF8F2', borderRadius: 20, borderWidth: 1, borderColor: C.beige, padding: 20 },
  facts: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 16, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: C.beige },
  fact: { alignItems: 'flex-start' },
  factLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#7A6A5C', marginBottom: 4 },
  factValue: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 20, color: C.espresso },
  status: { borderWidth: 1, borderColor: C.gold, backgroundColor: '#F0E6D8', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: C.espresso },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  name: { fontFamily: 'Inter_500Medium', fontSize: 14.5, color: C.espresso },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12.5, fontStyle: 'italic', color: '#5C5148', marginTop: 2 },
  rowText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#5C5148' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.beige },
  total: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: C.espresso },
  footnote: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#7A6A5C', textAlign: 'center', marginTop: 16, maxWidth: 380 },
  btn: { marginTop: 22, height: 52, paddingHorizontal: 34, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: C.espresso },
});