// CartDrawer.js — the cart. Right-hand drawer on tablet/desktop, bottom sheet on mobile.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from './theme';
import { FoodImage, QtyStepper, web } from './menuUi';
import { SERVICE_CHARGE_PERCENT, cartTotals, formatPrice } from './cartLogic';

export default function CartDrawer({ cart, table, layout, dispatch, onClose, onCheckout }) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  const sheet = layout === 'mobile';
  const t = cartTotals(cart.lines);
  const empty = cart.lines.length === 0;
  const slide = enter.interpolate({ inputRange: [0, 1], outputRange: [sheet ? 60 : 60, 0] });

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[s.overlay, sheet ? { justifyContent: 'flex-end' } : { alignItems: 'flex-end' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close cart" />
        <Animated.View
          accessibilityViewIsModal
          style={[sheet ? s.sheet : s.drawer, { opacity: enter, transform: [sheet ? { translateY: slide } : { translateX: slide }] }]}
        >
          <View style={s.head}>
            <View>
              <Text style={s.title} accessibilityRole="header">Your cart</Text>
              <Text style={s.table}>Table {String(table.id).padStart(2, '0')}</Text>
            </View>
            <Pressable onPress={onClose} style={[s.close, web({ cursor: 'pointer' })]} accessibilityRole="button" accessibilityLabel="Close cart">
              <Text style={s.closeText}>✕</Text>
            </Pressable>
          </View>

          {empty ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>Your cart is waiting for something delicious.</Text>
              <Text style={s.emptyText}>Add a dish from the menu and it will appear here.</Text>
            </View>
          ) : (
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {cart.lines.map((l) => (
                <View key={l.key} style={s.line}>
                  <FoodImage uri={l.imageUrl} label={`Photograph of ${l.name}`} style={s.thumb} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <View style={s.lineTop}>
                      <Text style={s.lineName}>{l.name}</Text>
                      <Text style={s.lineTotal}>{formatPrice(l.unitCents * l.quantity)}</Text>
                    </View>
                    <Text style={s.unit}>{formatPrice(l.unitCents)} each</Text>
                    {!!l.instructions && <Text style={s.note}>Note: {l.instructions}</Text>}
                    <View style={s.lineBottom}>
                      <QtyStepper value={l.quantity} onChange={(q) => dispatch({ type: 'setQty', key: l.key, quantity: q })} />
                      <Pressable onPress={() => dispatch({ type: 'remove', key: l.key })} accessibilityRole="button" accessibilityLabel={`Remove ${l.name}`} hitSlop={8} style={web({ cursor: 'pointer' })}>
                        <Text style={s.remove}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={s.footer}>
            {!empty && (
              <View style={{ marginBottom: 14 }}>
                <View style={s.row}><Text style={s.rowText}>Subtotal</Text><Text style={s.rowText}>{formatPrice(t.subtotalCents)}</Text></View>
                {SERVICE_CHARGE_PERCENT > 0 && (
                  <View style={s.row}><Text style={s.rowText}>Service charge ({SERVICE_CHARGE_PERCENT}%)</Text><Text style={s.rowText}>{formatPrice(t.serviceCents)}</Text></View>
                )}
                <View style={[s.row, s.totalRow]}><Text style={s.totalText}>Total</Text><Text style={s.totalText}>{formatPrice(t.totalCents)}</Text></View>
              </View>
            )}
            {!empty && (
              <Pressable onPress={onCheckout} accessibilityRole="button" style={({ hovered }) => [s.primary, hovered && { backgroundColor: '#A8844F' }, web({ cursor: 'pointer' })]}>
                <Text style={s.primaryText}>Proceed to Checkout</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} accessibilityRole="button" style={[s.secondary, web({ cursor: 'pointer' })]}>
              <Text style={s.secondaryText}>Continue Browsing</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(43,29,24,0.55)' },
  drawer: { width: 440, maxWidth: '100%', height: '100%', backgroundColor: C.cream },
  sheet: { width: '100%', maxHeight: '90%', backgroundColor: C.cream, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingBottom: 12 },
  title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 28, color: C.espresso },
  table: { fontFamily: 'Inter_500Medium', fontSize: 13, color: C.gold, marginTop: 2 },
  close: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: C.beige, backgroundColor: '#FBF8F2', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 15, color: C.espresso, fontFamily: 'Inter_600SemiBold' },
  empty: { padding: 28, alignItems: 'center' },
  emptyTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 22, color: C.espresso, textAlign: 'center' },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6F6258', textAlign: 'center', marginTop: 8 },
  line: { flexDirection: 'row', paddingVertical: 16, borderTopWidth: 1, borderTopColor: C.beige },
  thumb: { width: 72, height: 72, borderRadius: 14 },
  lineTop: { flexDirection: 'row', justifyContent: 'space-between' },
  lineName: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15, color: C.espresso, paddingRight: 8 },
  lineTotal: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: C.espresso },
  unit: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#7A6A5C', marginTop: 2 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12.5, fontStyle: 'italic', color: '#5C5148', marginTop: 4 },
  lineBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  remove: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: C.terracotta },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: C.beige, backgroundColor: '#FBF8F2' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rowText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#5C5148' },
  totalRow: { marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.beige },
  totalText: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: C.espresso },
  primary: { height: 52, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: C.espresso },
  secondary: { height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: C.espresso },
});