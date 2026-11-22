
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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
  Keyboard,
} from 'react-native';

import { C } from './theme';
import { getTables, selectTable, confirmTable } from './db';

const pad = (n) => String(n).padStart(2, '0');
const web = (obj) => (Platform.OS === 'web' ? obj : null);

const SECTIONS = [
  { name: 'Window Seating', cols: { desktop: 4, tablet: 3, mobile: 2 }, subtitle: 'A view worth staying for', icon: '☀' },
  { name: 'Main Dining Area', cols: { desktop: 6, tablet: 3, mobile: 3 }, subtitle: 'The heart of the restaurant', icon: '✦' },
  { name: 'Private Dining', cols: { desktop: 2, tablet: 2, mobile: 2 }, subtitle: 'A little more personal', icon: '◆' },
];

const TONE = {
  available: {
    body: '#FFFDF8',
    border: C.gold,
    chair: '#D9C6A8',
    chairBorder: '#B89562',
    text: C.espresso,
  },
  selected: {
    body: C.gold,
    border: C.espresso,
    chair: '#C9A66D',
    chairBorder: C.espresso,
    text: C.espresso,
  },
  occupied: {
    body: '#D9CEC1',
    border: '#B9A99A',
    chair: '#C9BDB0',
    chairBorder: '#B9A99A',
    text: '#827467',
  },
};

// ---------- TABLE ILLUSTRATION ----------

function TableTile({ table, onPress, busy, compact }) {
  const { id, seats, state } = table;
  const tone = TONE[state] || TONE.available;

  const size = compact ? 96 : seats >= 6 ? 122 : 110;

  const body = compact
    ? seats >= 6 ? 64 : seats === 4 ? 58 : 50
    : seats >= 6 ? 76 : seats === 4 ? 66 : 56;

  const center = size / 2;
  const radius = body / 2 + (compact ? 14 : 16);
  const offset = seats === 2 ? Math.PI / 2 : 0;

  const pop = useRef(
    new Animated.Value(state === 'selected' ? 1 : 0)
  ).current;

  useEffect(() => {
    Animated.spring(pop, {
      toValue: state === 'selected' ? 1 : 0,
      useNativeDriver: true,
      speed: 16,
      bounciness: 7,
    }).start();
  }, [state, pop]);

  const scale = pop.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.09],
  });

  const disabled = state === 'occupied' || busy;
  const isSquare = seats === 4;

  return (
    <Pressable
      onPress={() => !disabled && onPress(id)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Table ${pad(id)}, ${seats} seats, ${state}`}
      accessibilityState={{
        selected: state === 'selected',
        disabled,
      }}
      style={({ hovered, pressed }) => [
        s.tile,
        web({
          cursor: disabled ? 'not-allowed' : 'pointer',
          transitionDuration: '180ms',
        }),
        hovered && !disabled && {
          transform: [{ translateY: -4 }],
        },
        pressed && !disabled && {
          opacity: 0.85,
        },
      ]}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [{ scale }],
          opacity: state === 'occupied' ? 0.68 : 1,
        }}
      >
        {state === 'selected' && (
          <View
            style={[
              s.tableGlow,
              {
                width: body + 30,
                height: body + 30,
                left: center - (body + 30) / 2,
                top: center - (body + 30) / 2,
              },
            ]}
          />
        )}

        {Array.from({ length: seats }).map((_, i) => {
          const angle =
            (2 * Math.PI * i) / seats - Math.PI / 2 + offset;

          const chairWidth = compact ? 16 : 18;
          const chairHeight = compact ? 19 : 21;

          return (
            <View
              key={i}
              style={[
                s.chair,
                {
                  width: chairWidth,
                  height: chairHeight,
                  borderRadius: 6,
                  backgroundColor: tone.chair,
                  borderColor: tone.chairBorder,
                  left:
                    center +
                    radius * Math.cos(angle) -
                    chairWidth / 2,
                  top:
                    center +
                    radius * Math.sin(angle) -
                    chairHeight / 2,
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
              borderRadius: isSquare ? 15 : body / 2,
              left: center - body / 2,
              top: center - body / 2,
              backgroundColor: tone.body,
              borderColor: tone.border,
              borderWidth: state === 'selected' ? 2.5 : 1.7,
            },
            state !== 'occupied' && s.tableShadow,
          ]}
        >
          <View
            style={[
              s.tableInner,
              {
                borderRadius: isSquare ? 10 : body / 2,
                borderColor:
                  state === 'occupied'
                    ? 'rgba(130,116,103,0.22)'
                    : 'rgba(184,149,98,0.3)',
              },
            ]}
          >
            <View style={s.tableCenter}>
              <View
                style={[
                  s.tableFlower,
                  state === 'occupied' && {
                    backgroundColor: '#B6A99B',
                  },
                ]}
              />
            </View>

            <Text
              style={[
                s.tableNum,
                compact && { fontSize: 15 },
                { color: tone.text },
              ]}
            >
              {pad(id)}
            </Text>
          </View>
        </View>

        {state === 'selected' && (
          <View style={s.check}>
            <Text style={s.checkMark}>✓</Text>
          </View>
        )}

        {busy && (
          <View style={s.tableLoading}>
            <ActivityIndicator size="small" color={C.espresso} />
          </View>
        )}
      </Animated.View>

      <Text
        style={[
          s.caption,
          compact && { fontSize: 10.5 },
          state === 'occupied' && { color: C.terracotta },
          state === 'selected' && {
            color: C.espresso,
            fontWeight: '700',
          },
        ]}
      >
        {state === 'occupied'
          ? 'Occupied'
          : state === 'selected'
            ? 'Your table'
            : `${seats} seats`}
      </Text>
    </Pressable>
  );
}

// ---------- DECORATIVE ELEMENTS ----------

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
      <View style={s.plantLeaf} />
    </View>
  );
}

function WindowStrip({ compact }) {
  return (
    <View style={s.windowArea}>
      <View style={s.windowLabel}>
        <Text style={s.windowLabelText}>WINDOW VIEW</Text>
      </View>

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
          >
            <View style={s.paneReflection} />
          </View>
        ))}
      </View>
    </View>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <View style={s.statCard}>
      <View style={s.statTop}>
        <Text style={s.statIcon}>{icon}</Text>
        <View
          style={[
            s.statDot,
            { backgroundColor: color },
          ]}
        />
      </View>

      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function FloorStats({ tables, compact }) {
  const available = tables.filter((t) => t.state === 'available').length;
  const occupied = tables.filter((t) => t.state === 'occupied').length;
  const selected = tables.filter((t) => t.state === 'selected').length;

  return (
    <View style={[s.statsRow, compact && s.statsRowMobile]}>
      <StatCard label="Available" value={available} color="#6D9874" icon="✓" />
      <StatCard label="Selected" value={selected} color={C.gold} icon="✦" />
      <StatCard label="Occupied" value={occupied} color={C.terracotta} icon="•" />
    </View>
  );
}

// ---------- FLOOR PLAN ----------

function Floor({ tables, layout, onSelect, busyId }) {
  const compact = layout === 'mobile';

  return (
    <View
      style={[
        s.floor,
        {
          padding: compact ? 13 : 25,
        },
      ]}
    >
      <View style={s.floorHeading}>
        <View>
          <Text style={s.floorEyebrow}>RESTAURANT LAYOUT</Text>
          <Text style={s.floorTitle}>Find your place</Text>
        </View>

        <View style={s.floorBadge}>
          <View style={s.liveDot} />
          <Text style={s.floorBadgeText}>LIVE FLOOR</Text>
        </View>
      </View>

      <FloorStats tables={tables} compact={compact} />

      <View style={s.floorTop}>
        <Plant size={compact ? 23 : 29} />

        <View style={s.counter}>
          <View style={s.counterTopLine} />
          <Text style={s.counterIcon}>✦</Text>
          <Text style={s.counterText}>SERVICE COUNTER</Text>
        </View>

        <Plant size={compact ? 23 : 29} />
      </View>

      <View style={s.floorInstruction}>
        <Text style={s.instructionIcon}>↗</Text>
        <Text style={s.instructionText}>
          Tap any available table to select your spot
        </Text>
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
              <View style={s.sectionTitleGroup}>
                <Text style={s.sectionIcon}>{sec.icon}</Text>

                <View style={{ flexShrink: 1 }}>
                  <Text
                    style={[
                      s.sectionTitle,
                      compact && { fontSize: 14 },
                    ]}
                  >
                    {sec.name}
                  </Text>
                  <Text style={s.sectionSubtitle}>
                    {sec.subtitle}
                  </Text>
                </View>
              </View>

              <View style={s.sectionCount}>
                <Text style={s.sectionCountText}>
                  {list.length} TABLES
                </Text>
              </View>
            </View>

            {sec.name === 'Window Seating' && (
              <WindowStrip compact={compact} />
            )}

            {priv && (
              <View style={s.privateNote}>
                <Text style={s.privateNoteText}>
                  ◆ RESERVED FEELING · PRIVATE SPACE
                </Text>
              </View>
            )}

            <View style={s.grid}>
              {list.map((t) => (
                <View
                  key={t.id}
                  style={{
                    width: `${(100 / cols).toFixed(2)}%`,
                    alignItems: 'center',
                    paddingHorizontal: compact ? 5 : 10,
                    marginBottom: compact ? 25 : 30,
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
        <Plant size={23} />
        <View style={s.doorLine} />

        <View style={s.entranceBadge}>
          <Text style={s.entranceIcon}>⌂</Text>
          <Text style={s.entranceText}>ENTRANCE</Text>
        </View>

        <View style={s.doorLine} />
        <Plant size={23} />
      </View>
    </View>
  );
}

// ---------- LEGEND ----------

function Legend() {
  const items = [
    { k: 'available', label: 'Available' },
    { k: 'selected', label: 'Selected' },
    { k: 'occupied', label: 'Occupied' },
  ];

  return (
    <View style={s.legendContainer}>
      <Text style={s.legendHeading}>TABLE STATUS</Text>

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
                <Text style={s.legendCheck}>✓</Text>
              )}
            </View>

            <Text style={s.legendText}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------- CONTINUE BUTTON ----------

function ContinueButton({ disabled, loading, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const off = disabled || loading;

  const to = (value) =>
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();

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
          hovered && !off && s.ctaHovered,
          web({
            cursor: off ? 'not-allowed' : 'pointer',
            transitionDuration: '160ms',
          }),
        ]}
      >
        {loading ? (
          <View style={s.loadingRow}>
            <ActivityIndicator color={C.espresso} />
            <Text style={[s.ctaText, { marginLeft: 10 }]}>
              Preparing your table
            </Text>
          </View>
        ) : (
          <View style={s.ctaInner}>
            <Text
              style={[
                s.ctaText,
                disabled && { color: '#9A8C7D' },
              ]}
            >
              Continue to Menu
            </Text>
            <Text
              style={[
                s.ctaArrow,
                disabled && { color: '#9A8C7D' },
              ]}
            >
              →
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ---------- SELECTION PANEL ----------

function SelectionPanel({
  table,
  loading,
  onContinue,
  sticky,
  customerName,
  setCustomerName,
  guestNames,
  setGuestNames,
  notice,
}) {
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
  }, [id, reveal]);

  const guestCount = table ? Math.max(0, table.seats - 1) : 0;

  const updateGuestName = (index, value) => {
    setGuestNames((previous) => {
      const updated = [...previous];
      updated[index] = value;
      return updated;
    });
  };

  return (
    <View style={[s.panel, sticky && s.panelSticky]}>
      <View style={s.panelAccent} />

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
          marginBottom: sticky ? 8 : 18,
        }}
      >
        <View style={s.panelEyebrowRow}>
          <Text style={s.panelEyebrow}>YOUR RESERVATION</Text>

          {table && (
            <View style={s.selectedBadge}>
              <View style={s.selectedBadgeDot} />
              <Text style={s.selectedBadgeText}>SELECTED</Text>
            </View>
          )}
        </View>

        <Text
          style={[
            s.panelTitle,
            sticky && { fontSize: 21 },
          ]}
        >
          {table
            ? `Table ${pad(table.id)} selected`
            : 'Choose your table'}
        </Text>

        <Text style={s.panelText}>
          {table
            ? 'Almost there. Tell us who will be joining you.'
            : 'Your dining experience starts with the perfect table.'}
        </Text>

        {table && (
          <View style={s.panelDetails}>
            <View style={s.panelDetailItem}>
              <Text style={s.panelDetailIcon}>♙</Text>
              <Text style={s.panelDetailText}>
                {table.seats} seats
              </Text>
            </View>

            <View style={s.panelDetailDivider} />

            <View style={s.panelDetailItem}>
              <Text style={s.panelDetailIcon}>⌖</Text>
              <Text style={s.panelDetailText}>
                {table.section}
              </Text>
            </View>
          </View>
        )}
      </Animated.View>

      {table && (
        <ScrollView
          style={sticky ? s.guestFieldsSticky : undefined}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.fieldLabel}>YOUR NAME *</Text>

          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Enter your full name"
            placeholderTextColor="#A99B8C"
            style={s.nameInput}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={70}
            returnKeyType="next"
            accessibilityLabel="Your name"
          />

          {guestCount > 0 && (
            <>
              <View style={s.guestHeadingRow}>
                <Text style={s.guestHeading}>OTHER GUESTS</Text>
                <Text style={s.optionalText}>OPTIONAL</Text>
              </View>

              {Array.from({ length: guestCount }).map((_, index) => (
                <View key={index}>
                  <Text style={s.fieldLabel}>
                    Guest {index + 1}
                  </Text>

                  <TextInput
                    value={guestNames[index] || ''}
                    onChangeText={(value) =>
                      updateGuestName(index, value)
                    }
                    placeholder={`Guest ${index + 1} name`}
                    placeholderTextColor="#A99B8C"
                    style={s.nameInput}
                    autoCapitalize="words"
                    autoCorrect={false}
                    maxLength={70}
                    returnKeyType={
                      index === guestCount - 1 ? 'done' : 'next'
                    }
                    accessibilityLabel={`Guest ${index + 1} name`}
                  />
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {!table && (
        <View style={s.emptyPanel}>
          <Text style={s.emptyPanelIcon}>✦</Text>
          <Text style={s.emptyPanelText}>
            Select a table from the floor plan to see your reservation details here.
          </Text>
        </View>
      )}

      {!!notice && (
        <Text style={s.formNotice}>{notice}</Text>
      )}

      <ContinueButton
        disabled={!table || !customerName.trim()}
        loading={loading}
        onPress={onContinue}
      />
    </View>
  );
}

// ---------- HEADER ----------

function Header({ compact, onAdminPress }) {
  return (
    <View
      style={[
        s.header,
        compact && {
          paddingHorizontal: 12,
          paddingVertical: 12,
        },
      ]}
    >
      <View style={s.brandMark}>
        <Text style={s.brandMarkText}>A</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[
            s.wordmark,
            compact && { fontSize: 18 },
          ]}
          numberOfLines={1}
        >
          Amant's <Text style={s.wordmarkSub}>RESTAURANT</Text>
        </Text>

        {!compact && (
          <Text style={s.tagline}>
            Dining, thoughtfully served.
          </Text>
        )}
      </View>

      <View style={s.headerRight}>
        <View style={s.headerOpenDot} />
        <Text style={s.headerOpenText}>OPEN</Text>
      </View>

      <Pressable
        onPress={onAdminPress}
        disabled={!onAdminPress}
        style={({ pressed }) => [
          s.adminButton,
          compact && s.adminButtonCompact,
          pressed && s.adminButtonPressed,
          web({
            cursor: onAdminPress ? 'pointer' : 'default',
          }),
        ]}
        accessibilityRole="button"
        accessibilityLabel="Open admin login"
      >
        <Text style={s.adminIcon}>♙</Text>
        <Text style={s.adminButtonText}>ADMIN</Text>
        <Text style={s.adminIcon}>↗</Text>
      </Pressable>
    </View>
  );
}

// ---------- SCREEN ----------

export default function TablesScreen({ onContinue, onAdminPress }) {
  const { width, height } = useWindowDimensions();

  const layout =
    width >= 1000
      ? 'desktop'
      : width >= 600
        ? 'tablet'
        : 'mobile';

  const [tables, setTables] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [guestNames, setGuestNames] = useState([]);

  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const refresh = async () => {
    try {
      const data = await getTables();
      setTables(data);
    } catch (error) {
      setNotice('Could not load tables. Please try again.');
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const selected = tables
    ? tables.find((t) => t.state === 'selected') || null
    : null;

  const onSelect = async (id) => {
    if (busyId !== null || confirming) return;

    setBusyId(id);
    setNotice(null);

    try {
      const res = await selectTable(id);

      if (res.ok) {
        setCustomerName('');
        setGuestNames([]);
        setNotice(null);
      } else {
        setNotice(res.error);
      }

      await refresh();
    } catch (error) {
      setNotice('Could not select this table. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const onConfirm = async () => {
    if (!selected || confirming) return;

    if (!customerName.trim()) {
      setNotice('Please enter your name before continuing.');
      return;
    }

    Keyboard.dismiss();
    setConfirming(true);
    setNotice(null);

    try {
      const [res] = await Promise.all([
        confirmTable(selected.id),
        new Promise((resolve) => setTimeout(resolve, 700)),
      ]);

      if (res.ok) {
        const tableDetails = {
          ...res.table,
          customerName: customerName.trim(),
          guestNames: guestNames
            .slice(0, Math.max(0, selected.seats - 1))
            .map((name) => name.trim())
            .filter(Boolean),
        };

        if (typeof onContinue === 'function') {
          onContinue(tableDetails);
        }
      } else {
        setNotice(res.error);
        await refresh();
      }
    } catch (error) {
      setNotice('Could not confirm your table. Please try again.');
      await refresh();
    } finally {
      setConfirming(false);
    }
  };

  const desktop = layout === 'desktop';
  const mobile = layout === 'mobile';

  const welcomeBlock = (
    <View
      style={{
        marginBottom: mobile ? 18 : 26,
      }}
    >
      <View style={s.welcomeEyebrow}>
        <View style={s.welcomeEyebrowLine} />
        <Text style={s.welcomeEyebrowText}>
          A PLACE AT OUR TABLE
        </Text>
      </View>

      <Text
        style={[
          s.welcome,
          mobile && {
            fontSize: width < 360 ? 27 : 31,
          },
          desktop && { fontSize: 46 },
        ]}
      >
        Welcome to Amant's.
      </Text>

      <Text
        style={[
          s.welcomeSub,
          mobile && {
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
      {!!notice && !selected && (
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
    <View style={s.loadingContainer}>
      <ActivityIndicator color={C.gold} size="large" />
      <Text style={s.loadingText}>Preparing your floor plan...</Text>
    </View>
  );

  const panelProps = {
    table: selected,
    loading: confirming,
    onContinue: onConfirm,
    customerName,
    setCustomerName,
    guestNames,
    setGuestNames,
    notice: selected ? notice : null,
  };

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

      <Header compact={mobile} onAdminPress={onAdminPress} />

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          {
            paddingHorizontal: mobile ? 9 : 36,
            paddingBottom: desktop ? 48 : Math.max(460, height * 0.55),
            width: '100%',
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
            <View style={s.desktopLayout}>
              <View style={{ flex: 1.9, minWidth: 0 }}>
                {floor}
                <Legend />
              </View>

              <View style={s.desktopPanelColumn}>
                <SelectionPanel {...panelProps} />
                <View style={s.sideNote}>
                  <Text style={s.sideNoteIcon}>✦</Text>
                  <Text style={s.sideNoteText}>
                    Good food tastes even better when you're comfortable.
                  </Text>
                </View>
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
          {...panelProps}
          sticky
        />
      )}
    </SafeAreaView>
  );
}

// ---------- STYLES ----------

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.cream,
  },

  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 22,
  },

  page: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
  },

  header: {
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: C.beige,
    backgroundColor: C.cream,
  },

  brandMark: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: C.espresso,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  brandMarkText: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 24,
    color: C.gold,
  },

  wordmark: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 24,
    color: C.espresso,
  },

  wordmarkSub: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: C.gold,
    letterSpacing: 2,
  },

  tagline: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 13,
    color: '#7A6A5C',
    marginTop: 2,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8EDE4',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginLeft: 10,
    marginRight: 10,
  },

  headerOpenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#6D9874',
    marginRight: 6,
  },

  headerOpenText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: '#527456',
    letterSpacing: 1.2,
  },

  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: C.espresso,
    borderWidth: 1,
    borderColor: C.gold,
    minWidth: 86,
    shadowColor: C.espresso,
    shadowOpacity: 0.13,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  adminButtonCompact: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    minWidth: 70,
    marginLeft: 7,
  },

  adminButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },

  adminIcon: {
    fontSize: 13,
    color: C.gold,
    marginHorizontal: 3,
  },

  adminButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: '#F4E5C9',
    letterSpacing: 1,
  },

  welcomeEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },

  welcomeEyebrowLine: {
    width: 27,
    height: 1.5,
    backgroundColor: C.gold,
    marginRight: 9,
  },

  welcomeEyebrowText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: C.gold,
    letterSpacing: 2.2,
  },

  welcome: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 39,
    color: C.espresso,
  },

  welcomeSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 24,
    color: '#6F6258',
    marginTop: 9,
    maxWidth: 540,
  },

  desktopLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  desktopPanelColumn: {
    width: 340,
    marginLeft: 28,
  },

  floor: {
    backgroundColor: '#F1E7D9',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#DCCBB4',
    overflow: 'hidden',
    width: '100%',
    ...web({
      boxShadow: '0 12px 35px rgba(69, 48, 31, 0.07)',
    }),
  },

  floorHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 17,
  },

  floorEyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 2,
    color: '#A18B6C',
    marginBottom: 3,
  },

  floorTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 22,
    color: C.espresso,
  },

  floorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5EBDD',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6D9874',
    marginRight: 6,
  },

  floorBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1,
    color: '#55775B',
  },

  statsRow: {
    flexDirection: 'row',
    marginBottom: 22,
  },

  statsRowMobile: {
    marginBottom: 17,
  },

  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,253,248,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(184,149,98,0.22)',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
  },

  statTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },

  statIcon: {
    fontSize: 13,
    color: C.gold,
  },

  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statValue: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 23,
    color: C.espresso,
  },

  statLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: '#817366',
    marginTop: 1,
  },

  floorTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  counter: {
    flex: 1,
    marginHorizontal: 13,
    height: 43,
    borderRadius: 11,
    backgroundColor: C.espresso,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...web({
      boxShadow: '0 4px 9px rgba(48, 32, 21, 0.15)',
    }),
  },

  counterTopLine: {
    position: 'absolute',
    top: 4,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  counterIcon: {
    color: C.gold,
    fontSize: 13,
    marginRight: 8,
  },

  counterText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: '#E6CFA7',
    letterSpacing: 1.8,
  },

  floorInstruction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,253,248,0.65)',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 13,
  },

  instructionIcon: {
    fontSize: 15,
    color: C.gold,
    marginRight: 8,
  },

  instructionText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#796A5A',
    flexShrink: 1,
  },

  section: {
    paddingVertical: 15,
    paddingHorizontal: 9,
    marginBottom: 12,
    borderRadius: 17,
    backgroundColor: 'rgba(255,253,248,0.28)',
  },

  sectionMobile: {
    paddingVertical: 15,
    paddingHorizontal: 5,
    marginBottom: 12,
  },

  sectionPrivate: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(184,149,98,0.65)',
    backgroundColor: 'rgba(247,241,232,0.8)',
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 4,
  },

  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },

  sectionIcon: {
    fontSize: 19,
    color: C.gold,
    marginRight: 9,
  },

  sectionTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
    color: C.espresso,
  },

  sectionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: '#968575',
    marginTop: 2,
  },

  sectionCount: {
    backgroundColor: '#EAE0D2',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginLeft: 5,
  },

  sectionCountText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    color: '#8A755B',
    letterSpacing: 0.7,
  },

  windowArea: {
    marginBottom: 14,
  },

  windowLabel: {
    alignItems: 'center',
    marginBottom: 6,
  },

  windowLabelText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    color: '#9A866B',
    letterSpacing: 2,
  },

  windows: {
    flexDirection: 'row',
    justifyContent: 'center',
  },

  pane: {
    width: 39,
    height: 9,
    borderRadius: 4,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(184,149,98,0.6)',
    marginHorizontal: 5,
    overflow: 'hidden',
  },

  paneReflection: {
    width: '45%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },

  privateNote: {
    alignSelf: 'flex-start',
    backgroundColor: '#E9DFD1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 12,
  },

  privateNoteText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    color: '#987D58',
    letterSpacing: 0.8,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    alignItems: 'center',
  },

  tile: {
    alignItems: 'center',
    paddingTop: 3,
  },

  tableGlow: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: 'rgba(184,149,98,0.13)',
  },

  chair: {
    position: 'absolute',
    borderWidth: 1,
    ...web({
      boxShadow: '0 2px 3px rgba(61, 43, 28, 0.12)',
    }),
  },

  tableBody: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tableShadow: {
    ...web({
      boxShadow: '0 5px 10px rgba(61, 43, 28, 0.15)',
    }),
    elevation: 3,
  },

  tableInner: {
    width: '78%',
    height: '78%',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tableCenter: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: 'rgba(184,149,98,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },

  tableFlower: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.gold,
  },

  tableNum: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
  },

  check: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: C.espresso,
    borderWidth: 2,
    borderColor: '#F1E7D9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkMark: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '700',
    marginTop: -1,
  },

  tableLoading: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
    backgroundColor: 'rgba(255,253,248,0.55)',
  },

  caption: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#796A5A',
    marginTop: 3,
  },

  plantOuter: {
    backgroundColor: '#62866B',
    alignItems: 'center',
    justifyContent: 'center',
    ...web({
      boxShadow: '0 2px 5px rgba(40, 60, 40, 0.15)',
    }),
  },

  plantInner: {
    backgroundColor: '#A6BD8F',
  },

  plantLeaf: {
    position: 'absolute',
    width: '28%',
    height: '28%',
    borderRadius: 8,
    backgroundColor: '#D1D9A5',
    top: '17%',
    right: '20%',
  },

  entrance: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 2,
  },

  doorLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: C.gold,
    opacity: 0.55,
    marginHorizontal: 9,
  },

  entranceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E7DCCB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },

  entranceIcon: {
    fontSize: 14,
    color: C.gold,
    marginRight: 6,
  },

  entranceText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: '#7A6A5C',
    letterSpacing: 1.7,
  },

  legendContainer: {
    marginTop: 16,
    paddingHorizontal: 5,
  },

  legendHeading: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: '#9A866B',
    letterSpacing: 1.8,
    textAlign: 'center',
    marginBottom: 11,
  },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    backgroundColor: '#FBF8F2',
    borderWidth: 1,
    borderColor: C.beige,
    borderRadius: 13,
    paddingVertical: 12,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 11,
    marginBottom: 2,
  },

  swatch: {
    width: 19,
    height: 19,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },

  legendCheck: {
    fontSize: 10,
    color: C.espresso,
    fontWeight: '700',
  },

  legendText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#5C5148',
  },

  panel: {
    backgroundColor: '#FFFDF8',
    borderRadius: 21,
    borderWidth: 1,
    borderColor: C.beige,
    padding: 23,
    overflow: 'hidden',
    ...web({
      boxShadow: '0 10px 28px rgba(69, 48, 31, 0.07)',
    }),
  },

  panelAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: C.gold,
  },

  panelSticky: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopWidth: 1,
    backgroundColor: C.cream,
    paddingHorizontal: 15,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    shadowColor: C.espresso,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: -5,
    },
    elevation: 16,
  },

  panelEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  panelEyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: '#A18B6C',
    letterSpacing: 1.8,
  },

  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8EDE4',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  selectedBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6D9874',
    marginRight: 5,
  },

  selectedBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    color: '#55775B',
    letterSpacing: 0.7,
  },

  panelTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 24,
    color: C.espresso,
  },

  panelText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: '#6F6258',
    marginTop: 5,
  },

  panelDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    backgroundColor: '#F3EBDD',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 12,
  },

  panelDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },

  panelDetailIcon: {
    color: C.gold,
    fontSize: 14,
    marginRight: 5,
  },

  panelDetailText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: '#75634F',
    flexShrink: 1,
  },

  panelDetailDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#D4C3AB',
    marginHorizontal: 9,
  },

  emptyPanel: {
    backgroundColor: '#F4EEE4',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 8,
  },

  emptyPanelIcon: {
    color: C.gold,
    fontSize: 23,
    marginBottom: 5,
  },

  emptyPanelText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    color: '#897968',
  },

  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: C.espresso,
    letterSpacing: 0.8,
    marginTop: 13,
    marginBottom: 7,
  },

  nameInput: {
    height: 47,
    borderWidth: 1,
    borderColor: C.beige,
    borderRadius: 10,
    paddingHorizontal: 13,
    backgroundColor: '#FFFFFF',
    color: C.espresso,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    ...web({
      outlineStyle: 'none',
    }),
  },

  guestHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 19,
    marginBottom: 1,
  },

  guestHeading: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: C.espresso,
    letterSpacing: 0.8,
  },

  optionalText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    color: '#9A8B7A',
    letterSpacing: 1,
  },

  guestFieldsSticky: {
    maxHeight: 180,
  },

  formNotice: {
    color: C.terracotta,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    marginTop: 8,
    marginBottom: 4,
  },

  cta: {
    height: 53,
    borderRadius: 12,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.espresso,
    shadowOpacity: 0.17,
    shadowRadius: 9,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 3,
    marginTop: 17,
  },

  ctaOff: {
    backgroundColor: C.beige,
    shadowOpacity: 0,
    elevation: 0,
  },

  ctaHovered: {
    backgroundColor: '#A8844F',
  },

  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  ctaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: C.espresso,
    letterSpacing: 0.3,
  },

  ctaArrow: {
    fontSize: 19,
    color: C.espresso,
    marginLeft: 10,
    marginTop: -2,
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 13,
    color: C.terracotta,
  },

  loadingContainer: {
    paddingVertical: 75,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#8A7E72',
    marginTop: 12,
  },

  sideNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFE6D8',
    borderRadius: 12,
    padding: 13,
    marginTop: 14,
  },

  sideNoteIcon: {
    color: C.gold,
    fontSize: 18,
    marginRight: 9,
  },

  sideNoteText: {
    flex: 1,
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 12,
    lineHeight: 18,
    color: '#796A5C',
  },
});
