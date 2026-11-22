// MenuScreen.js — Page 3: the digital menu.
// Data comes from menuService (local SQLite today, FastAPI later). The selected table is
// passed in from the table-selection screen and is never hardcoded here.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, Platform, Pressable, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { C } from './theme';
import { fetchMenu } from './menuService';
import { filterProducts } from './menuLogic';
import { cartTotals, formatPrice } from './cartLogic';
import { allergenSummary } from './allergens';
import { FoodImage, web } from './menuUi';
import ProductModal from './ProductModal';
import CartDrawer from './CartDrawer';

const pad = (n) => String(n).padStart(2, '0');

// ---------- category chip with animated selection ----------
function CategoryChip({ label, selected, onPress }) {
  const a = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: selected ? 1 : 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [selected]);
  const bg = a.interpolate({ inputRange: [0, 1], outputRange: ['#FBF8F2', C.espresso] });
  const border = a.interpolate({ inputRange: [0, 1], outputRange: [C.beige, C.espresso] });
  const color = a.interpolate({ inputRange: [0, 1], outputRange: [C.espresso, C.cream] });
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={label} style={[{ marginRight: 8, marginBottom: 8 }, web({ cursor: 'pointer' })]}>
      <Animated.View style={[s.chip, { backgroundColor: bg, borderColor: border }]}>
        <Animated.Text style={[s.chipText, { color }]}>{label}</Animated.Text>
        <Animated.View style={[s.chipBar, { opacity: a, transform: [{ scaleX: a }] }]} />
      </Animated.View>
    </Pressable>
  );
}

// ---------- skeleton ----------
function Skeleton({ style }) {
  const o = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(o, { toValue: 0.55, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[{ backgroundColor: '#EADFCE', opacity: o }, style]} />;
}

function SkeletonGrid({ cols }) {
  return (
    <View style={s.grid} accessibilityLabel="Loading the menu">
      {[0, 1, 2, 3, 4, 5].slice(0, cols * 2).map((i) => (
        <View key={i} style={[s.cell, { width: `${(100 / cols).toFixed(2)}%` }]}>
          <View style={s.card}>
            <Skeleton style={{ width: '100%', aspectRatio: 4 / 3 }} />
            <View style={{ padding: 16 }}>
              <Skeleton style={{ height: 12, width: '40%', borderRadius: 6 }} />
              <Skeleton style={{ height: 18, width: '70%', borderRadius: 6, marginTop: 10 }} />
              <Skeleton style={{ height: 12, width: '95%', borderRadius: 6, marginTop: 12 }} />
              <Skeleton style={{ height: 12, width: '80%', borderRadius: 6, marginTop: 6 }} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------- toast ----------
function Toast({ toast, bottom }) {
  const o = useRef(new Animated.Value(0)).current;
  const id = toast ? toast.id : 0;
  useEffect(() => {
    if (!id) return;
    o.setValue(0);
    Animated.sequence([
      Animated.timing(o, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1700),
      Animated.timing(o, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [id]);
  if (!toast) return null;
  return (
    <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={[s.toast, { bottom, opacity: o, transform: [{ translateY: o.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      <Text style={s.toastText}>{toast.text}</Text>
    </Animated.View>
  );
}

// ---------- dish card ----------
function DishCard({ p, categoryName, onOpen, onAdd }) {
  return (
    <View style={s.card}>
      <Pressable
        onPress={() => onOpen(p)}
        accessibilityRole="button"
        accessibilityLabel={`${p.name}, ${formatPrice(p.priceCents)}, ${p.available ? 'available' : 'currently unavailable'}. View details`}
        style={({ hovered }) => [web({ cursor: 'pointer', transitionDuration: '180ms' }), hovered && { opacity: 0.94 }]}
      >
        <View>
          <FoodImage uri={p.imageUrl} label={`Photograph of ${p.name}`} style={s.cardImg} dim={!p.available} />
          {!p.available && <View style={s.unavailBadge}><Text style={s.unavailText}>Currently unavailable</Text></View>}
        </View>
        <View style={s.cardBody}>
          <View style={s.metaRow}>
            <Text style={s.cat}>{categoryName}</Text>
            <Text style={s.prep}>{p.prepMinutes} min</Text>
          </View>
          <Text style={s.dishName}>{p.name}</Text>
          <Text style={s.dishDesc} numberOfLines={2}>{p.description}</Text>
          <Text style={s.allergenLine} numberOfLines={2}>{allergenSummary(p.allergenInfo)}</Text>
        </View>
      </Pressable>
      <View style={s.cardFoot}>
        <View>
          <Text style={s.cardPrice}>{formatPrice(p.priceCents)}</Text>
          <Text style={[s.avail, !p.available && { color: C.terracotta }]}>{p.available ? 'Available' : 'Unavailable'}</Text>
        </View>
        <Pressable
          onPress={() => onAdd(p)}
          disabled={!p.available}
          accessibilityRole="button"
          accessibilityLabel={p.available ? `Add ${p.name} to cart` : `${p.name} is unavailable`}
          accessibilityState={{ disabled: !p.available }}
          style={({ hovered }) => [s.addBtn, !p.available && s.addOff, hovered && p.available && { backgroundColor: '#A8844F' }, web({ cursor: p.available ? 'pointer' : 'not-allowed' })]}
        >
          <Text style={[s.addText, !p.available && { color: '#9A8C7D' }]}>{p.available ? 'Add to cart' : 'Unavailable'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------- featured dish ----------
function Featured({ p, categoryName, layout, onOpen, onAdd }) {
  const row = layout !== 'mobile';
  return (
    <View style={[s.featured, row && { flexDirection: 'row' }]}>
      <Pressable onPress={() => onOpen(p)} accessibilityRole="button" accessibilityLabel={`${p.name}. View details`} style={[row ? { flex: 1.1 } : null, web({ cursor: 'pointer' })]}>
        <FoodImage uri={p.imageUrl} label={`Photograph of ${p.name}`} style={row ? { flex: 1, minHeight: 320 } : { width: '100%', aspectRatio: 4 / 3 }} dim={!p.available} />
      </Pressable>
      <View style={[s.featuredBody, row && { flex: 1 }]}>
        <View style={s.badge}><Text style={s.badgeText}>Featured</Text></View>
        <Text style={s.featuredCat}>{categoryName}</Text>
        <Text style={[s.featuredName, layout === 'desktop' && { fontSize: 38 }]}>{p.name}</Text>
        <Text style={s.featuredDesc}>{p.description}</Text>
        <Text style={s.featuredPrice}>{formatPrice(p.priceCents)}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Pressable
            onPress={() => onAdd(p)}
            disabled={!p.available}
            accessibilityRole="button"
            accessibilityLabel={`Add ${p.name} to cart`}
            style={({ hovered }) => [s.featuredAdd, !p.available && s.addOff, hovered && p.available && { backgroundColor: '#A8844F' }, web({ cursor: p.available ? 'pointer' : 'not-allowed' })]}
          >
            <Text style={[s.addText, { fontSize: 15 }, !p.available && { color: '#9A8C7D' }]}>{p.available ? 'Add to cart' : 'Unavailable'}</Text>
          </Pressable>
          <Pressable onPress={() => onOpen(p)} accessibilityRole="button" style={[s.featuredMore, web({ cursor: 'pointer' })]}>
            <Text style={s.featuredMoreText}>Ingredients and allergens</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ---------- search ----------
function SearchBar({ value, onChange, style }) {
  return (
    <View style={[s.search, style]}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search dishes, ingredients, categories"
        placeholderTextColor="#A89C8D"
        accessibilityLabel="Search the menu"
        returnKeyType="search"
        autoCorrect={false}
        style={s.searchInput}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search" style={web({ cursor: 'pointer' })}>
          <Text style={s.clear}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------- screen ----------
export default function MenuScreen({ user, table, cart, dispatch, onLogout, onChangeTable, onCheckout }) {
  const { width } = useWindowDimensions();
  const layout = width >= 1000 ? 'desktop' : width >= 600 ? 'tablet' : 'mobile';
  const cols = layout === 'desktop' ? 3 : layout === 'tablet' ? 2 : 1;
  const sidePad = layout === 'mobile' ? 18 : 32;

  const [menu, setMenu] = useState({ status: 'loading', categories: [], products: [] });
  const [categoryId, setCategoryId] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastId = useRef(0);

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

  const load = useCallback(async () => {
    setMenu((m) => ({ ...m, status: 'loading' }));
    try {
      const data = await fetchMenu();
      setMenu({ status: 'ready', categories: data.categories, products: data.products });
    } catch (e) {
      setMenu((m) => ({ ...m, status: 'error' }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const catName = useMemo(() => new Map(menu.categories.map((c) => [c.id, c.name])), [menu.categories]);
  const searching = query.trim().length > 0;
  const visible = useMemo(
    () => filterProducts(menu.products, menu.categories, { categoryId, query }),
    [menu.products, menu.categories, categoryId, query]
  );
  const featured = menu.products.find((p) => p.featured) || null;
  const totals = cartTotals(cart.lines);
  const first = (user.fullName || '').trim().split(/\s+/)[0];
  const initial = (user.fullName || '?').trim().charAt(0).toUpperCase();

  const showToast = (text) => {
    toastId.current += 1;
    setToast({ id: toastId.current, text });
  };

  const addToCart = (p, quantity = 1, instructions = '') => {
    if (!p.available) return;
    dispatch({ type: 'add', product: { id: p.id, name: p.name, priceCents: p.priceCents, imageUrl: p.imageUrl, available: p.available }, quantity, instructions });
    showToast(`${p.name} added to your cart`);
  };

  const chips = [{ id: 'all', name: 'All Dishes' }, ...menu.categories];
  const showStickyBar = layout !== 'desktop' && totals.itemCount > 0;

  const cartButton = (
    <Pressable
      onPress={() => setCartOpen(true)}
      accessibilityRole="button"
      accessibilityLabel={`Open cart, ${totals.itemCount} ${totals.itemCount === 1 ? 'item' : 'items'}`}
      style={({ hovered }) => [s.cartBtn, hovered && { borderColor: C.gold }, web({ cursor: 'pointer' })]}
    >
      <Text style={s.cartText}>Cart</Text>
      <View style={[s.badgeCount, totals.itemCount === 0 && { backgroundColor: C.beige }]}>
        <Text style={[s.badgeCountText, totals.itemCount === 0 && { color: '#7A6A5C' }]}>{totals.itemCount}</Text>
      </View>
    </Pressable>
  );

  const header = (
    <View style={s.header}>
      <View>
        <Text style={s.wordmark}>Amant's <Text style={s.wordmarkSub}>Restaurant</Text></Text>
        {layout !== 'mobile' && <Text style={s.headerTable}>Dining at Table {pad(table.id)}</Text>}
      </View>
      {layout === 'desktop' && <SearchBar value={query} onChange={setQuery} style={{ width: 360, marginHorizontal: 20 }} />}
      <View style={s.headerRight}>
        {cartButton}
        <Pressable onPress={() => setMenuOpen(!menuOpen)} style={[s.avatar, web({ cursor: 'pointer' })]} accessibilityRole="button" accessibilityLabel="Profile menu" accessibilityState={{ expanded: menuOpen }}>
          <Text style={s.avatarText}>{initial}</Text>
        </Pressable>
      </View>
      {menuOpen && (
        <View style={s.dropdown}>
          <Text style={s.ddName}>{user.fullName}</Text>
          <Text style={s.ddEmail} numberOfLines={1}>{user.email}</Text>
          <View style={s.ddDivider} />
          <Pressable onPress={() => { setMenuOpen(false); onChangeTable(); }} style={s.ddItem} accessibilityRole="button">
            <Text style={s.ddText}>Change table</Text>
          </Pressable>
          <Pressable onPress={() => { setMenuOpen(false); onLogout(); }} style={s.ddItem} accessibilityRole="button">
            <Text style={[s.ddText, { color: C.terracotta }]}>Log out</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  let body;
  if (menu.status === 'loading' && menu.products.length === 0) {
    body = <SkeletonGrid cols={cols} />;
  } else if (menu.status === 'error') {
    body = (
      <View style={s.stateBox} accessibilityRole="alert">
        <Text style={s.stateTitle}>We couldn't connect to the restaurant. Please try again.</Text>
        <Pressable onPress={load} accessibilityRole="button" style={[s.stateBtn, web({ cursor: 'pointer' })]}>
          <Text style={s.stateBtnText}>Try again</Text>
        </Pressable>
      </View>
    );
  } else if (menu.products.length === 0) {
    body = (
      <View style={s.stateBox}>
        <Text style={s.stateTitle}>Your menu is currently empty.</Text>
        <Text style={s.stateText}>Dishes will appear here as soon as they are added.</Text>
      </View>
    );
  } else if (visible.length === 0) {
    body = searching ? (
      <View style={s.stateBox}>
        <Text style={s.stateTitle}>No dishes match "{query.trim()}"</Text>
        <Text style={s.stateText}>Try a different dish name, ingredient or category.</Text>
        <Pressable onPress={() => setQuery('')} accessibilityRole="button" style={[s.stateBtn, web({ cursor: 'pointer' })]}>
          <Text style={s.stateBtnText}>Clear search</Text>
        </Pressable>
      </View>
    ) : (
      <View style={s.stateBox}>
        <Text style={s.stateTitle}>Nothing here just yet</Text>
        <Text style={s.stateText}>This category has no dishes at the moment. Please check back soon.</Text>
      </View>
    );
  } else {
    body = (
      <View style={[s.grid, layout !== 'mobile' && { marginHorizontal: -10 }]}>
        {visible.map((p) => (
          <View key={p.id} style={[s.cell, { width: `${(100 / cols).toFixed(2)}%`, paddingHorizontal: layout === 'mobile' ? 0 : 10 }]}>
            <DishCard p={p} categoryName={catName.get(p.categoryId) || ''} onOpen={setSelected} onAdd={addToCart} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={[s.root, Platform.OS === 'android' && { paddingTop: StatusBar.currentHeight || 0 }]}>
      <StatusBar barStyle="dark-content" />
      {menuOpen && <Pressable style={s.backdrop} onPress={() => setMenuOpen(false)} accessibilityLabel="Close profile menu" />}
      {header}

      <ScrollView contentContainerStyle={[s.scroll, { paddingHorizontal: sidePad, paddingBottom: showStickyBar ? 120 : 56 }]} keyboardShouldPersistTaps="handled">
        <Animated.View style={[s.page, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
          <View style={s.intro}>
            <Text style={s.welcome}>Welcome, {first}</Text>
            <Text style={[s.title, layout === 'mobile' && { fontSize: 32 }, layout === 'desktop' && { fontSize: 50 }]} accessibilityRole="header">Discover Our Menu</Text>
            <Text style={s.subtitle}>Carefully prepared dishes, made to make every moment memorable.</Text>
            <View style={s.tablePill}><Text style={s.tablePillText}>Dining at Table {pad(table.id)}</Text></View>
          </View>

          {layout !== 'desktop' && <SearchBar value={query} onChange={setQuery} style={{ marginBottom: 20 }} />}

          {featured && !searching && menu.status === 'ready' && (
            <Featured p={featured} categoryName={catName.get(featured.categoryId) || ''} layout={layout} onOpen={setSelected} onAdd={addToCart} />
          )}

          <View style={{ marginTop: 28, marginBottom: 6 }} accessibilityRole="tablist">
            {layout === 'desktop' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {chips.map((c) => <CategoryChip key={c.id} label={c.name} selected={!searching && categoryId === c.id} onPress={() => { setQuery(''); setCategoryId(c.id); }} />)}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingRight: 8 }}>
                {chips.map((c) => <CategoryChip key={c.id} label={c.name} selected={!searching && categoryId === c.id} onPress={() => { setQuery(''); setCategoryId(c.id); }} />)}
              </ScrollView>
            )}
          </View>

          <Text style={s.resultLine} accessibilityLiveRegion="polite">
            {menu.status !== 'ready' ? ' ' : searching ? `${visible.length} ${visible.length === 1 ? 'result' : 'results'} for "${query.trim()}"` : `${visible.length} ${visible.length === 1 ? 'dish' : 'dishes'}`}
          </Text>

          {body}

          <Text style={s.legal}>Menu details shown are sample information until confirmed by the restaurant. If you have a serious allergy, please speak with our staff before ordering.</Text>
        </Animated.View>
      </ScrollView>

      {showStickyBar && (
        <Pressable onPress={() => setCartOpen(true)} accessibilityRole="button" accessibilityLabel={`View cart, ${totals.itemCount} items, ${formatPrice(totals.totalCents)}`} style={[s.sticky, web({ cursor: 'pointer' })]}>
          <Text style={s.stickyText}>View cart ({totals.itemCount})</Text>
          <Text style={s.stickyText}>{formatPrice(totals.totalCents)}</Text>
        </Pressable>
      )}

      <Toast toast={toast} bottom={showStickyBar ? 92 : 28} />

      {selected && (
        <ProductModal
          key={selected.id}
          product={selected}
          categoryName={catName.get(selected.categoryId) || ''}
          layout={layout}
          onClose={() => setSelected(null)}
          onAdd={(p, qty, notes) => { addToCart(p, qty, notes); setSelected(null); }}
        />
      )}
      {cartOpen && (
        <CartDrawer
          cart={cart}
          table={table}
          layout={layout}
          dispatch={dispatch}
          onClose={() => setCartOpen(false)}
          onCheckout={() => { setCartOpen(false); onCheckout(); }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 20 },
  scroll: { flexGrow: 1, alignItems: 'center', paddingTop: 24 },
  page: { width: '100%', maxWidth: 1240 },

  header: { zIndex: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.beige, backgroundColor: C.cream },
  wordmark: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 23, color: C.espresso },
  wordmarkSub: { fontFamily: 'Inter_500Medium', fontSize: 10.5, color: C.gold, letterSpacing: 2.2 },
  headerTable: { fontFamily: 'PlayfairDisplay_500Medium_Italic', fontSize: 13.5, color: '#7A6A5C', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  cartBtn: { flexDirection: 'row', alignItems: 'center', height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: C.beige, backgroundColor: '#FBF8F2', marginRight: 10 },
  cartText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: C.espresso },
  badgeCount: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.espresso, alignItems: 'center', justifyContent: 'center', marginLeft: 8, paddingHorizontal: 6 },
  badgeCountText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: C.cream },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: C.gold, backgroundColor: '#FBF8F2', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 17, color: C.espresso },
  dropdown: { position: 'absolute', top: 62, right: 16, width: 220, backgroundColor: C.cream, borderRadius: 14, borderWidth: 1, borderColor: C.beige, padding: 14, shadowColor: C.espresso, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  ddName: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: C.espresso },
  ddEmail: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#7A6A5C', marginTop: 2 },
  ddDivider: { height: 1, backgroundColor: C.beige, marginVertical: 10 },
  ddItem: { paddingVertical: 7 },
  ddText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: C.espresso },

  intro: { marginBottom: 22 },
  welcome: { fontFamily: 'Inter_500Medium', fontSize: 13, letterSpacing: 1.5, color: C.gold, textTransform: 'uppercase' },
  title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 40, color: C.espresso, marginTop: 6 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 25, color: '#6F6258', marginTop: 8, maxWidth: 520 },
  tablePill: { alignSelf: 'flex-start', marginTop: 14, borderWidth: 1, borderColor: C.gold, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#F0E6D8' },
  tablePillText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: C.espresso },

  search: { flexDirection: 'row', alignItems: 'center', height: 46, borderWidth: 1.5, borderColor: C.beige, borderRadius: 14, backgroundColor: '#FBF8F2', paddingHorizontal: 14 },
  searchInput: { flex: 1, height: 44, fontFamily: 'Inter_400Regular', fontSize: 14.5, color: C.espresso, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null) },
  clear: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#7A6A5C', paddingLeft: 10 },

  featured: { backgroundColor: '#FBF8F2', borderRadius: 24, borderWidth: 1, borderColor: C.beige, overflow: 'hidden' },
  featuredBody: { padding: 24, justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', backgroundColor: C.espresso, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 12 },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11.5, letterSpacing: 1.2, color: C.gold, textTransform: 'uppercase' },
  featuredCat: { fontFamily: 'Inter_500Medium', fontSize: 12.5, color: C.gold },
  featuredName: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 30, color: C.espresso, marginTop: 4 },
  featuredDesc: { fontFamily: 'Inter_400Regular', fontSize: 15.5, lineHeight: 24, color: '#5C5148', marginTop: 10 },
  featuredPrice: { fontFamily: 'Inter_600SemiBold', fontSize: 24, color: C.espresso, marginVertical: 16 },
  featuredAdd: { height: 50, paddingHorizontal: 26, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginBottom: 8 },
  featuredMore: { height: 50, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1.5, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  featuredMoreText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: C.espresso },

  chip: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderRadius: 999, borderWidth: 1.5, alignItems: 'center' },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  chipBar: { position: 'absolute', bottom: 4, width: 18, height: 2, borderRadius: 1, backgroundColor: C.gold },
  resultLine: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#7A6A5C', marginBottom: 14 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { marginBottom: 20 },
  card: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: C.beige, overflow: 'hidden', shadowColor: C.espresso, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  cardImg: { width: '100%', aspectRatio: 4 / 3 },
  unavailBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: C.espresso, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  unavailText: { fontFamily: 'Inter_600SemiBold', fontSize: 11.5, color: C.cream },
  cardBody: { padding: 16, paddingBottom: 6 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cat: { fontFamily: 'Inter_500Medium', fontSize: 12, color: C.gold },
  prep: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#7A6A5C' },
  dishName: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 20, color: C.espresso, marginTop: 4 },
  dishDesc: { fontFamily: 'Inter_400Regular', fontSize: 13.5, lineHeight: 20, color: '#6F6258', marginTop: 6, minHeight: 40 },
  allergenLine: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, color: '#5C5148', marginTop: 8, minHeight: 34 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 8 },
  cardPrice: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: C.espresso },
  avail: { fontFamily: 'Inter_400Regular', fontSize: 12, color: C.success, marginTop: 1 },
  addBtn: { height: 42, paddingHorizontal: 18, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  addOff: { backgroundColor: C.beige },
  addText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: C.espresso },

  stateBox: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 16 },
  stateTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 22, color: C.espresso, textAlign: 'center' },
  stateText: { fontFamily: 'Inter_400Regular', fontSize: 14.5, color: '#6F6258', textAlign: 'center', marginTop: 8, maxWidth: 380 },
  stateBtn: { marginTop: 18, borderWidth: 1.5, borderColor: C.gold, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  stateBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14.5, color: C.espresso },
  legal: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, color: '#8A7E72', textAlign: 'center', marginTop: 24 },

  sticky: { position: 'absolute', left: 16, right: 16, bottom: 16, height: 56, borderRadius: 16, backgroundColor: C.espresso, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  stickyText: { fontFamily: 'Inter_600SemiBold', fontSize: 15.5, color: C.cream },
  toast: { position: 'absolute', alignSelf: 'center', maxWidth: '90%', backgroundColor: C.espresso, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, zIndex: 40 },
  toastText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: C.cream },
});