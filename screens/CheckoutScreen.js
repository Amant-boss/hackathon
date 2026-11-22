
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
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

function PlaceButton({ loading, disabled, onPress, paymentMethod = 'cash' }) {
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
          <Text style={s.placeText}>
            {paymentMethod === 'card'
              ? 'Processing payment...'
              : 'Placing your order...'}
          </Text>
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
  const compact = width < 380;
  const smallPhone = width < 350;
  const tablet = width >= 600 && width < 900;

  const t = cartTotals(cart.lines);
  const empty = cart.lines.length === 0;

  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState(null);

  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const requestKey = useRef(
    `${user?.id ?? 'guest'}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`
  ).current;

  const pagePadding = smallPhone ? 12 : compact ? 16 : tablet ? 28 : 32;
  const imageSize = compact ? 54 : 68;

  const formatCardNumber = (value) =>
    value
      .replace(/\D/g, '')
      .slice(0, 19)
      .replace(/(.{4})/g, '$1 ')
      .trim();

  const formatExpiry = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);

    if (digits.length <= 2) return digits;

    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  };

  // Accepts a general card-number format instead of requiring one fixed number.
  const validateDemoCard = () => {
    if (!cardName.trim()) {
      return 'Please enter the cardholder name.';
    }

    const digits = cardNumber.replace(/\D/g, '');

    if (digits.length < 12 || digits.length > 19) {
      return 'Enter a card number containing 12–19 digits.';
    }

    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry)) {
      return 'Enter a valid expiry date in MM/YY format.';
    }

    const [month, year] = cardExpiry.split('/').map(Number);
    const now = new Date();
    const currentYear = now.getFullYear() % 100;
    const currentMonth = now.getMonth() + 1;

    if (
      year < currentYear ||
      (year === currentYear && month < currentMonth)
    ) {
      return 'The expiry date must be in the future.';
    }

    if (!/^\d{3,4}$/.test(cardCvv)) {
      return 'Enter a 3–4 digit security code.';
    }

    return null;
  };

  const place = async () => {
    if (submitting || empty) return;

    Keyboard.dismiss();
    setProblem(null);

    if (paymentMethod === 'card') {
      const cardError = validateDemoCard();

      if (cardError) {
        setProblem({
          kind: 'generic',
          text: cardError,
        });
        return;
      }
    }

    setSubmitting(true);

    try {
      if (paymentMethod === 'card') {
        await sleep(1200);
      }

      const [res] = await Promise.all([
        placeOrder({
          userId: user?.id ?? null,
          customerName: user?.fullName || '',
          guestNames: Array.isArray(user?.guestNames)
            ? user.guestNames
            : [],
          paymentMethod,
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
        onPlaced({
          ...res.order,
          paymentStatus: paymentMethod === 'card' ? 'demo_paid' : 'unpaid',
        });
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
          text:
            res.error || "We couldn't place your order. Please try again.",
        });
      }
    } catch (error) {
      setProblem({
        kind: 'generic',
        text:
          error?.message || "We couldn't place your order. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
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

  const changePaymentMethod = (method) => {
    if (submitting) return;

    setPaymentMethod(method);
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
          <Text style={s.rowValue}>{formatPrice(t.serviceCents)}</Text>
        </View>
      )}

      <View style={s.totalRow}>
        <View style={s.totalDetails}>
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
        subtitle={`${cart.lines.length} ${
          cart.lines.length === 1 ? 'item' : 'items'
        } selected`}
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
            <Text style={s.unit}>{formatPrice(l.unitCents)} each</Text>

            {!!l.instructions && (
              <Text style={s.note}>Note: {l.instructions}</Text>
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

  const paymentBox = (
    <View style={s.card}>
      <SectionHeading
        title="Payment method"
        subtitle="Choose how you would like to pay."
      />

      <View style={s.paymentOptions}>
        <Pressable
          onPress={() => changePaymentMethod('cash')}
          disabled={submitting}
          accessibilityRole="radio"
          accessibilityState={{ checked: paymentMethod === 'cash' }}
          style={[
            s.paymentOption,
            paymentMethod === 'cash' && s.paymentOptionSelected,
            web({ cursor: submitting ? 'not-allowed' : 'pointer' }),
          ]}
        >
          <View
            style={[
              s.paymentRadio,
              paymentMethod === 'cash' && s.paymentRadioSelected,
            ]}
          >
            {paymentMethod === 'cash' && (
              <View style={s.paymentRadioDot} />
            )}
          </View>

          <View style={s.paymentOptionText}>
            <Text style={s.paymentTitle}>Cash</Text>
            <Text style={s.paymentDescription}>
              Pay with cash when your order is served.
            </Text>
          </View>

          <Text style={s.paymentIcon}>€</Text>
        </Pressable>

        <Pressable
          onPress={() => changePaymentMethod('card')}
          disabled={submitting}
          accessibilityRole="radio"
          accessibilityState={{ checked: paymentMethod === 'card' }}
          style={[
            s.paymentOption,
            paymentMethod === 'card' && s.paymentOptionSelected,
            web({ cursor: submitting ? 'not-allowed' : 'pointer' }),
          ]}
        >
          <View
            style={[
              s.paymentRadio,
              paymentMethod === 'card' && s.paymentRadioSelected,
            ]}
          >
            {paymentMethod === 'card' && (
              <View style={s.paymentRadioDot} />
            )}
          </View>

          <View style={s.paymentOptionText}>
            <Text style={s.paymentTitle}>Card</Text>
            <Text style={s.paymentDescription}>
              Use the virtual card form.
            </Text>
          </View>

          <Text style={s.paymentIcon}>▰</Text>
        </Pressable>
      </View>

      {paymentMethod === 'card' && (
        <View style={s.cardForm}>
          <View style={s.cardFormHeader}>
            <Text style={s.cardFormTitle}>Card details</Text>
            <Text style={s.demoBadge}>DEMO ONLY</Text>
          </View>

          <View style={s.virtualCard}>
            <View style={s.virtualCardTop}>
              <Text style={s.virtualCardBrand}>AMANT'S</Text>
              <Text style={s.virtualCardChip}>▦</Text>
            </View>

            <Text
              style={[
                s.virtualCardNumber,
                compact && s.virtualCardNumberCompact,
              ]}
            >
              {cardNumber || '•••• •••• •••• ••••'}
            </Text>

            <View style={s.virtualCardBottom}>
              <View style={s.virtualCardHolder}>
                <Text style={s.virtualCardLabel}>CARDHOLDER</Text>
                <Text style={s.virtualCardValue} numberOfLines={1}>
                  {cardName.toUpperCase() || 'YOUR NAME'}
                </Text>
              </View>

              <View>
                <Text style={s.virtualCardLabel}>EXPIRES</Text>
                <Text style={s.virtualCardValue}>
                  {cardExpiry || 'MM/YY'}
                </Text>
              </View>
            </View>
          </View>

          <Text style={s.cardFieldLabel}>Cardholder name</Text>
          <TextInput
            value={cardName}
            onChangeText={setCardName}
            placeholder="Demo cardholder"
            placeholderTextColor="#A89C8D"
            autoCapitalize="words"
            autoCorrect={false}
            editable={!submitting}
            maxLength={60}
            returnKeyType="next"
            style={s.cardInput}
          />

          <Text style={s.cardFieldLabel}>Card number</Text>
          <TextInput
            value={cardNumber}
            onChangeText={(value) =>
              setCardNumber(formatCardNumber(value))
            }
            placeholder="Enter demo card number"
            placeholderTextColor="#A89C8D"
            keyboardType="number-pad"
            maxLength={23}
            editable={!submitting}
            returnKeyType="next"
            style={s.cardInput}
          />

          <View
            style={[
              s.cardInputRow,
              compact && s.cardInputRowCompact,
            ]}
          >
            <View style={s.cardInputColumn}>
              <Text style={s.cardFieldLabel}>Expiry date</Text>
              <TextInput
                value={cardExpiry}
                onChangeText={(value) =>
                  setCardExpiry(formatExpiry(value))
                }
                placeholder="MM/YY"
                placeholderTextColor="#A89C8D"
                keyboardType="number-pad"
                maxLength={5}
                editable={!submitting}
                returnKeyType="next"
                style={s.cardInput}
              />
            </View>

            <View style={s.cardInputColumn}>
              <Text style={s.cardFieldLabel}>Security code</Text>
              <TextInput
                value={cardCvv}
                onChangeText={(value) =>
                  setCardCvv(value.replace(/\D/g, '').slice(0, 4))
                }
                placeholder="000"
                placeholderTextColor="#A89C8D"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                editable={!submitting}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
                style={s.cardInput}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );

  const summaryCard = (
    <View style={[s.card, s.summaryCard]}>
      <SectionHeading title="Order summary" />

      <View style={s.summaryTable}>
        <View style={s.summaryInfo}>
          <Text style={s.summaryInfoLabel}>YOUR TABLE</Text>
          <Text style={s.summaryInfoValue}>Table {pad(table.id)}</Text>
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
        paymentMethod={paymentMethod}
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

      <View style={[s.header, compact && s.headerCompact]}>
        <Pressable
          onPress={onBack}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Back to menu"
          style={[
            s.back,
            compact && s.backCompact,
            web({ cursor: submitting ? 'not-allowed' : 'pointer' }),
          ]}
        >
          <Text style={s.backArrow}>←</Text>
          {!smallPhone && <Text style={s.backText}>Back to menu</Text>}
        </Pressable>

        <Text style={[s.wordmark, compact && s.wordmarkCompact]}>
          Amant's
        </Text>

        <View style={s.headerRight}>
          <Text style={[s.headerLabel, compact && s.headerLabelCompact]}>
            CHECKOUT
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          {
            paddingHorizontal: pagePadding,
            paddingBottom: wide ? 48 : keyboardVisible ? 40 : 150,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={
          Platform.OS === 'ios' ? 'interactive' : 'on-drag'
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={s.page}>
          <View style={s.intro}>
            <Text style={s.eyebrow}>ALMOST THERE</Text>

            <Text
              style={[
                s.title,
                compact && s.titleCompact,
                smallPhone && s.titleSmall,
              ]}
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
                style={[s.emptyButton, web({ cursor: 'pointer' })]}
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
                    {paymentBox}
                  </View>

                  <View style={s.sideColumn}>{summaryCard}</View>
                </View>
              ) : (
                <View>
                  {banner}
                  {items}
                  {noteBox}
                  {paymentBox}

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

      {!wide && !empty && !keyboardVisible && (
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
                paymentMethod={paymentMethod}
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

  headerCompact: {
    paddingHorizontal: 12,
    minHeight: 58,
  },

  back: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    flex: 1,
    minWidth: 0,
  },

  backCompact: {
    flex: 1,
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

  wordmarkCompact: {
    fontSize: 20,
  },

  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },

  headerLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 2,
    color: C.gold,
  },

  headerLabelCompact: {
    fontSize: 8,
    letterSpacing: 1,
  },

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

  titleSmall: {
    fontSize: 32,
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
    flexShrink: 0,
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
    flexShrink: 1,
  },

  characterCount: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#A89C8D',
  },

  paymentOptions: {
    gap: 10,
  },

  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.beige,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },

  paymentOptionSelected: {
    borderColor: C.gold,
    backgroundColor: '#F7F0E5',
  },

  paymentRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#B9AA98',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  paymentRadioSelected: {
    borderColor: C.gold,
  },

  paymentRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.gold,
  },

  paymentOptionText: {
    flex: 1,
    minWidth: 0,
  },

  paymentTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: C.espresso,
  },

  paymentDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11.5,
    color: '#897B6D',
    marginTop: 4,
    lineHeight: 16,
    flexShrink: 1,
  },

  paymentIcon: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    color: C.gold,
    paddingHorizontal: 5,
  },

  cardForm: {
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: C.beige,
  },

  cardFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    flexWrap: 'wrap',
    gap: 8,
  },

  cardFormTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 19,
    color: C.espresso,
  },

  demoBadge: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1,
    color: '#65805B',
    backgroundColor: '#E7EFE1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },

  virtualCard: {
    backgroundColor: '#292D43',
    borderRadius: 16,
    padding: 19,
    marginBottom: 20,
    minHeight: 180,
    justifyContent: 'space-between',
    width: '100%',
  },

  virtualCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  virtualCardBrand: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    letterSpacing: 2,
    color: '#FFFFFF',
  },

  virtualCardChip: {
    fontSize: 25,
    color: '#D7C18F',
  },

  virtualCardNumber: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 19,
    letterSpacing: 2,
    color: '#FFFFFF',
    marginVertical: 18,
  },

  virtualCardNumberCompact: {
    fontSize: 15,
    letterSpacing: 1,
  },

  virtualCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },

  virtualCardHolder: {
    flex: 1,
    paddingRight: 12,
    minWidth: 0,
  },

  virtualCardLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 8,
    letterSpacing: 1.3,
    color: '#B9B8C8',
    marginBottom: 5,
  },

  virtualCardValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
  },

  cardFieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: C.espresso,
    marginBottom: 7,
    marginTop: 12,
  },

  cardInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: C.beige,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: C.espresso,
    width: '100%',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null),
  },

  cardInputRow: {
    flexDirection: 'row',
    gap: 12,
  },

  cardInputRowCompact: {
    flexDirection: 'column',
    gap: 0,
  },

  cardInputColumn: {
    flex: 1,
    minWidth: 0,
  },

  demoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0E6D8',
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
    gap: 9,
  },

  demoNoticeIcon: {
    fontSize: 15,
    color: C.gold,
  },

  demoNoticeText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 17,
    color: '#796B5D',
  },

  summaryTable: {
    flexDirection: 'row',
    backgroundColor: '#F4EDE2',
    borderRadius: 12,
    padding: 13,
    marginBottom: 18,
    gap: 10,
  },

  summaryInfo: {
    flex: 1,
    minWidth: 0,
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
    flexShrink: 0,
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

  totalDetails: {
    flex: 1,
    minWidth: 0,
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
    flexShrink: 0,
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
    flexShrink: 0,
  },

  secureText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#847668',
    lineHeight: 16,
  },

  place: {
    minHeight: 54,
    width: '100%',
    borderRadius: 12,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
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
    fontSize: 14,
    color: C.espresso,
    letterSpacing: 0.2,
    textAlign: 'center',
    flexShrink: 1,
  },

  disabledText: {
    color: '#9A8C7D',
  },

  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  buttonArrow: {
    fontSize: 18,
    color: C.espresso,
  },

  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  sticky: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FBF8F2',
    borderTopWidth: 1,
    borderTopColor: C.beige,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 22 : 12,
  },

  stickyInner: {
    width: '100%',
    maxWidth: 650,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  stickyTotal: {
    flex: 1,
    minWidth: 0,
  },

  stickyLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1.2,
    color: '#99846A',
    marginBottom: 4,
  },

  stickyPrice: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 19,
    color: C.espresso,
  },

  stickyButton: {
    flex: 1.2,
    maxWidth: 260,
    minWidth: 0,
  },

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
    flexShrink: 1,
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
