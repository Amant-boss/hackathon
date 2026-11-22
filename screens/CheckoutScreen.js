
// CheckoutScreen.js — review the order and place it.
// The order is created by placeOrder() in db.js, which re-reads every price and checks the
// table and availability again. The totals shown here are only a preview.

import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
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
      style={({ hovered, pressed }) => [
        s.place,
        off && s.placeOff,
        hovered && !off && s.placeHover,
        pressed && !off && s.placePressed,
        web({
          cursor: off ? 'not-allowed' : 'pointer',
          transitionDuration: '160ms',
        }),
      ]}
    >
      {loading ? (
        <View style={s.loadingContent}>
          <ActivityIndicator color={C.espresso} size="small" />
          <Text style={s.placeText}>Placing your order...</Text>
        </View>
      ) : (
        <View style={s.buttonContent}>
          <Text style={[s.placeText, disabled && s.disabledText]}>
            Place Order
          </Text>
          <Text style={[s.buttonArrow, disabled && s.disabledText]}>→</Text>
        </View>
      )}
    </Pressable>
  );
}

function SectionHeading({ title, subtitle }) {
  return (
    <View style={s.sectionHeading}>
      <Text style={s.h}>{title}</Text>
      {!!subtitle && <Text style={s.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

export default function CheckoutScreen({
  user,
  table,
  cart,
  dispatch,
  onBack,
  onChangeTable,
  onPlaced,
}) {
  const { width } = useWindowDimensions();

  const wide = width >= 900;
  const compact = width < 420;
  const tablet = width >= 600 && width < 900;

  const t = cartTotals(cart.lines);
  const empty = cart.lines.length === 0;

  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState(null);

  // One key per checkout visit: a double tap or retry can never create two orders.
  const requestKey = useRef(
    `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  ).current;

  const pagePadding = compact ? 16 : tablet ? 28 : 32;
  const imageSize = compact ? 58 : 68;

  const place = async () => {
    if (submitting || empty) return;

    setSubmitting(true);
    setProblem(null);

    const [res] = await Promise.all([
      placeOrder({
        userId: user.id,
        tableId: table.id,
        lines: cart.lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          instructions: l.instructions,
          options: l.options,
        })),
        note,
        expectedTotalCents: t.totalCents,
        requestKey,
      }),
      sleep(700),
    ]);

    if (res.ok) {
      onPlaced(res.order);
      return;
    }

    if (res.code === 'PRICE_CHANGED') {
      dispatch({ type: 'syncPrices', prices: res.prices });
      setProblem({
        kind: 'price',
        text: 'Some prices have changed. Your total has been updated. Please review it and place your order again.',
      });
    } else if (res.code === 'UNAVAILABLE') {
      setProblem({
        kind: 'unavailable',
        text: res.error,
        unavailable: res.unavailable,
      });
    } else if (res.code === 'TABLE') {
      setProblem({
        kind: 'table',
        text: res.error,
      });
    } else {
      setProblem({
        kind: 'generic',
        text: res.error || "We couldn't place your order. Please try again.",
      });
    }

    setSubmitting(false);
  };

  const removeUnavailable = () => {
    const ids = new Set(
      (problem.unavailable || []).map((u) => u.productId)
    );

    cart.lines
      .filter((l) => ids.has(l.productId))
      .forEach((l) => dispatch({ type: 'remove', key: l.key }));

    setProblem(null);
  };

  const banner = problem && (
    <View style={s.problem} accessibilityRole="alert">
      <View style={s.problemHeader}>
        <Text style={s.problemIcon}>!</Text>
        <Text style={s.problemLabel}>Something needs your attention</Text>
      </View>

      <Text style={s.problemText}>{problem.text}</Text>

      {problem.kind === 'unavailable' && (
        <Pressable
          onPress={removeUnavailable}
          accessibilityRole="button"
          style={[s.problemBtn, web({ cursor: 'pointer' })]}
        >
          <Text style={s.problemBtnText}>Remove unavailable dishes</Text>
        </Pressable>
      )}

      {problem.kind === 'table' && (
        <Pressable
          onPress={onChangeTable}
          accessibilityRole="button"
          style={[s.problemBtn, web({ cursor: 'pointer' })]}
        >
          <Text style={s.problemBtnText}>Choose a table</Text>
        </Pressable>
      )}
    </View>
  );

  const totalsBlock = (
    <View>
      <View style={s.row}>
        <Text style={s.rowText}>Subtotal</Text>
        <Text style={s.rowValue}>{formatPrice(t.subtotalCents)}</Text>
      </View>

      {SERVICE_CHARGE_PERCENT > 0 && (
        <View style={s.row}>
          <Text style={s.rowText}>
            Service charge ({SERVICE_CHARGE_PERCENT}%)
          </Text>
          <Text style={s.rowValue}>
            {formatPrice(t.serviceCents)}
          </Text>
        </View>
      )}

      <View style={s.totalRow}>
        <View>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalHint}>Including applicable charges</Text>
        </View>
        <Text style={s.totalText}>{formatPrice(t.totalCents)}</Text>
      </View>
    </View>
  );

  const items = (
    <View style={s.card}>
      <SectionHeading
        title="Your order"
        subtitle={`${cart.lines.length} ${cart.lines.length === 1 ? 'item' : 'items'} selected`}
      />

      {cart.lines.map((l, i) => (
        <View
          key={l.key}
          style={[
            s.line,
            i === 0 && s.firstLine,
            { minHeight: imageSize + 24 },
          ]}
        >
          <FoodImage
            uri={l.imageUrl}
            label={`Photograph of ${l.name}`}
            style={[
              s.thumb,
              {
                width: imageSize,
                height: imageSize,
              },
            ]}
          />

          <View style={s.itemDetails}>
            <Text style={s.itemQuantity}>{l.quantity} ×</Text>
            <Text style={s.name}>{l.name}</Text>

            <Text style={s.unit}>
              {formatPrice(l.unitCents)} each
            </Text>

            {!!l.instructions && (
              <Text style={s.note}>
                Note: {l.instructions}
              </Text>
            )}
          </View>

          <Text style={s.itemPrice}>
            {formatPrice(l.unitCents * l.quantity)}
          </Text>
        </View>
      ))}
    </View>
  );

  const noteBox = (
    <View style={s.card}>
      <SectionHeading
        title="Notes for the kitchen"
        subtitle="Anything you'd like our kitchen team to know?"
      />

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Add a note to your order..."
        placeholderTextColor="#A89C8D"
        multiline
        maxLength={200}
        accessibilityLabel="Notes for the kitchen"
        style={s.noteInput}
        textAlignVertical="top"
      />

      <View style={s.noteFooter}>
        <Text style={s.hint}>
          For allergies, please also tell our staff.
        </Text>
        <Text style={s.characterCount}>{note.length}/200</Text>
      </View>
    </View>
  );

  const summaryCard = (
    <View style={[s.card, s.summaryCard]}>
      <SectionHeading title="Order summary" />

      <View style={s.summaryTable}>
        <View style={s.summaryInfo}>
          <Text style={s.summaryInfoLabel}>YOUR TABLE</Text>
          <Text style={s.summaryInfoValue}>
            Table {pad(table.id)}
          </Text>
        </View>

        <View style={s.summaryInfo}>
          <Text style={s.summaryInfoLabel}>ORDER ITEMS</Text>
          <Text style={s.summaryInfoValue}>
            {cart.lines.reduce((sum, l) => sum + l.quantity, 0)}
          </Text>
        </View>
      </View>

      <View style={s.summaryDivider} />

      {totalsBlock}

      <View style={s.secureNote}>
        <Text style={s.secureIcon}>✓</Text>
        <Text style={s.secureText}>
          Your order will be checked before it is placed.
        </Text>
      </View>

      <PlaceButton
        loading={submitting}
        disabled={empty}
        onPress={place}
      />
    </View>
  );

  return (
    <SafeAreaView
      style={[
        s.root,
        Platform.OS === 'android' && {
          paddingTop: StatusBar.currentHeight || 0,
        },
      ]}
    >
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={onBack}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Back to menu"
          style={[
            s.back,
            web({ cursor: submitting ? 'not-allowed' : 'pointer' }),
          ]}
        >
          <Text style={s.backArrow}>←</Text>
          <Text style={s.backText}>Back to menu</Text>
        </Pressable>

        <Text style={s.wordmark}>Amant's</Text>

        <View style={s.headerRight}>
          <Text style={s.headerLabel}>CHECKOUT</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          {
            paddingHorizontal: pagePadding,
            paddingBottom: wide || empty ? 48 : 170,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.page}>
          {/* Page introduction */}
          <View style={s.intro}>
            <Text style={s.eyebrow}>ALMOST THERE</Text>
            <Text
              style={[s.title, compact && s.titleCompact]}
              accessibilityRole="header"
            >
              Checkout
            </Text>

            <Text style={s.subtitle}>
              Review your selection before sending your order to the kitchen.
            </Text>

            <View style={s.tablePill}>
              <View style={s.tableDot} />
              <Text style={s.tablePillText}>
                Ordering for Table {pad(table.id)}
              </Text>
            </View>
          </View>

          {empty ? (
            <View style={s.emptyBox}>
              <View style={s.emptyIcon}>
                <Text style={s.emptyIconText}>✦</Text>
              </View>

              <Text style={s.emptyTitle}>
                Your cart is waiting for something delicious.
              </Text>

              <Text style={s.emptySubtitle}>
                Explore our menu and add something you love.
              </Text>

              <Pressable
                onPress={onBack}
                accessibilityRole="button"
                style={[
                  s.emptyButton,
                  web({ cursor: 'pointer' }),
                ]}
              >
                <Text style={s.emptyButtonText}>Browse the menu →</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {wide ? (
                <View style={s.desktopLayout}>
                  <View style={s.mainColumn}>
                    {banner}
                    {items}
                    {noteBox}
                  </View>

                  <View style={s.sideColumn}>
                    {summaryCard}
                  </View>
                </View>
              ) : (
                <View>
                  {banner}
                  {items}
                  {noteBox}

                  <View style={s.mobileSummary}>
                    <SectionHeading title="Order summary" />
                    {totalsBlock}

                    <View style={s.secureNote}>
                      <Text style={s.secureIcon}>✓</Text>
                      <Text style={s.secureText}>
                        Your order will be checked before it is placed.
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Mobile and tablet sticky checkout bar */}
      {!wide && !empty && (
        <View style={s.sticky}>
          <View style={s.stickyInner}>
            <View style={s.stickyTotal}>
              <Text style={s.stickyLabel}>TOTAL TO PAY</Text>
              <Text style={s.stickyPrice}>
                {formatPrice(t.totalCents)}
              </Text>
            </View>

            <View style={s.stickyButton}>
              <PlaceButton
                loading={submitting}
                disabled={empty}
                onPress={place}
              />
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.cream,
  },

  // Header
  header: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.beige,
    backgroundColor: '#FBF8F2',
  },

  back: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    minWidth: 110,
  },

  backArrow: {
    fontSize: 19,
    color: C.espresso,
    marginRight: 7,
  },

  backText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    color: C.espresso,
  },

  wordmark: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 23,
    color: C.espresso,
  },

  headerRight: {
    minWidth: 110,
    alignItems: 'flex-end',
  },

  headerLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 2,
    color: C.gold,
  },

  // Main page
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 30,
  },

  page: {
    width: '100%',
    maxWidth: 1080,
  },

  intro: {
    marginBottom: 26,
  },

  eyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 2.5,
    color: C.gold,
    marginBottom: 8,
  },

  title: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 44,
    color: C.espresso,
  },

  titleCompact: {
    fontSize: 36,
  },

  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#796B5D',
    marginTop: 5,
    maxWidth: 480,
  },

  tablePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 17,
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#F0E6D8',
  },

  tableDot: {
    width: 7,
    height: 7,
    borderRadius: 10,
    backgroundColor: C.gold,
    marginRight: 9,
  },

  tablePillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: C.espresso,
  },

  // Layout
  desktopLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },

  mainColumn: {
    flex: 1.55,
    minWidth: 0,
  },

  sideColumn: {
    flex: 1,
    minWidth: 0,
  },

  // Cards
  card: {
    backgroundColor: '#FBF8F2',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.beige,
    padding: 20,
    marginBottom: 16,
  },

  summaryCard: {
    padding: 22,
  },

  sectionHeading: {
    marginBottom: 13,
  },

  h: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 21,
    color: C.espresso,
  },

  sectionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: '#897B6D',
    marginTop: 4,
    lineHeight: 18,
  },

  // Order items
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: C.beige,
    gap: 12,
  },

  firstLine: {
    borderTopWidth: 0,
    paddingTop: 4,
  },

  thumb: {
    borderRadius: 12,
    backgroundColor: '#EFE8DD',
  },

  itemDetails: {
    flex: 1,
    minWidth: 0,
  },

  itemQuantity: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: C.gold,
    marginBottom: 2,
  },

  name: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14.5,
    lineHeight: 20,
    color: C.espresso,
    flexShrink: 1,
  },

  unit: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#897B6D',
    marginTop: 4,
  },

  note: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11.5,
    fontStyle: 'italic',
    color: '#5C5148',
    marginTop: 5,
    lineHeight: 17,
  },

  itemPrice: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    color: C.espresso,
    textAlign: 'right',
    flexShrink: 0,
  },

  // Kitchen note
  noteInput: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: C.beige,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: C.espresso,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null),
  },

  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 9,
    flexWrap: 'wrap',
    gap: 5,
  },

  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11.5,
    color: '#897B6D',
  },

  characterCount: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#A89C8D',
  },

  // Summary
  summaryTable: {
    flexDirection: 'row',
    backgroundColor: '#F4EDE2',
    borderRadius: 12,
    padding: 13,
    marginBottom: 18,
  },

  summaryInfo: {
    flex: 1,
  },

  summaryInfoLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1.2,
    color: '#99846A',
    marginBottom: 5,
  },

  summaryInfoValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: C.espresso,
  },

  summaryDivider: {
    height: 1,
    backgroundColor: C.beige,
    marginBottom: 17,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 11,
    gap: 12,
  },

  rowText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    color: '#796B5D',
    flexShrink: 1,
  },

  rowValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13.5,
    color: C.espresso,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: C.beige,
    gap: 10,
  },

  totalLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: C.espresso,
  },

  totalHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10.5,
    color: '#998B7C',
    marginTop: 3,
  },

  totalText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    color: C.espresso,
  },

  mobileSummary: {
    backgroundColor: '#FBF8F2',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.beige,
    padding: 20,
    marginBottom: 18,
  },

  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 18,
    gap: 8,
  },

  secureIcon: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#65805B',
    backgroundColor: '#E7EFE1',
    width: 21,
    height: 21,
    borderRadius: 20,
    textAlign: 'center',
    textAlignVertical: 'center',
    overflow: 'hidden',
  },

  secureText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#847668',
    lineHeight: 16,
  },

  // Place order button
  place: {
    minHeight: 54,
    width: '100%',
    borderRadius: 12,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    shadowColor: C.espresso,
    shadowOpacity: 0.13,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  placeHover: {
    backgroundColor: '#A8844F',
  },

  placePressed: {
    opacity: 0.85,
  },

  placeOff: {
    backgroundColor: C.beige,
    shadowOpacity: 0,
    elevation: 0,
  },

  placeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: C.espresso,
    letterSpacing: 0.2,
  },

  disabledText: {
    color: '#9A8C7D',
  },

  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  buttonArrow: {
    fontSize: 18,
    color: C.espresso,
  },

  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  // Sticky mobile bar
  sticky: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FBF8F2',
    borderTopWidth: 1,
    borderTopColor: C.beige,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 26 : 14,
  },

  stickyInner: {
    width: '100%',
    maxWidth: 650,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },

  stickyTotal: {
    flex: 1,
    minWidth: 0,
  },

  stickyLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1.4,
    color: '#99846A',
    marginBottom: 4,
  },

  stickyPrice: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 19,
    color: C.espresso,
  },

  stickyButton: {
    flex: 1.1,
    maxWidth: 260,
  },

  // Error banner
  problem: {
    borderWidth: 1,
    borderColor: '#D9A18B',
    backgroundColor: '#F8E9E2',
    borderRadius: 14,
    padding: 15,
    marginBottom: 16,
  },

  problemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },

  problemIcon: {
    width: 21,
    height: 21,
    borderRadius: 20,
    overflow: 'hidden',
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: '#EBD0C4',
    color: C.terracotta,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },

  problemLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: C.terracotta,
  },

  problemText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 20,
    color: C.terracotta,
  },

  problemBtn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#FBF8F2',
  },

  problemBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: C.espresso,
  },

  // Empty cart
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF8F2',
    borderWidth: 1,
    borderColor: C.beige,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 55,
    marginTop: 4,
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 30,
    backgroundColor: '#F0E6D8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  emptyIconText: {
    fontSize: 27,
    color: C.gold,
  },

  emptyTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 22,
    lineHeight: 30,
    color: C.espresso,
    textAlign: 'center',
    maxWidth: 400,
  },

  emptySubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#897B6D',
    textAlign: 'center',
    marginTop: 9,
    lineHeight: 20,
  },

  emptyButton: {
    marginTop: 22,
    backgroundColor: C.gold,
    borderRadius: 11,
    paddingVertical: 13,
    paddingHorizontal: 22,
  },

  emptyButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: C.espresso,
  },
});
