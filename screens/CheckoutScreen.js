// CheckoutScreen.js — review the order and place it.
// The order is created by placeOrder() in db.js, which re-reads every price and checks the
// table and availability again. The totals shown here are only a preview.
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { C } from './theme';
import { FoodImage, web } from './menuUi';
import { SERVICE_CHARGE_PERCENT, cartTotals, formatPrice } from './cartLogic';
import { placeOrder } from './db';

const pad = (n) => String(n).padStart(2, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function PlaceButton({ loading, disabled, onPress }) {
  const off = loading || disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      style={({ hovered }) => [s.place, disabled && s.placeOff, hovered && !off && { backgroundColor: '#A8844F' }, web({ cursor: off ? 'not-allowed' : 'pointer', transitionDuration: '160ms' })]}
    >
      {loading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ActivityIndicator color={C.espresso} />
          <Text style={[s.placeText, { marginLeft: 10 }]}>Placing your order</Text>
        </View>
      ) : (
        <Text style={[s.placeText, disabled && { color: '#9A8C7D' }]}>Place Order</Text>
      )}
    </Pressable>
  );
}

export default function CheckoutScreen({ user, table, cart, dispatch, onBack, onChangeTable, onPlaced }) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const t = cartTotals(cart.lines);
  const empty = cart.lines.length === 0;

  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState(null); // { text, kind, unavailable? }
  // One key per checkout visit: a double tap or retry can never create two orders.
  const requestKey = useRef(`${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`).current;

  const place = async () => {
    if (submitting || empty) return;
    setSubmitting(true);
    setProblem(null);
    const [res] = await Promise.all([
      placeOrder({
        userId: user.id,
        tableId: table.id,
        lines: cart.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, instructions: l.instructions, options: l.options })),
        note,
        expectedTotalCents: t.totalCents,
        requestKey,
      }),
      sleep(700),
    ]);
    if (res.ok) {
      onPlaced(res.order); // the cart is cleared only now, after the order exists
      return;
    }
    if (res.code === 'PRICE_CHANGED') {
      dispatch({ type: 'syncPrices', prices: res.prices });
      setProblem({ kind: 'price', text: 'Some prices have changed. Your total has been updated. Please review it and place your order again.' });
    } else if (res.code === 'UNAVAILABLE') {
      setProblem({ kind: 'unavailable', text: res.error, unavailable: res.unavailable });
    } else if (res.code === 'TABLE') {
      setProblem({ kind: 'table', text: res.error });
    } else {
      setProblem({ kind: 'generic', text: res.error || "We couldn't place your order. Please try again." });
    }
    setSubmitting(false);
  };

  const removeUnavailable = () => {
    const ids = new Set((problem.unavailable || []).map((u) => u.productId));
    cart.lines.filter((l) => ids.has(l.productId)).forEach((l) => dispatch({ type: 'remove', key: l.key }));
    setProblem(null);
  };

  const banner = problem && (
    <View style={s.problem} accessibilityRole="alert">
      <Text style={s.problemText}>{problem.text}</Text>
      {problem.kind === 'unavailable' && (
        <Pressable onPress={removeUnavailable} accessibilityRole="button" style={[s.problemBtn, web({ cursor: 'pointer' })]}>
          <Text style={s.problemBtnText}>Remove unavailable dishes</Text>
        </Pressable>
      )}
      {problem.kind === 'table' && (
        <Pressable onPress={onChangeTable} accessibilityRole="button" style={[s.problemBtn, web({ cursor: 'pointer' })]}>
          <Text style={s.problemBtnText}>Choose a table</Text>
        </Pressable>
      )}
    </View>
  );

  const totalsBlock = (
    <View>
      <View style={s.row}><Text style={s.rowText}>Subtotal</Text><Text style={s.rowText}>{formatPrice(t.subtotalCents)}</Text></View>
      {SERVICE_CHARGE_PERCENT > 0 && (
        <View style={s.row}><Text style={s.rowText}>Service charge ({SERVICE_CHARGE_PERCENT}%)</Text><Text style={s.rowText}>{formatPrice(t.serviceCents)}</Text></View>
      )}
      <View style={[s.row, s.totalRow]}><Text style={s.totalText}>Total</Text><Text style={s.totalText}>{formatPrice(t.totalCents)}</Text></View>
    </View>
  );

  const items = (
    <View style={s.card}>
      <Text style={s.h}>Your order</Text>
      {cart.lines.map((l, i) => (
        <View key={l.key} style={[s.line, i === 0 && { borderTopWidth: 0 }]}>
          <FoodImage uri={l.imageUrl} label={`Photograph of ${l.name}`} style={s.thumb} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.name}>{l.quantity} × {l.name}</Text>
            <Text style={s.unit}>{formatPrice(l.unitCents)} each</Text>
            {!!l.instructions && <Text style={s.note}>Note: {l.instructions}</Text>}
          </View>
          <Text style={s.name}>{formatPrice(l.unitCents * l.quantity)}</Text>
        </View>
      ))}
    </View>
  );

  const noteBox = (
    <View style={s.card}>
      <Text style={s.h}>Notes for the kitchen</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Optional"
        placeholderTextColor="#A89C8D"
        multiline
        maxLength={200}
        accessibilityLabel="Notes for the kitchen"
        style={s.noteInput}
      />
      <Text style={s.hint}>For allergies, please also tell our staff.</Text>
    </View>
  );

  return (
    <SafeAreaView style={[s.root, Platform.OS === 'android' && { paddingTop: StatusBar.currentHeight || 0 }]}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Pressable onPress={onBack} disabled={submitting} accessibilityRole="button" accessibilityLabel="Back to menu" style={[s.back, web({ cursor: 'pointer' })]}>
          <Text style={s.backText}>← Back to menu</Text>
        </Pressable>
        <Text style={s.wordmark}>Amant's</Text>
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: wide ? 48 : 150, paddingHorizontal: wide ? 32 : 18 }]} keyboardShouldPersistTaps="handled">
        <View style={s.page}>
          <Text style={[s.title, !wide && { fontSize: 32 }]} accessibilityRole="header">Checkout</Text>
          <View style={s.tablePill}><Text style={s.tablePillText}>This order will be sent to Table {pad(table.id)}</Text></View>

          {empty ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyTitle}>Your cart is waiting for something delicious.</Text>
              <Pressable onPress={onBack} accessibilityRole="button" style={[s.problemBtn, { marginTop: 16 }, web({ cursor: 'pointer' })]}>
                <Text style={s.problemBtnText}>Browse the menu</Text>
              </Pressable>
            </View>
          ) : (
            <View style={wide ? { flexDirection: 'row', alignItems: 'flex-start' } : null}>
              <View style={wide ? { flex: 1.5 } : null}>
                {banner}
                {items}
                {noteBox}
              </View>
              {wide ? (
                <View style={[s.card, { flex: 1, marginLeft: 24 }]}>
                  <Text style={s.h}>Summary</Text>
                  <Text style={s.small}>Table {pad(table.id)}</Text>
                  <View style={{ height: 14 }} />
                  {totalsBlock}
                  <View style={{ height: 18 }} />
                  <PlaceButton loading={submitting} onPress={place} />
                </View>
              ) : (
                <View style={s.card}>{totalsBlock}</View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {!wide && !empty && (
        <View style={s.sticky}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={s.totalText}>Total</Text>
            <Text style={s.totalText}>{formatPrice(t.totalCents)}</Text>
          </View>
          <PlaceButton loading={submitting} onPress={place} />
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.beige },
  back: { paddingVertical: 6 },
  backText: { fontFamily: 'Inter_600SemiBold', fontSize: 14.5, color: C.espresso },
  wordmark: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 22, color: C.espresso },
  scroll: { flexGrow: 1, alignItems: 'center', paddingTop: 28 },
  page: { width: '100%', maxWidth: 1000 },
  title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 42, color: C.espresso },
  tablePill: { alignSelf: 'flex-start', marginTop: 12, marginBottom: 22, borderWidth: 1, borderColor: C.gold, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#F0E6D8' },
  tablePillText: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, color: C.espresso },
  card: { backgroundColor: '#FBF8F2', borderRadius: 20, borderWidth: 1, borderColor: C.beige, padding: 20, marginBottom: 16 },
  h: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 20, color: C.espresso, marginBottom: 12 },
  small: { fontFamily: 'Inter_500Medium', fontSize: 13, color: C.gold },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.beige },
  thumb: { width: 64, height: 64, borderRadius: 12 },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: C.espresso },
  unit: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#7A6A5C', marginTop: 2 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12.5, fontStyle: 'italic', color: '#5C5148', marginTop: 4 },
  noteInput: { minHeight: 70, borderWidth: 1.5, borderColor: C.beige, borderRadius: 12, backgroundColor: '#FFFFFF', padding: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: C.espresso, textAlignVertical: 'top', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null) },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#7A6A5C', marginTop: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rowText: { fontFamily: 'Inter_400Regular', fontSize: 14.5, color: '#5C5148' },
  totalRow: { marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.beige },
  totalText: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: C.espresso },
  place: { height: 54, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', shadowColor: C.espresso, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  placeOff: { backgroundColor: C.beige, shadowOpacity: 0, elevation: 0 },
  placeText: { fontFamily: 'Inter_600SemiBold', fontSize: 16.5, color: C.espresso, letterSpacing: 0.3 },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.cream, borderTopWidth: 1, borderTopColor: C.beige, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 20 },
  problem: { borderWidth: 1, borderColor: C.terracotta, backgroundColor: '#F8E9E2', borderRadius: 12, padding: 14, marginBottom: 16 },
  problemText: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20, color: C.terracotta },
  problemBtn: { alignSelf: 'flex-start', marginTop: 10, borderWidth: 1.5, borderColor: C.gold, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16, backgroundColor: '#FBF8F2' },
  problemBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, color: C.espresso },
  emptyBox: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 22, color: C.espresso, textAlign: 'center' },
});