// ProductModal.js — dish details: photo, ingredients, allergens, quantity, notes.
// Mobile = bottom sheet; tablet/desktop = centered dialog.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { C } from './theme';
import { FoodImage, QtyStepper, web } from './menuUi';
import { formatPrice } from './cartLogic';
import { describeAllergens, dietaryLabel } from './allergens';

function Chip({ children, tone }) {
  return (
    <View style={[s.chip, tone === 'warn' && s.chipWarn]}>
      <Text style={[s.chipText, tone === 'warn' && { color: C.terracotta }]}>{children}</Text>
    </View>
  );
}

export default function ProductModal({ product, categoryName, layout, onClose, onAdd }) {
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

  const p = product;
  const a = describeAllergens(p.allergenInfo);
  const sheet = layout === 'mobile';
  const twoCol = layout === 'desktop';
  const total = p.priceCents * qty;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[s.overlay, sheet ? { justifyContent: 'flex-end' } : { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close details" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={sheet ? { width: '100%' } : { width: '100%', maxWidth: twoCol ? 900 : 620 }}>
          <Animated.View
            accessibilityViewIsModal
            style={[
              sheet ? s.sheet : s.dialog,
              { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [sheet ? 40 : 14, 0] }) }] },
            ]}
          >
            <Pressable onPress={onClose} style={[s.close, web({ cursor: 'pointer' })]} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={s.closeText}>✕</Text>
            </Pressable>

            <ScrollView contentContainerStyle={twoCol ? s.bodyRow : null} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <FoodImage uri={p.imageUrl} label={`Photograph of ${p.name}`} style={twoCol ? s.imgSide : s.imgTop} dim={!p.available} />
              <View style={twoCol ? s.detailsSide : s.details}>
                <Text style={s.meta}>{categoryName}, about {p.prepMinutes} min</Text>
                <Text style={s.name} accessibilityRole="header">{p.name}</Text>
                <Text style={s.price}>{formatPrice(p.priceCents)}</Text>
                <Text style={s.desc}>{p.description}</Text>

                <Text style={s.h}>Ingredients</Text>
                {p.ingredients.length ? (
                  <Text style={s.body}>{p.ingredients.join(', ')}</Text>
                ) : (
                  <Text style={s.body}>Ingredient list not available. Please ask our staff.</Text>
                )}

                <Text style={s.h}>Allergens</Text>
                {a.state === 'unknown' ? (
                  <View style={s.unknownBox}>
                    <Text style={s.unknownTitle}>Allergen information not available</Text>
                    <Text style={s.body}>We have not recorded allergen details for this dish. Please ask our staff before ordering.</Text>
                  </View>
                ) : (
                  <View>
                    <Text style={s.sub}>Contains</Text>
                    {a.contains.length ? (
                      <View style={s.chips}>{a.contains.map((x) => <Chip key={x} tone="warn">{x}</Chip>)}</View>
                    ) : (
                      <Text style={s.body}>No allergens listed.</Text>
                    )}
                    {a.mayContain.length > 0 && (
                      <>
                        <Text style={[s.sub, { marginTop: 10 }]}>May contain traces of (cross-contact)</Text>
                        <View style={s.chips}>{a.mayContain.map((x) => <Chip key={x}>{x}</Chip>)}</View>
                      </>
                    )}
                    <Text style={s.verify}>
                      {a.verified ? 'Confirmed by our kitchen.' : 'Sample information. Not yet verified by our kitchen.'}
                    </Text>
                  </View>
                )}

                {p.dietary.length > 0 && (
                  <>
                    <Text style={s.h}>Dietary</Text>
                    <View style={s.chips}>{p.dietary.map((d) => <Chip key={d}>{dietaryLabel(d)}</Chip>)}</View>
                  </>
                )}

                <View style={s.warning} accessibilityRole="alert">
                  <Text style={s.warningText}>If you have a serious allergy or intolerance, please speak with a member of our staff before ordering.</Text>
                </View>

                <Text style={s.h}>Special instructions</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Anything the kitchen should know"
                  placeholderTextColor="#A89C8D"
                  multiline
                  maxLength={140}
                  accessibilityLabel="Special instructions"
                  style={s.notes}
                />
                <Text style={s.hint}>Notes go to the kitchen. For allergies, please tell our staff.</Text>
              </View>
            </ScrollView>

            <View style={s.footer}>
              <QtyStepper value={qty} onChange={setQty} />
              <Pressable
                onPress={() => p.available && onAdd(p, qty, notes)}
                disabled={!p.available}
                accessibilityRole="button"
                accessibilityState={{ disabled: !p.available }}
                style={({ hovered }) => [s.add, !p.available && s.addOff, hovered && p.available && { backgroundColor: '#A8844F' }, web({ cursor: p.available ? 'pointer' : 'not-allowed' })]}
              >
                <Text style={[s.addText, !p.available && { color: '#9A8C7D' }]}>
                  {p.available ? `Add to cart, ${formatPrice(total)}` : 'Currently unavailable'}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(43,29,24,0.55)' },
  sheet: { backgroundColor: C.cream, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '92%', overflow: 'hidden' },
  dialog: { backgroundColor: C.cream, borderRadius: 26, maxHeight: '90%', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 30, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  close: { position: 'absolute', top: 12, right: 12, zIndex: 5, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(247,241,232,0.95)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.beige },
  closeText: { fontSize: 15, color: C.espresso, fontFamily: 'Inter_600SemiBold' },
  bodyRow: { flexDirection: 'row' },
  imgTop: { width: '100%', aspectRatio: 4 / 3 },
  imgSide: { width: '44%', minHeight: 420 },
  details: { padding: 22 },
  detailsSide: { flex: 1, padding: 28 },
  meta: { fontFamily: 'Inter_500Medium', fontSize: 12.5, color: C.gold },
  name: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 30, color: C.espresso, marginTop: 4 },
  price: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: C.espresso, marginTop: 6 },
  desc: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 23, color: '#5C5148', marginTop: 10 },
  h: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: C.espresso, marginTop: 20, marginBottom: 8 },
  sub: { fontFamily: 'Inter_500Medium', fontSize: 12.5, color: '#6F6258', marginBottom: 6 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, color: '#5C5148' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: C.beige, backgroundColor: '#FBF8F2', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
  chipWarn: { borderColor: C.terracotta, backgroundColor: '#F8E9E2' },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 12.5, color: C.espresso },
  verify: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#7A6A5C', marginTop: 4 },
  unknownBox: { borderWidth: 1.5, borderColor: C.terracotta, backgroundColor: '#F8E9E2', borderRadius: 12, padding: 14 },
  unknownTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: C.terracotta, marginBottom: 4 },
  warning: { marginTop: 18, borderLeftWidth: 3, borderLeftColor: C.gold, backgroundColor: '#F0E6D8', borderRadius: 8, padding: 12 },
  warningText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, color: C.espresso },
  notes: { minHeight: 64, borderWidth: 1.5, borderColor: C.beige, borderRadius: 12, backgroundColor: '#FBF8F2', padding: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: C.espresso, textAlignVertical: 'top', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null) },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#7A6A5C', marginTop: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: C.beige, backgroundColor: C.cream },
  add: { flex: 1, height: 50, marginLeft: 14, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  addOff: { backgroundColor: C.beige },
  addText: { fontFamily: 'Inter_600SemiBold', fontSize: 15.5, color: C.espresso },
});