// Amant's Restaurant — Authentication UI (React Native / Expo)
//
// Install:
//   npx create-expo-app amants-restaurant && cd amants-restaurant
//   npx expo install expo-font @expo-google-fonts/playfair-display @expo-google-fonts/inter react-native-web react-dom expo-sqlite expo-crypto
//   npm install @noble/hashes@1
//   (replace App.js with this file, then: npx expo start)
//
// Accounts are saved in a local SQLite database via ./db.js (passwords are salted
// and hashed, never stored in plaintext). Passwords live only in component state
// and are cleared after submit. See db.js for what local storage can and cannot do.

import React, { useEffect, useReducer, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Easing,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { C } from './theme';
import { registerUser, loginUser, releaseTable } from './db';
import TablesScreen from './TablesScreen';
import MenuScreen from './MenuScreen';
import CheckoutScreen from './CheckoutScreen';
import OrderConfirmation from './OrderConfirmation';
import { cartReducer, initialCart } from './cartLogic';
import { useFonts, PlayfairDisplay_600SemiBold, PlayfairDisplay_500Medium_Italic } from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';


const HERO_IMAGE =
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80';

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

// ---------- validation ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(mode, v) {
  const e = {};
  if (mode === 'signup' && !v.name.trim()) e.name = 'Please enter your full name.';
  if (!v.email.trim()) e.email = 'Email address is required.';
  else if (!EMAIL_RE.test(v.email.trim())) e.email = 'Enter a valid email, like name@example.com.';
  if (!v.password) e.password = 'Password is required.';
  else if (mode === 'signup' && v.password.length < 8) e.password = 'Use at least 8 characters.';
  if (mode === 'signup') {
    if (!v.confirm) e.confirm = 'Please confirm your password.';
    else if (v.confirm !== v.password) e.confirm = 'Passwords do not match.';
    if (!v.terms) e.terms = 'Accept the terms to create your account.';
  }
  return e;
}

const submitToServer = (mode, payload) => (mode === 'signup' ? registerUser(payload) : loginUser(payload));

// ---------- small components ----------
function Field({ label, error, secure, footer, value, onChangeText, onBlur, ...rest }) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: focused ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [focused]);

  const borderColor = error
    ? C.terracotta
    : anim.interpolate({ inputRange: [0, 1], outputRange: [C.beige, C.gold] });
  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: ['#FBF8F2', '#FFFFFF'] });

  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{label}</Text>
      <Animated.View style={[s.inputBox, { borderColor, backgroundColor: bg }]}>
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur && onBlur();
          }}
          secureTextEntry={secure && hidden}
          placeholderTextColor="#A89C8D"
          accessibilityLabel={label}
          {...rest}
        />
        {secure && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Text style={s.toggle}>{hidden ? 'Show' : 'Hide'}</Text>
          </Pressable>
        )}
      </Animated.View>
      {!!error && <FadeIn><Text style={s.error}>{error}</Text></FadeIn>}
      {footer}
    </View>
  );
}

function FadeIn({ children }) {
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(o, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, []);
  return <Animated.View style={{ opacity: o, transform: [{ translateY: o.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }] }}>{children}</Animated.View>;
}

function Checkbox({ checked, onToggle, children, error }) {
  return (
    <View style={{ marginBottom: 6 }}>
      <Pressable
        onPress={onToggle}
        style={s.checkRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <View style={[s.box, checked && s.boxOn, error && !checked && { borderColor: C.terracotta }]}>
          {checked && <Text style={s.tick}>✓</Text>}
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </Pressable>
      {!!error && <FadeIn><Text style={s.error}>{error}</Text></FadeIn>}
    </View>
  );
}

function PrimaryButton({ title, loading, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        disabled={loading}
        accessibilityRole="button"
        style={({ hovered, pressed }) => [s.button, (hovered || pressed) && { backgroundColor: '#A8844F' }, loading && { opacity: 0.85 }]}
      >
        {loading ? <ActivityIndicator color={C.espresso} /> : <Text style={s.buttonText}>{title}</Text>}
      </Pressable>
    </Animated.View>
  );
}

function Banner({ type, text }) {
  if (!text) return null;
  const ok = type === 'success';
  return (
    <FadeIn>
      <View style={[s.banner, { borderColor: ok ? C.success : C.terracotta, backgroundColor: ok ? '#EEF3EA' : '#F8E9E2' }]}>
        <Text style={[s.bannerText, { color: ok ? C.success : C.terracotta }]}>{text}</Text>
      </View>
    </FadeIn>
  );
}

// ---------- left / hero panel ----------
const ALLERGENS = ['Gluten-free', 'Vegan', 'Nut-free', 'Dairy-free'];
const QR = [
  [1, 1, 1, 0, 1],
  [1, 0, 1, 1, 0],
  [1, 1, 1, 0, 1],
  [0, 1, 0, 1, 1],
  [1, 0, 1, 1, 1],
];

function QrMark() {
  return (
    <View style={s.qr}>
      {QR.map((row, r) => (
        <View key={r} style={s.qrRow}>
          {row.map((on, c) => (
            <View key={c} style={[s.qrCell, on && { backgroundColor: C.gold }]} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Brand() {
  return (
    <View style={{ alignSelf: 'center' }}>
      <Text style={s.brand}>Amant's</Text>
      <View style={s.brandRule}>
        <View style={s.line} />
        <Text style={s.brandSub}>Restaurant</Text>
        <View style={s.line} />
      </View>
    </View>
  );
}

function Hero({ layout, width }) {
  // One orchestrated entrance, then the hero stays still.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 900, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  const rise = { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] };

  if (layout === 'mobile') {
    return (
      <ImageBackground source={{ uri: HERO_IMAGE }} style={s.heroMobile} resizeMode="cover">
        <View style={s.overlay} />
        <Animated.View style={[s.heroMobileInner, rise]}>
          <Brand />
          <Text style={s.mobileTagline}>A better way to experience dining.</Text>
        </Animated.View>
      </ImageBackground>
    );
  }

  const headSize = Math.round(Math.min(56, Math.max(40, width * 0.04)));
  return (
    <ImageBackground source={{ uri: HERO_IMAGE }} style={s.hero} resizeMode="cover">
      <View style={s.overlay} />
      <View style={s.heroInner}>
        <Brand />
        <Animated.View style={rise}>
          <Text style={[s.headline, { fontSize: headSize, lineHeight: Math.round(headSize * 1.15) }]}>
            A better way to experience dining.
          </Text>
          <Text style={s.heroText}>
            Discover a seamless dining experience, from exploring our menu to enjoying your favourite dishes.
          </Text>
          <View style={s.chipRow}>
            {ALLERGENS.map((a) => (
              <View key={a} style={s.chip}>
                <View style={s.chipDot} />
                <Text style={s.chipText}>{a}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
        <View style={s.heroFoot}>
          <QrMark />
          <Text style={[s.heroNote, { marginTop: 0 }]}>Scan. Browse. Order to your table.</Text>
        </View>
      </View>
    </ImageBackground>
  );
}

// ---------- password strength ----------
function strengthOf(pw) {
  if (pw.length < 8) return 0;
  let n = 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) n++;
  if (/\d/.test(pw)) n++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 14) n++;
  return n;
}
const STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = [C.terracotta, C.terracotta, C.gold, C.gold, C.success];

function StrengthMeter({ value }) {
  if (!value) return null;
  const n = strengthOf(value);
  return (
    <View style={{ marginTop: 8 }}>
      <View style={s.meter}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[s.seg, i < Math.max(n, 1) && { backgroundColor: STRENGTH_COLORS[n] }]} />
        ))}
      </View>
      <Text style={[s.meterText, { color: STRENGTH_COLORS[n] }]}>{STRENGTH_LABELS[n]}</Text>
    </View>
  );
}

// ---------- main ----------
function AuthScreen({ onAuthenticated }) {
  const { width } = useWindowDimensions();
  // Re-evaluated on every resize / rotation (useWindowDimensions is reactive).
  const layout = width >= 1000 ? 'desktop' : width >= 600 ? 'tablet' : 'mobile';

  const [mode, setMode] = useState('login');
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '', remember: false, terms: false });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);

  const slide = useRef(new Animated.Value(1)).current; // 1 = visible

  const set = (k) => (val) => {
    setValues((p) => ({ ...p, [k]: val }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const switchMode = (next) => {
    if (next === mode || loading) return;
    Animated.timing(slide, { toValue: 0, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setMode(next);
      setErrors({});
      setBanner(null);
      setValues((p) => ({ ...p, password: '', confirm: '', terms: false }));
      Animated.timing(slide, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
  };

  const onSubmit = async () => {
    setBanner(null);
    const e = validate(mode, values);
    setErrors(e);
    if (Object.keys(e).length) {
      setBanner({ type: 'error', text: 'Please fix the highlighted fields and try again.' });
      return;
    }
    setLoading(true);
    try {
      // Never send/store passwords anywhere except over HTTPS to your own backend.
      const res = await submitToServer(mode, {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        remember: values.remember,
      });
      if (res.ok) {
        setValues((p) => ({ ...p, password: '', confirm: '' }));
        onAuthenticated(res.user, mode === 'signup');
      } else {
        setBanner({ type: 'error', text: res.error });
      }
    } catch (err) {
      setBanner({ type: 'error', text: 'We could not reach the server. Check your connection and try again.' });
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === 'login';

  const form = (
    <Animated.View
      style={[
        s.card,
        layout === 'tablet' && s.cardTablet,
        {
          opacity: slide,
          transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [mode === 'login' ? 24 : -24, 0] }) }],
        },
      ]}
    >
      {layout === 'desktop' && <Text style={s.formBrand}>Amant's Restaurant</Text>}

      <View style={s.switcher} accessibilityRole="tablist">
        {['login', 'signup'].map((m) => (
          <Pressable key={m} onPress={() => switchMode(m)} style={[s.tab, mode === m && s.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}>
            <Text style={[s.tabText, mode === m && s.tabTextOn]}>{m === 'login' ? 'Log in' : 'Sign up'}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[s.title, layout === 'mobile' && { fontSize: 28 }]}>{isLogin ? 'Welcome back' : 'Create your account'}</Text>
      <Text style={s.subtitle}>
        {isLogin ? 'Log in to see your table and past orders.' : 'Join us to order straight from your table.'}
      </Text>

      <Banner type={banner?.type} text={banner?.text} />

      {!isLogin && (
        <Field label="Full name" value={values.name} onChangeText={set('name')} error={errors.name} placeholder="Amant Krasniqi" autoCapitalize="words" autoComplete="name" textContentType="name" />
      )}
      <Field label="Email address" value={values.email} onChangeText={set('email')} error={errors.email} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" />
      <Field label="Password" secure footer={!isLogin ? <StrengthMeter value={values.password} /> : null} value={values.password} onChangeText={set('password')} error={errors.password} placeholder={isLogin ? 'Your password' : 'At least 8 characters'} autoCapitalize="none" autoComplete={isLogin ? 'current-password' : 'new-password'} textContentType={isLogin ? 'password' : 'newPassword'} />
      {!isLogin && (
        <Field label="Confirm password" secure value={values.confirm} onChangeText={set('confirm')} error={errors.confirm} placeholder="Repeat your password" autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" onSubmitEditing={onSubmit} />
      )}

      {isLogin ? (
        <View style={s.rowBetween}>
          <Checkbox checked={values.remember} onToggle={() => set('remember')(!values.remember)}>
            <Text style={s.small}>Remember me</Text>
          </Checkbox>
          <Pressable onPress={() => setBanner({ type: 'error', text: 'Password reset is not connected yet. It will arrive with the PHP backend.' })} accessibilityRole="link">
            <Text style={s.link}>Forgot password?</Text>
          </Pressable>
        </View>
      ) : (
        <Checkbox checked={values.terms} onToggle={() => set('terms')(!values.terms)} error={errors.terms}>
          <Text style={s.small}>
            I agree to the <Text style={s.linkInline}>Terms and Conditions</Text> and <Text style={s.linkInline}>Privacy Policy</Text>.
          </Text>
        </Checkbox>
      )}

      <View style={{ height: 14 }} />
      <PrimaryButton title={isLogin ? 'Log in' : 'Create account'} loading={loading} onPress={onSubmit} />

      <View style={s.switchRow}>
        <Text style={s.small}>{isLogin ? 'New to Amant\'s?' : 'Already have an account?'}</Text>
        <Pressable onPress={() => switchMode(isLogin ? 'signup' : 'login')} accessibilityRole="link">
          <Text style={[s.link, { marginLeft: 6 }]}>{isLogin ? 'Create an account' : 'Log in'}</Text>
        </Pressable>
      </View>

      <Text style={s.footer}>© {new Date().getFullYear()} Amant's Restaurant, Prishtina</Text>
    </Animated.View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle={layout === 'desktop' ? 'dark-content' : 'light-content'} />

      {layout === 'desktop' && (
        <View style={s.split}>
          <View style={{ flex: 1.05 }}><Hero layout="desktop" width={width} /></View>
          <KeyboardAvoidingView style={s.right} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.rightScroll} keyboardShouldPersistTaps="handled">{form}</ScrollView>
          </KeyboardAvoidingView>
        </View>
      )}

      {layout === 'tablet' && (
        <ImageBackground source={{ uri: HERO_IMAGE }} style={{ flex: 1 }} resizeMode="cover">
          <View style={s.overlay} />
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.tabletScroll} keyboardShouldPersistTaps="handled">
              <View style={{ marginBottom: 24 }}><Brand /></View>
              {form}
            </ScrollView>
          </KeyboardAvoidingView>
        </ImageBackground>
      )}

      {layout === 'mobile' && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, backgroundColor: C.espresso }} keyboardShouldPersistTaps="handled">
            <Hero layout="mobile" width={width} />
            <View style={s.mobileSheet}>{form}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

// ---------- app root: auth -> table selection -> menu ----------
export default function App() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_500Medium_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const [session, setSession] = useState(null); // { user, isNew }; kept in memory only
  const [table, setTable] = useState(null); // table chosen on the selection screen (single source of truth)
  const [stage, setStage] = useState('menu'); // 'menu' | 'checkout' | 'confirmation'
  const [order, setOrder] = useState(null); // the order just placed
  const [cart, dispatch] = useReducer(cartReducer, initialCart);

  if (!fontsLoaded) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center', backgroundColor: C.espresso }]}>
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }

  if (!session) {
    return <AuthScreen onAuthenticated={(user, isNew) => setSession({ user, isNew })} />;
  }

  const logout = async () => {
    await releaseTable(session.user.id);
    dispatch({ type: 'clear' });
    setTable(null);
    setStage('menu');
    setOrder(null);
    setSession(null);
  };

  if (!table) {
    return (
      <TablesScreen
        user={session.user}
        isNew={session.isNew}
        onContinue={(t) => { setTable(t); setStage('menu'); }}
        onLogout={logout}
      />
    );
  }

  if (stage === 'confirmation' && order) {
    return <OrderConfirmation order={order} onDone={() => { setOrder(null); setStage('menu'); }} />;
  }

  if (stage === 'checkout') {
    return (
      <CheckoutScreen
        user={session.user}
        table={table}
        cart={cart}
        dispatch={dispatch}
        onBack={() => setStage('menu')}
        onChangeTable={() => { setStage('menu'); setTable(null); }}
        onPlaced={(placed) => { dispatch({ type: 'clear' }); setOrder(placed); setStage('confirmation'); }}
      />
    );
  }

  return (
    <MenuScreen
      user={session.user}
      table={table}
      cart={cart}
      dispatch={dispatch}
      onLogout={logout}
      onChangeTable={() => setTable(null)}
      onCheckout={() => setStage('checkout')}
    />
  );
}

// ---------- styles ----------
const s = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 26 },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(184,149,98,0.6)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.gold, marginRight: 7 },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 12.5, color: C.beige },
  heroFoot: { flexDirection: 'row', alignItems: 'center' },
  qr: { padding: 8, borderWidth: 1, borderColor: C.gold, borderRadius: 8, marginRight: 16 },
  qrRow: { flexDirection: 'row' },
  qrCell: { width: 6, height: 6, margin: 1 },
  heroMobile: { justifyContent: 'flex-end' },
  heroMobileInner: { paddingTop: 52, paddingBottom: 46, paddingHorizontal: 24 },
  mobileTagline: { fontFamily: 'PlayfairDisplay_500Medium_Italic', fontSize: 16, color: C.beige, textAlign: 'center', marginTop: 14 },
  cardTablet: { backgroundColor: C.cream, borderRadius: 24, padding: 36, borderWidth: 1, borderColor: 'rgba(184,149,98,0.35)', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 30, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  tabletScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  meter: { flexDirection: 'row' },
  seg: { flex: 1, height: 4, borderRadius: 2, marginRight: 4, backgroundColor: C.beige },
  meterText: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 5 },

  root: { flex: 1, backgroundColor: C.cream },
  split: { flex: 1, flexDirection: 'row' },
  right: { flex: 1, backgroundColor: C.cream },
  rightScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  hero: { flex: 1, justifyContent: 'center' },
  heroCompact: { height: 190, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(43,29,24,0.72)' },
  heroInner: { flex: 1, justifyContent: 'space-between', padding: 56 },
  heroInnerCompact: { padding: 24, paddingTop: 48, alignItems: 'center' },
  brand: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 38, color: C.cream, textAlign: 'center' },
  brandRule: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  line: { flex: 1, height: 1, backgroundColor: C.gold, opacity: 0.8 },
  brandSub: { fontFamily: 'Inter_500Medium', color: C.gold, fontSize: 12, letterSpacing: 3, marginHorizontal: 12 },
  headline: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 50, lineHeight: 58, color: C.cream, maxWidth: 520 },
  heroText: { fontFamily: 'Inter_400Regular', fontSize: 17, lineHeight: 27, color: C.beige, marginTop: 18, maxWidth: 440 },
  heroNote: { fontFamily: 'PlayfairDisplay_500Medium_Italic', fontSize: 18, color: C.gold, marginTop: 28 },

  mobileSheet: { flex: 1, backgroundColor: C.cream, marginTop: -22, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, alignItems: 'center' },
  card: { width: '100%', maxWidth: 420 },
  formBrand: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 20, color: C.espresso, textAlign: 'center', marginBottom: 20 },

  switcher: { flexDirection: 'row', backgroundColor: C.beige, borderRadius: 12, padding: 4, marginBottom: 26 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabOn: { backgroundColor: C.cream, shadowColor: C.espresso, shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#7A6A5C' },
  tabTextOn: { color: C.espresso },

  title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 32, color: C.espresso },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#6F6258', marginTop: 6, marginBottom: 22, lineHeight: 22 },

  fieldWrap: { marginBottom: 16 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 13, color: C.charcoal, marginBottom: 7 },
  inputBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14 },
  input: { flex: 1, height: 50, fontFamily: 'Inter_400Regular', fontSize: 15, color: C.espresso, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null) },
  toggle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: C.gold, paddingLeft: 10 },
  error: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: C.error, marginTop: 6 },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center' },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: C.gold, marginRight: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBF8F2' },
  boxOn: { backgroundColor: C.gold },
  tick: { color: C.espresso, fontSize: 13, fontWeight: '700', marginTop: -1 },
  small: { fontFamily: 'Inter_400Regular', fontSize: 13.5, color: '#5C5148', lineHeight: 20 },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, color: C.terracotta },
  linkInline: { fontFamily: 'Inter_600SemiBold', color: C.terracotta },

  button: { height: 52, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', shadowColor: C.espresso, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: C.espresso, letterSpacing: 0.3 },

  banner: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  bannerText: { fontFamily: 'Inter_500Medium', fontSize: 13.5, lineHeight: 19 },

  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  footer: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#9A8C7D', textAlign: 'center', marginTop: 30 },
});

/*
BACKEND INTEGRATION (next step, not included here)
- POST to HTTPS PHP endpoints (e.g. /api/login.php, /api/register.php) from submitToServer().
- Server: validate again, use prepared statements (PDO), password_hash() on register,
  password_verify() on login, session_regenerate_id(true) after login, HttpOnly + Secure +
  SameSite cookies, and a CSRF token for state-changing requests.
- Keep DB credentials in a config file outside the web root.
*/