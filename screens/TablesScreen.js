// TablesScreen.js — post-authentication table selection for Amant's Restaurant.
//
// Availability comes from db.js (local SQLite). Every tap is validated there:
// unknown ids and occupied/held tables are refused, and one guest can hold only
// one table. The seeded occupied tables are DEMO DATA, not real-time status;
// connect a MySQL-backed API later (same function names) for live availability.

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, Platform, Pressable, SafeAreaView,
  ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { C } from './theme';
import { getTables, selectTable, confirmTable } from './db';

const pad = (n) => String(n).padStart(2, '0');
const web = (obj) => (Platform.OS === 'web' ? obj : null);

const SECTIONS = [
  { name: 'Window Seating', cols: { desktop: 4, tablet: 4, mobile: 2 } },
  { name: 'Main Dining Area', cols: { desktop: 6, tablet: 3, mobile: 3 } },
  { name: 'Private Dining', cols: { desktop: 2, tablet: 2, mobile: 2 } },
];

const TONE = {
  available: { body: '#FBF8F2', border: C.gold, chair: C.beige, chairBorder: 'rgba(184,149,98,0.55)', text: C.espresso },
  selected: { body: C.gold, border: C.espresso, chair: C.gold, chairBorder: C.espresso, text: C.espresso },
  occupied: { body: '#DDD2C6', border: 'rgba(167,95,67,0.45)', chair: '#D3C8BB', chairBorder: 'transparent', text: '#8A7E72' },
};

// ---------- table illustration ----------
function TableTile({ table, onPress, busy, compact }) {
  const { id, seats, state } = table;
  const tone = TONE[state];

  const size = compact ? 82 : seats >= 6 ? 108 : 96;
  const body = compact
    ? seats >= 6 ? 56 : seats === 4 ? 50 : 44
    : seats >= 6 ? 68 : seats === 4 ? 58 : 50;

  const c = size / 2;
  const r = body / 2 + (compact ? 9 : 11);
  const off = seats === 2 ? Math.PI / 2 : 0;

  const pop = useRef(new Animated.Value(state === 'selected' ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(pop, {
      toValue: state === 'selected' ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [state]);

  const scale = pop.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.07],
  });

  const disabled = state === 'occupied' || busy;

  const label = `Table ${pad(id)}, ${seats} seats, ${
    state === 'occupied'
      ? 'occupied'
      : state === 'selected'
        ? 'selected'
        : 'available'
  }`;

  return (
    <Pressable
      onPress={() => state !== 'occupied' && onPress(id)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        selected: state === 'selected',
        disabled: state === 'occupied',
      }}
      style={({ hovered }) => [
        { alignItems: 'center' },
        web({
          cursor: state === 'occupied' ? 'not-allowed' : 'pointer',
          transitionDuration: '180ms',
        }),
        hovered && state === 'available' && {
          transform: [{ translateY: -3 }],
        },
      ]}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [{ scale }],
          opacity: state === 'occupied' ? 0.8 : 1,
        }}
      >
        {Array.from({ length: seats }).map((_, i) => {
          const a = (2 * Math.PI * i) / seats - Math.PI / 2 + off;
          const chairSize = compact ? 12 : 14;

          return (
            <View
              key={i}
              style={[
                s.chair,
                {
                  width: chairSize,
                  height: chairSize,
                  borderRadius: compact ? 4 : 5,
                  backgroundColor: tone.chair,
                  borderColor: tone.chairBorder,
                  left: c + r * Math.cos(a) - chairSize / 2,
                  top: c + r * Math.sin(a) - chairSize / 2,
                },
              ]}
            />
          );
        })}

        <View
          style={[
            s.tableBody,
            {
              width: body,
              height: body,
              borderRadius: body / 2,
              left: c - body / 2,
              top: c - body / 2,
              backgroundColor: tone.body,
              borderColor: tone.border,
              borderWidth: state === 'selected' ? 2 : 1.5,
            },
          ]}
        >
          <Text
            style={[
              s.tableNum,
              compact && { fontSize: 15 },
              { color: tone.text },
            ]}
          >
            {pad(id)}
          </Text>

          {state === 'selected' && (
            <View style={s.check}>
              <Text style={s.checkMark}>✓</Text>
            </View>
          )}
        </View>
      </Animated.View>

      <Text
        style={[
          s.caption,
          compact && { fontSize: 10.5 },
          state === 'occupied' && { color: C.terracotta },
        ]}
      >
        {state === 'occupied' ? 'Occupied' : `${seats} seats`}
      </Text>
    </Pressable>
  );
}

function Plant({ size = 26 }) {
  return (
    <View
      style={[
        s.plantOuter,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <View
        style={[
          s.plantInner,
          {
            width: size * 0.5,
            height: size * 0.5,
            borderRadius: size * 0.25,
          },
        ]}
      />
    </View>
  );
}

function WindowStrip({ compact }) {
  return (
    <View style={s.windows}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[
            s.pane,
            compact && {
              width: 30,
              marginHorizontal: 3,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ---------- floor plan ----------
function Floor({ tables, layout, onSelect, busyId }) {
  const compact = layout === 'mobile';

  return (
    <View
      style={[
        s.floor,
        {
          padding: compact ? 12 : 26,
        },
      ]}
    >
      <View style={s.floorTop}>
        <Plant size={compact ? 22 : 26} />

        <View
          style={[
            s.counter,
            compact && {
              marginHorizontal: 8,
              height: 32,
            },
          ]}
        >
          <Text
            style={[
              s.counterText,
              compact && {
                fontSize: 10,
                letterSpacing: 1,
              },
            ]}
          >
            Service counter
          </Text>
        </View>

        <Plant size={compact ? 22 : 26} />
      </View>

      {SECTIONS.map((sec) => {
        const list = tables.filter((t) => t.section === sec.name);

        if (!list.length) return null;

        const cols = sec.cols[layout];
        const priv = sec.name === 'Private Dining';

        return (
          <View
            key={sec.name}
            style={[
              s.section,
              compact && s.sectionMobile,
              priv && s.sectionPrivate,
            ]}
          >
            <View style={s.sectionHead}>
              <View style={s.rule} />

              <Text
                style={[
                  s.sectionTitle,
                  compact && {
                    fontSize: 14,
                    marginHorizontal: 8,
                  },
                ]}
              >
                {sec.name}
              </Text>

              <View style={s.rule} />
            </View>

            {sec.name === 'Window Seating' && (
              <WindowStrip compact={compact} />
            )}

            <View style={s.grid}>
              {list.map((t) => (
                <View
                  key={t.id}
                  style={{
                    width: `${(100 / cols).toFixed(2)}%`,
                    alignItems: 'center',
                    marginBottom: compact ? 8 : 12,
                  }}
                >
                  <TableTile
                    table={t}
                    onPress={onSelect}
                    busy={busyId === t.id}
                    compact={compact}
                  />
                </View>
              ))}
            </View>
          </View>
        );
      })}

      <View style={s.entrance}>
        <Plant size={22} />
        <View style={s.doorLine} />

        <Text
          style={[
            s.entranceText,
            compact && {
              fontSize: 10,
              letterSpacing: 1,
            },
          ]}
        >
          Entrance
        </Text>

        <View style={s.doorLine} />
        <Plant size={22} />
      </View>
    </View>
  );
}

function Legend() {
  const items = [
    { k: 'available', label: 'Available' },
    { k: 'selected', label: 'Selected' },
    { k: 'occupied', label: 'Occupied' },
  ];

  return (
    <View style={s.legend}>
      {items.map(({ k, label }) => (
        <View key={k} style={s.legendItem}>
          <View
            style={[
              s.swatch,
              {
                backgroundColor: TONE[k].body,
                borderColor: TONE[k].border,
                borderWidth: k === 'selected' ? 2 : 1.5,
              },
            ]}
          >
            {k === 'selected' && (
              <Text
                style={{
                  fontSize: 9,
                  color: C.espresso,
                  fontWeight: '700',
                }}
              >
                ✓
              </Text>
            )}
          </View>

          <Text style={s.legendText}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------- selection panel + button ----------
function ContinueButton({ disabled, loading, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const to = (v) =>
    Animated.spring(scale, {
      toValue: v,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();

  const off = disabled || loading;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => !off && to(0.97)}
        onPressOut={() => to(1)}
        disabled={off}
        accessibilityRole="button"
        accessibilityState={{ disabled: off }}
        style={({ hovered }) => [
          s.cta,
          disabled && s.ctaOff,
          hovered && !off && {
            backgroundColor: '#A8844F',
          },
          web({
            cursor: off ? 'not-allowed' : 'pointer',
            transitionDuration: '160ms',
          }),
        ]}
      >
        {loading ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <ActivityIndicator color={C.espresso} />
            <Text
              style={[
                s.ctaText,
                {
                  marginLeft: 10,
                },
              ]}
            >
              Preparing your table
            </Text>
          </View>
        ) : (
          <Text
            style={[
              s.ctaText,
              disabled && {
                color: '#9A8C7D',
              },
            ]}
          >
            Continue to Menu →
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

function SelectionPanel({ table, loading, onContinue, sticky }) {
  const reveal = useRef(new Animated.Value(1)).current;
  const id = table ? table.id : null;

  useEffect(() => {
    reveal.setValue(0);

    Animated.timing(reveal, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [id]);

  return (
    <View style={[s.panel, sticky && s.panelSticky]}>
      <Animated.View
        style={{
          opacity: reveal,
          transform: [
            {
              translateY: reveal.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
          marginBottom: sticky ? 10 : 18,
        }}
      >
        <Text
          style={[
            s.panelTitle,
            sticky && {
              fontSize: 21,
            },
          ]}
        >
          {table ? `Table ${pad(table.id)} selected` : 'Choose your table'}
        </Text>

        <Text style={s.panelText}>
          {table
            ? 'Your dining experience is ready to begin.'
            : 'Tap an available table on the floor plan to begin.'}
        </Text>

        {table && (
          <Text style={s.panelMeta}>
            {table.seats} seats, {table.section}. Tap another table to change.
          </Text>
        )}
      </Animated.View>

      <ContinueButton
        disabled={!table}
        loading={loading}
        onPress={onContinue}
      />
    </View>
  );
}

// ---------- header ----------
function Header({ user, compact, open, setOpen, onLogout }) {
  const initial = (user.fullName || '?')
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <View
      style={[
        s.header,
        compact && {
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
      ]}
    >
      <View style={{ flexShrink: 1 }}>
        <Text
          style={[
            s.wordmark,
            compact && {
              fontSize: 21,
            },
          ]}
          numberOfLines={1}
        >
          Amant's <Text style={s.wordmarkSub}>Restaurant</Text>
        </Text>

        {!compact && (
          <Text style={s.tagline}>
            Dining, thoughtfully served.
          </Text>
        )}
      </View>

      <Pressable
        onPress={() => setOpen(!open)}
        style={s.avatar}
        accessibilityRole="button"
        accessibilityLabel="Profile menu"
        accessibilityState={{ expanded: open }}
      >
        <Text style={s.avatarText}>{initial}</Text>
      </Pressable>

      {open && (
        <View style={s.menu}>
          <Text style={s.menuName}>{user.fullName}</Text>

          <Text style={s.menuEmail} numberOfLines={1}>
            {user.email}
          </Text>

          <View style={s.menuDivider} />

          <Pressable
            onPress={onLogout}
            style={s.menuItem}
            accessibilityRole="button"
          >
            <Text style={s.menuLogout}>Log out</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ---------- screen ----------
export default function TablesScreen({
  user,
  isNew,
  onContinue,
  onLogout,
}) {
  const { width } = useWindowDimensions();

  const layout =
    width >= 1000
      ? 'desktop'
      : width >= 600
        ? 'tablet'
        : 'mobile';

  const [tables, setTables] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const refresh = async () => setTables(await getTables(user.id));

  useEffect(() => {
    refresh();
  }, []);

  const selected = tables
    ? tables.find((t) => t.state === 'selected') || null
    : null;

  const first = (user.fullName || '').trim().split(/\s+/)[0];

  const onSelect = async (id) => {
    if (busyId !== null || confirming) return;

    setBusyId(id);

    const res = await selectTable(user.id, id);

    setNotice(res.ok ? null : res.error);

    await refresh();

    setBusyId(null);
  };

  const onConfirm = async () => {
    if (!selected || confirming) return;

    setConfirming(true);

    const [res] = await Promise.all([
      confirmTable(user.id, selected.id),
      new Promise((r) => setTimeout(r, 700)),
    ]);

    if (res.ok) {
      onContinue(res.table);
    } else {
      setNotice(res.error);
      await refresh();
      setConfirming(false);
    }
  };

  const logout = () => {
    setMenuOpen(false);
    onLogout();
  };

  const welcome = isNew
    ? `Welcome to Amant's, ${first}.`
    : `Welcome back, ${first}.`;

  const desktop = layout === 'desktop';

  const welcomeBlock = (
    <View
      style={{
        marginBottom: layout === 'mobile' ? 18 : 30,
      }}
    >
      <Text
        style={[
          s.welcome,
          layout === 'mobile' && {
            fontSize: width < 360 ? 26 : 30,
          },
          desktop && {
            fontSize: 46,
          },
        ]}
      >
        {welcome}
      </Text>

      <Text
        style={[
          s.welcomeSub,
          layout === 'mobile' && {
            fontSize: 14,
            lineHeight: 21,
            marginTop: 7,
          },
        ]}
      >
        Your table, your experience. Settle in and discover something wonderful.
      </Text>
    </View>
  );

  const floor = tables ? (
    <>
      {!!notice && (
        <View style={s.notice}>
          <Text style={s.noticeText}>{notice}</Text>
        </View>
      )}

      <Floor
        tables={tables}
        layout={layout}
        onSelect={onSelect}
        busyId={busyId}
      />
    </>
  ) : (
    <View style={{ padding: 60 }}>
      <ActivityIndicator color={C.gold} />
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

      {menuOpen && (
        <Pressable
          style={s.backdrop}
          onPress={() => setMenuOpen(false)}
          accessibilityLabel="Close menu"
        />
      )}

      <Header
        user={user}
        compact={layout === 'mobile'}
        open={menuOpen}
        setOpen={setMenuOpen}
        onLogout={logout}
      />

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          {
            paddingHorizontal: layout === 'mobile' ? 12 : 36,
            paddingBottom: desktop ? 48 : 210,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            s.page,
            {
              opacity: enter,
              transform: [
                {
                  translateY: enter.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {welcomeBlock}

          {desktop ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
              }}
            >
              <View style={{ flex: 1.9 }}>
                {floor}
              </View>

              <View
                style={{
                  width: 330,
                  marginLeft: 32,
                }}
              >
                <SelectionPanel
                  table={selected}
                  loading={confirming}
                  onContinue={onConfirm}
                />

                <Legend />
              </View>
            </View>
          ) : (
            <>
              {floor}
              <Legend />
            </>
          )}
        </Animated.View>
      </ScrollView>

      {!desktop && (
        <SelectionPanel
          table={selected}
          loading={confirming}
          onContinue={onConfirm}
          sticky
        />
      )}
    </SafeAreaView>
  );
}

// ---------- styles ----------
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.cream,
  },

  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 12,
  },

  page: {
    width: '100%',
    maxWidth: 1180,
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },

  header: {
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.beige,
  },

  wordmark: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 24,
    color: C.espresso,
  },

  wordmarkSub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: C.gold,
    letterSpacing: 2.5,
  },

  tagline: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 13.5,
    color: '#7A6A5C',
    marginTop: 2,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.gold,
    backgroundColor: '#FBF8F2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
    color: C.espresso,
  },

  menu: {
    position: 'absolute',
    top: 64,
    right: 18,
    width: 220,
    backgroundColor: C.cream,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.beige,
    padding: 14,
    shadowColor: C.espresso,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },

  menuName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: C.espresso,
  },

  menuEmail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: '#7A6A5C',
    marginTop: 2,
  },

  menuDivider: {
    height: 1,
    backgroundColor: C.beige,
    marginVertical: 10,
  },

  menuItem: {
    paddingVertical: 6,
  },

  menuLogout: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: C.terracotta,
  },

  welcome: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 38,
    color: C.espresso,
  },

  welcomeSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 25,
    color: '#6F6258',
    marginTop: 10,
    maxWidth: 520,
  },

  floor: {
    backgroundColor: '#F0E6D8',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.beige,
  },

  floorTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },

  counter: {
    flex: 1,
    marginHorizontal: 14,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.espresso,
    alignItems: 'center',
    justifyContent: 'center',
  },

  counterText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: C.gold,
    letterSpacing: 1.5,
  },

  section: {
    paddingVertical: 14,
    paddingHorizontal: 6,
    marginBottom: 14,
  },

  sectionMobile: {
    paddingVertical: 10,
    paddingHorizontal: 2,
    marginBottom: 8,
  },

  sectionPrivate: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(184,149,98,0.7)',
    borderRadius: 18,
    backgroundColor: 'rgba(247,241,232,0.55)',
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  rule: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(184,149,98,0.55)',
  },

  sectionTitle: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 17,
    color: C.espresso,
    marginHorizontal: 14,
  },

  windows: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 14,
  },

  pane: {
    width: 38,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FBF8F2',
    borderWidth: 1,
    borderColor: 'rgba(184,149,98,0.6)',
    marginHorizontal: 5,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  entrance: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },

  doorLine: {
    flex: 1,
    height: 2,
    backgroundColor: C.gold,
    opacity: 0.7,
    marginHorizontal: 10,
  },

  entranceText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#7A6A5C',
    letterSpacing: 1.5,
  },

  plantOuter: {
    backgroundColor: C.success,
    opacity: 0.85,
    alignItems: 'center',
    justifyContent: 'center',
  },

  plantInner: {
    backgroundColor: '#8FA97F',
  },

  chair: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 5,
    borderWidth: 1,
  },

  tableBody: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tableNum: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
  },

  check: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.espresso,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkMark: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '700',
    marginTop: -1,
  },

  caption: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11.5,
    color: '#7A6A5C',
    marginTop: 2,
  },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 18,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 6,
  },

  swatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  legendText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#5C5148',
  },

  panel: {
    backgroundColor: '#FBF8F2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.beige,
    padding: 24,
  },

  panelSticky: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopWidth: 1,
    backgroundColor: C.cream,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 18 : 12,
    shadowColor: C.espresso,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: -4,
    },
    elevation: 12,
  },

  panelTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 24,
    color: C.espresso,
  },

  panelText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14.5,
    lineHeight: 21,
    color: '#6F6258',
    marginTop: 4,
  },

  panelMeta: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12.5,
    color: C.gold,
    marginTop: 8,
  },

  cta: {
    height: 54,
    borderRadius: 12,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.espresso,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 3,
  },

  ctaOff: {
    backgroundColor: C.beige,
    shadowOpacity: 0,
    elevation: 0,
  },

  ctaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: C.espresso,
    letterSpacing: 0.3,
  },

  notice: {
    borderWidth: 1,
    borderColor: C.terracotta,
    backgroundColor: '#F8E9E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },

  noticeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13.5,
    color: C.terracotta,
  },
});