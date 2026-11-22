// MenuScreen.js — Page 3: Digital menu + AI restaurant assistant.
// Connected to the FastAPI/Gemini backend.
// Responsive for desktop, tablet and mobile.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
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
import { fetchMenu } from './menuService';
import { filterProducts } from './menuLogic';
import { cartTotals, formatPrice } from './cartLogic';
import { allergenSummary } from './allergens';
import { FoodImage, web } from './menuUi';
import ProductModal from './ProductModal';
import CartDrawer from './CartDrawer';
import { SEED_PRODUCTS } from './menuData';

// IMPORTANT:
// This is your computer's LAN IP.
// Your phone and computer must be connected to the same Wi-Fi.
// (Optional) set EXPO_PUBLIC_CHAT_API_URL to override, e.g. http://10.0.2.2:8000/chat
// for the Android emulator.
const CHAT_API_URL =
  process.env.EXPO_PUBLIC_CHAT_API_URL ||
  (Platform.OS === 'web'
    ? 'http://127.0.0.1:8000/chat'
    : 'http://192.168.178.78:8000/chat');

const pad = (n) => String(n).padStart(2, '0');

// ---------- category chip ----------
function CategoryChip({ label, selected, onPress }) {
  const a = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(a, {
      toValue: selected ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [selected, a]);

  const bg = a.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FBF8F2', C.espresso],
  });

  const border = a.interpolate({
    inputRange: [0, 1],
    outputRange: [C.beige, C.espresso],
  });

  const color = a.interpolate({
    inputRange: [0, 1],
    outputRange: [C.espresso, C.cream],
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[s.categoryPressable, web({ cursor: 'pointer' })]}
    >
      <Animated.View
        style={[
          s.chip,
          {
            backgroundColor: bg,
            borderColor: border,
          },
        ]}
      >
        <Animated.Text style={[s.chipText, { color }]}>
          {label}
        </Animated.Text>

        <Animated.View
          style={[
            s.chipBar,
            {
              opacity: a,
              transform: [{ scaleX: a }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

// ---------- skeleton ----------
function Skeleton({ style }) {
  const o = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(o, {
          toValue: 0.55,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [o]);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: '#EADFCE',
          opacity: o,
        },
        style,
      ]}
    />
  );
}

function SkeletonGrid({ cols, imageHeight }) {
  return (
    <View style={s.grid} accessibilityLabel="Loading the menu">
      {[0, 1, 2, 3, 4, 5].slice(0, cols * 2).map((i) => (
        <View
          key={i}
          style={[
            s.cell,
            {
              width: `${100 / cols}%`,
            },
          ]}
        >
          <View style={s.card}>
            <Skeleton
              style={{
                width: '100%',
                height: imageHeight,
                flexGrow: 0,
                flexShrink: 0,
              }}
            />

            <View style={s.skeletonBody}>
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
      Animated.timing(o, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1700),
      Animated.timing(o, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [id, o]);

  if (!toast) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        s.toast,
        {
          bottom,
          opacity: o,
          transform: [
            {
              translateY: o.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={s.toastText}>{toast.text}</Text>
    </Animated.View>
  );
}

// ---------- dish card ----------
function DishCard({
  p,
  categoryName,
  onOpen,
  onAdd,
  layout,
  imageHeight,
}) {
  const mobile = layout === 'mobile';

  return (
    <View style={s.card}>
      <Pressable
        onPress={() => onOpen(p)}
        accessibilityRole="button"
        accessibilityLabel={`${p.name}, ${formatPrice(p.priceCents)}, ${p.available ? 'available' : 'currently unavailable'}. View details`}
        style={({ hovered }) => [
          web({
            cursor: 'pointer',
            transitionDuration: '180ms',
          }),
          hovered && web({ opacity: 0.94 }),
        ]}
      >
        <View style={s.imageWrapper}>
          <FoodImage
            uri={p.imageUrl}
            label={`Photograph of ${p.name}`}
            style={[
              s.cardImg,
              {
                height: imageHeight,
                aspectRatio: undefined,
              },
            ]}
            dim={!p.available}
          />

          {!p.available && (
            <View style={s.unavailBadge}>
              <Text style={s.unavailText}>Currently unavailable</Text>
            </View>
          )}
        </View>

        <View style={[s.cardBody, mobile && s.cardBodyMobile]}>
          <View style={s.metaRow}>
            <Text style={s.cat}>{categoryName}</Text>
            <Text style={s.prep}>{p.prepMinutes} min</Text>
          </View>

          <Text style={[s.dishName, mobile && s.dishNameMobile]}>
            {p.name}
          </Text>

          <Text style={s.dishDesc} numberOfLines={2}>
            {p.description}
          </Text>

          <Text style={s.allergenLine} numberOfLines={2}>
            {allergenSummary(p.allergenInfo)}
          </Text>
        </View>
      </Pressable>

      <View style={[s.cardFoot, mobile && s.cardFootMobile]}>
        <View style={s.priceBlock}>
          <Text style={s.cardPrice}>{formatPrice(p.priceCents)}</Text>
          <Text
            style={[
              s.avail,
              !p.available && { color: C.terracotta },
            ]}
          >
            {p.available ? 'Available' : 'Unavailable'}
          </Text>
        </View>

        <Pressable
          onPress={() => onAdd(p)}
          disabled={!p.available}
          accessibilityRole="button"
          accessibilityLabel={
            p.available
              ? `Add ${p.name} to cart`
              : `${p.name} is unavailable`
          }
          accessibilityState={{ disabled: !p.available }}
          style={({ hovered }) => [
            s.addBtn,
            mobile && s.addBtnMobile,
            !p.available && s.addOff,
            hovered && p.available && web({
              backgroundColor: '#A8844F',
            }),
            web({
              cursor: p.available ? 'pointer' : 'not-allowed',
            }),
          ]}
        >
          <Text
            style={[
              s.addText,
              !p.available && { color: '#9A8C7D' },
            ]}
          >
            {p.available ? 'Add to cart' : 'Unavailable'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------- featured dish ----------
function Featured({
  p,
  categoryName,
  layout,
  onOpen,
  onAdd,
  imageHeight,
}) {
  const row = layout !== 'mobile';

  return (
    <View style={[s.featured, row && s.featuredRow]}>
      <Pressable
        onPress={() => onOpen(p)}
        accessibilityRole="button"
        accessibilityLabel={`${p.name}. View details`}
        style={[
          row ? s.featuredImageDesktop : s.featuredImagePressableMobile,
          web({ cursor: 'pointer' }),
        ]}
      >
        <FoodImage
          uri={p.imageUrl}
          label={`Photograph of ${p.name}`}
          style={
            row
              ? s.featuredImageRow
              : [
                  s.featuredImageMobile,
                  { height: imageHeight },
                ]
          }
          dim={!p.available}
        />
      </Pressable>

      <View
        style={[
          s.featuredBody,
          row && s.featuredBodyRow,
          !row && s.featuredBodyMobile,
        ]}
      >
        <View style={s.badge}>
          <Text style={s.badgeText}>Featured</Text>
        </View>

        <Text style={s.featuredCat}>{categoryName}</Text>

        <Text
          style={[
            s.featuredName,
            layout === 'desktop' && { fontSize: 38 },
            layout === 'mobile' && s.featuredNameMobile,
          ]}
        >
          {p.name}
        </Text>

        <Text style={s.featuredDesc}>{p.description}</Text>

        <Text style={s.featuredPrice}>
          {formatPrice(p.priceCents)}
        </Text>

        <View style={s.featuredActions}>
          <Pressable
            onPress={() => onAdd(p)}
            disabled={!p.available}
            accessibilityRole="button"
            accessibilityLabel={`Add ${p.name} to cart`}
            style={({ hovered }) => [
              s.featuredAdd,
              !p.available && s.addOff,
              hovered && p.available && web({
                backgroundColor: '#A8844F',
              }),
              web({
                cursor: p.available ? 'pointer' : 'not-allowed',
              }),
            ]}
          >
            <Text
              style={[
                s.addText,
                { fontSize: 15 },
                !p.available && { color: '#9A8C7D' },
              ]}
            >
              {p.available ? 'Add to cart' : 'Unavailable'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onOpen(p)}
            accessibilityRole="button"
            style={[s.featuredMore, web({ cursor: 'pointer' })]}
          >
            <Text style={s.featuredMoreText}>
              Ingredients and allergens
            </Text>
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
        <Pressable
          onPress={() => onChange('')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={web({ cursor: 'pointer' })}
        >
          <Text style={s.clear}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------- chatbot message ----------
function ChatMessage({ item, onAdd }) {
  const isUser = item.role === 'user';

  return (
    <View
      style={[
        s.chatMessageRow,
        isUser && s.chatMessageRowUser,
      ]}
    >
      {!isUser && (
        <View style={s.chatBotAvatar}>
          <Text style={s.chatBotAvatarText}>A</Text>
        </View>
      )}

      <View
        style={[
          s.chatBubble,
          isUser ? s.chatUserBubble : s.chatAssistantBubble,
        ]}
      >
        <Text
          style={[
            s.chatMessageText,
            isUser && s.chatUserText,
          ]}
        >
          {item.text}
        </Text>

        {!!item.recommendations?.length && (
          <View style={s.chatRecommendations}>
            <Text style={s.chatRecommendationHeading}>
              Recommended for you
            </Text>

            {item.recommendations.map((product) => (
              <View
                key={product.id}
                style={s.chatProductCard}
              >
                <View style={s.chatProductInfo}>
                  <Text style={s.chatProductName}>
                    {product.name}
                  </Text>
                  <Text style={s.chatProductPrice}>
                    {formatPrice(product.priceCents)}
                  </Text>
                </View>

                <Pressable
                  onPress={() => onAdd(product)}
                  disabled={!product.available}
                  style={[
                    s.chatAddButton,
                    !product.available && s.chatAddButtonDisabled,
                  ]}
                >
                  <Text style={s.chatAddButtonText}>
                    {product.available ? 'Add +' : 'Unavailable'}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ---------- chatbot ----------
function Chatbot({
  visible,
  onClose,
  products,
  onAdd,
  layout,
  width,
  height,
}) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hello! Welcome to Amant's Restaurant. I'm your menu assistant. Ask me about our dishes, ingredients, prices, or what you might enjoy!",
    },
  ]);

  const chatScrollRef = useRef(null);
  const requestLock = useRef(false);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [messages, visible, loading]);

  const sendMessage = useCallback(async (textOverride) => {
    const message = (textOverride ?? input).trim();

    if (!message || requestLock.current || loading) return;

    requestLock.current = true;
    setLoading(true);
    setInput('');

    let controller;
    let timeoutId;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: message,
    };

    const previousMessages = messages.filter(
      (m) => m.role === 'user' || m.role === 'assistant'
    );

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

    try {
      const history = previousMessages
        .filter((m) => m.id !== 'welcome')
        .slice(-12)
        .map((m) => ({
          role: m.role,
          content: m.text,
        }));

      controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          message,
          menu: SEED_PRODUCTS,
          history,
        }),
      });

      if (!response.ok) {
        let detail = '';

        try {
          const errorData = await response.json();
          detail = errorData.detail || errorData.message || '';
        } catch (_) {
          // The server did not return JSON.
        }

        throw new Error(
          detail || `Server returned error ${response.status}`
        );
      }

      const data = await response.json();

      if (!data || typeof data.reply !== 'string') {
        throw new Error('The chatbot returned an invalid response.');
      }

      // Backend returns exact product names.
      // Match them to the actual SQLite menu products so Add to Cart
      // uses the real product ID, price and image.
      const recommendationNames = Array.isArray(data.recommendations)
        ? data.recommendations
        : [];

      const recommendedProducts = recommendationNames
        .map((name) => {
          if (typeof name !== 'string') return null;

          return products.find(
            (product) =>
              product.name?.trim().toLowerCase() ===
              name.trim().toLowerCase()
          );
        })
        .filter((product) => product && product.available)
        .filter(
          (product, index, array) =>
            array.findIndex((p) => p.id === product.id) === index
        );

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: data.reply,
          recommendations: recommendedProducts,
        },
      ]);
    } catch (error) {
      console.error('Chatbot request failed:', error);

      let errorText =
        "I couldn't reach the restaurant assistant right now.";

      if (error.name === 'AbortError') {
        errorText =
          'The assistant took too long to answer. Please try again.';
      } else if (
        error.message?.includes('Network request failed') ||
        error.message?.includes('Failed to fetch')
      ) {
        errorText =
          "I can't connect to the restaurant server. Please check that the backend is running and your phone and computer are connected to the same Wi-Fi.";
      } else if (error.message) {
        errorText = `Something went wrong: ${error.message}`;
      }

      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          text: errorText,
        },
      ]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      requestLock.current = false;
    }
  }, [input, loading, messages, products]);

  const suggestions = [
    'What do you recommend?',
    'Show me vegetarian dishes',
    'What is the cheapest main?',
    'Tell me about the pizzas',
  ];

  const chatWidth =
    layout === 'mobile'
      ? Math.min(width - 24, 460)
      : 420;

  const chatHeight =
    layout === 'mobile'
      ? Math.min(height * 0.78, 680)
      : Math.min(height - 100, 650);

  return (
    <>
      <Pressable
        onPress={onClose}
        style={s.chatBackdrop}
        accessibilityLabel="Close chat"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.chatKeyboardContainer}
        pointerEvents="box-none"
      >
        <View
          style={[
            s.chatWindow,
            {
              width: chatWidth,
              height: chatHeight,
              maxHeight: height - 30,
            },
          ]}
        >
          <View style={s.chatHeader}>
            <View style={s.chatHeaderLeft}>
              <View style={s.chatHeaderAvatar}>
                <Text style={s.chatHeaderAvatarText}>A</Text>
              </View>

              <View style={s.chatHeaderText}>
                <Text style={s.chatTitle}>Restaurant Assistant</Text>
                <View style={s.chatOnlineRow}>
                  <View style={s.chatOnlineDot} />
                  <Text style={s.chatOnlineText}>
                    Here to help
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={s.chatCloseButton}
              accessibilityRole="button"
              accessibilityLabel="Close assistant"
            >
              <Text style={s.chatCloseText}>✕</Text>
            </Pressable>
          </View>

          <View style={s.chatIntro}>
            <Text style={s.chatIntroTitle}>
              What can I help you find?
            </Text>
            <Text style={s.chatIntroSubtitle}>
              Ask me anything about our menu.
            </Text>
          </View>

          <ScrollView
            ref={chatScrollRef}
            style={s.chatMessagesScroll}
            contentContainerStyle={s.chatMessagesContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {messages.map((item) => (
              <ChatMessage
                key={item.id}
                item={item}
                onAdd={onAdd}
              />
            ))}

            {loading && (
              <View style={s.chatLoadingRow}>
                <View style={s.chatBotAvatar}>
                  <Text style={s.chatBotAvatarText}>A</Text>
                </View>

                <View style={s.chatTypingBubble}>
                  <ActivityIndicator
                    size="small"
                    color={C.gold}
                  />
                  <Text style={s.chatTypingText}>
                    Thinking...
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {messages.length <= 1 && (
            <View style={s.chatSuggestions}>
              <Text style={s.chatSuggestionsTitle}>
                QUICK QUESTIONS
              </Text>

              <View style={s.chatSuggestionList}>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => sendMessage(suggestion)}
                    disabled={loading}
                    style={s.chatSuggestion}
                  >
                    <Text style={s.chatSuggestionText}>
                      {suggestion}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={s.chatInputArea}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask about our menu..."
              placeholderTextColor="#9A8C7D"
              style={s.chatInput}
              multiline
              maxLength={1000}
              editable={!loading}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={() => sendMessage()}
              accessibilityLabel="Message the restaurant assistant"
            />

            <Pressable
              onPress={() => sendMessage()}
              disabled={!input.trim() || loading}
              style={[
                s.chatSendButton,
                (!input.trim() || loading) && s.chatSendButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <Text style={s.chatSendText}>↑</Text>
            </Pressable>
          </View>

          <Text style={s.chatDisclaimer}>
            Menu information is provided as a guide. Please confirm allergies with staff.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

// ---------- screen ----------
export default function MenuScreen({
  user,
  table,
  cart,
  dispatch,
  onLogout,
  onChangeTable,
  onCheckout,
}) {
  const { width, height } = useWindowDimensions();

  const layout =
    width >= 1000
      ? 'desktop'
      : width >= 600
        ? 'tablet'
        : 'mobile';

  const isSmallPhone = width < 380;
  const isVerySmallPhone = width < 340;

  const cols =
    layout === 'desktop'
      ? 3
      : layout === 'tablet'
        ? 2
        : 1;

  const sidePad =
    layout === 'mobile'
      ? isVerySmallPhone
        ? 10
        : isSmallPhone
          ? 13
          : 16
      : layout === 'tablet'
        ? 22
        : 32;

  const clamp = (value, min, max) =>
    Math.min(max, Math.max(min, value));

  const contentWidth = Math.max(0, width - sidePad * 2);

  const cardWidth =
    layout === 'desktop'
      ? (contentWidth - 40) / 3
      : layout === 'tablet'
        ? (contentWidth - 20) / 2
        : contentWidth;

  const cardImageHeight = Math.round(
    layout === 'mobile'
      ? clamp(cardWidth * 0.34, 88, 116)
      : layout === 'tablet'
        ? clamp(cardWidth * 0.48, 112, 150)
        : clamp(cardWidth * 0.46, 130, 180)
  );

  const featuredImageHeight = Math.round(
    layout === 'mobile'
      ? clamp(contentWidth * 0.39, 100, 128)
      : 250
  );

  const [menu, setMenu] = useState({
    status: 'loading',
    categories: [],
    products: [],
  });

  const [categoryId, setCategoryId] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);

  const toastId = useRef(0);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const load = useCallback(async () => {
    setMenu((m) => ({
      ...m,
      status: 'loading',
    }));

    try {
      const data = await fetchMenu();

      setMenu({
        status: 'ready',
        categories: data.categories,
        products: data.products,
      });
    } catch (e) {
      setMenu((m) => ({
        ...m,
        status: 'error',
      }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const catName = useMemo(
    () => new Map(menu.categories.map((c) => [c.id, c.name])),
    [menu.categories]
  );

  const searching = query.trim().length > 0;

  const visible = useMemo(
    () =>
      filterProducts(
        menu.products,
        menu.categories,
        {
          categoryId,
          query,
        }
      ),
    [
      menu.products,
      menu.categories,
      categoryId,
      query,
    ]
  );

  const featured =
    menu.products.find((p) => p.featured) || null;

  const totals = cartTotals(cart.lines);

  const first = (user.fullName || '')
    .trim()
    .split(/\s+/)[0];

  const initial = (user.fullName || '?')
    .trim()
    .charAt(0)
    .toUpperCase();

  const showToast = (text) => {
    toastId.current += 1;
    setToast({
      id: toastId.current,
      text,
    });
  };

  const addToCart = (
    p,
    quantity = 1,
    instructions = ''
  ) => {
    if (!p.available) return;

    dispatch({
      type: 'add',
      product: {
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        imageUrl: p.imageUrl,
        available: p.available,
      },
      quantity,
      instructions,
    });

    showToast(`${p.name} added to your cart`);
  };

  const chips = [
    { id: 'all', name: 'All Dishes' },
    ...menu.categories,
  ];

  const showStickyBar =
    layout !== 'desktop' && totals.itemCount > 0;

  const cartButton = (
    <Pressable
      onPress={() => setCartOpen(true)}
      accessibilityRole="button"
      accessibilityLabel={`Open cart, ${totals.itemCount} ${totals.itemCount === 1 ? 'item' : 'items'}`}
      style={({ hovered }) => [
        s.cartBtn,
        isSmallPhone && s.cartBtnSmall,
        isVerySmallPhone && s.cartBtnTiny,
        hovered && web({ borderColor: C.gold }),
        web({ cursor: 'pointer' }),
      ]}
    >
      <Text style={s.cartText}>Cart</Text>

      <View
        style={[
          s.badgeCount,
          totals.itemCount === 0 && {
            backgroundColor: C.beige,
          },
        ]}
      >
        <Text
          style={[
            s.badgeCountText,
            totals.itemCount === 0 && {
              color: '#7A6A5C',
            },
          ]}
        >
          {totals.itemCount}
        </Text>
      </View>
    </Pressable>
  );

  const header = (
    <View
      style={[
        s.header,
        layout === 'mobile' && s.headerMobile,
        isSmallPhone && s.headerSmall,
        isVerySmallPhone && s.headerTiny,
      ]}
    >
      <View style={s.brandBlock}>
        <Text
          style={[
            s.wordmark,
            isSmallPhone && s.wordmarkSmall,
            isVerySmallPhone && s.wordmarkTiny,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          Amant's <Text style={s.wordmarkSub}>Restaurant</Text>
        </Text>

        {layout !== 'mobile' && (
          <Text style={s.headerTable}>
            Dining at Table {pad(table.id)}
          </Text>
        )}
      </View>

      {layout === 'desktop' && (
        <SearchBar
          value={query}
          onChange={setQuery}
          style={{
            flex: 1,
            maxWidth: 360,
            marginHorizontal: 20,
          }}
        />
      )}

      <View style={s.headerRight}>
        {cartButton}

        <Pressable
          onPress={() => setMenuOpen(!menuOpen)}
          style={[
            s.avatar,
            isSmallPhone && s.avatarSmall,
            isVerySmallPhone && s.avatarTiny,
            web({ cursor: 'pointer' }),
          ]}
          accessibilityRole="button"
          accessibilityLabel="Profile menu"
          accessibilityState={{ expanded: menuOpen }}
        >
          <Text style={s.avatarText}>{initial}</Text>
        </Pressable>
      </View>

      {menuOpen && (
        <View style={s.dropdown}>
          <Text style={s.ddName}>{user.fullName}</Text>

          <Text style={s.ddEmail} numberOfLines={1}>
            {user.email}
          </Text>

          <View style={s.ddDivider} />

          <Pressable
            onPress={() => {
              setMenuOpen(false);
              onChangeTable();
            }}
            style={s.ddItem}
            accessibilityRole="button"
          >
            <Text style={s.ddText}>Change table</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setMenuOpen(false);
              onLogout();
            }}
            style={s.ddItem}
            accessibilityRole="button"
          >
            <Text style={[s.ddText, { color: C.terracotta }]}>
              Log out
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  let body;

  if (
    menu.status === 'loading' &&
    menu.products.length === 0
  ) {
    body = (
      <SkeletonGrid
        cols={cols}
        imageHeight={cardImageHeight}
      />
    );
  } else if (menu.status === 'error') {
    body = (
      <View style={s.stateBox} accessibilityRole="alert">
        <Text style={s.stateTitle}>
          We couldn't connect to the restaurant. Please try again.
        </Text>

        <Pressable
          onPress={load}
          accessibilityRole="button"
          style={[s.stateBtn, web({ cursor: 'pointer' })]}
        >
          <Text style={s.stateBtnText}>Try again</Text>
        </Pressable>
      </View>
    );
  } else if (menu.products.length === 0) {
    body = (
      <View style={s.stateBox}>
        <Text style={s.stateTitle}>
          Your menu is currently empty.
        </Text>

        <Text style={s.stateText}>
          Dishes will appear here as soon as they are added.
        </Text>
      </View>
    );
  } else if (visible.length === 0) {
    body = searching ? (
      <View style={s.stateBox}>
        <Text style={s.stateTitle}>
          No dishes match "{query.trim()}"
        </Text>

        <Text style={s.stateText}>
          Try a different dish name, ingredient or category.
        </Text>

        <Pressable
          onPress={() => setQuery('')}
          accessibilityRole="button"
          style={[s.stateBtn, web({ cursor: 'pointer' })]}
        >
          <Text style={s.stateBtnText}>Clear search</Text>
        </Pressable>
      </View>
    ) : (
      <View style={s.stateBox}>
        <Text style={s.stateTitle}>
          Nothing here just yet
        </Text>

        <Text style={s.stateText}>
          This category has no dishes at the moment. Please check back soon.
        </Text>
      </View>
    );
  } else {
    body = (
      <View
        style={[
          s.grid,
          layout !== 'mobile' && {
            marginHorizontal: -10,
          },
        ]}
      >
        {visible.map((p) => (
          <View
            key={p.id}
            style={[
              s.cell,
              {
                width: `${100 / cols}%`,
                paddingHorizontal: layout === 'mobile' ? 0 : 10,
              },
            ]}
          >
            <DishCard
              p={p}
              categoryName={catName.get(p.categoryId) || ''}
              onOpen={setSelected}
              onAdd={addToCart}
              layout={layout}
              imageHeight={cardImageHeight}
            />
          </View>
        ))}
      </View>
    );
  }

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
          accessibilityLabel="Close profile menu"
        />
      )}

      {header}

      <ScrollView
        style={s.mainScroll}
        contentContainerStyle={[
          s.scroll,
          {
            paddingHorizontal: sidePad,
            paddingBottom: showStickyBar ? 120 : 56,
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
          <View style={[s.intro, layout === 'mobile' && s.introMobile]}>
            <Text style={s.welcome}>Welcome, {first}</Text>

            <Text
              style={[
                s.title,
                layout === 'mobile' && {
                  fontSize: isVerySmallPhone ? 27 : isSmallPhone ? 29 : 32,
                },
                layout === 'tablet' && { fontSize: 38 },
                layout === 'desktop' && { fontSize: 50 },
              ]}
              accessibilityRole="header"
            >
              Discover Our Menu
            </Text>

            <Text
              style={[
                s.subtitle,
                layout === 'mobile' && s.subtitleMobile,
              ]}
            >
              Carefully prepared dishes, made to make every moment memorable.
            </Text>

            <View style={s.tablePill}>
              <Text style={s.tablePillText}>
                Dining at Table {pad(table.id)}
              </Text>
            </View>
          </View>

          {layout !== 'desktop' && (
            <SearchBar
              value={query}
              onChange={setQuery}
              style={s.mobileSearch}
            />
          )}

          {featured &&
            !searching &&
            menu.status === 'ready' && (
              <Featured
                p={featured}
                categoryName={catName.get(featured.categoryId) || ''}
                layout={layout}
                onOpen={setSelected}
                onAdd={addToCart}
                imageHeight={featuredImageHeight}
              />
            )}

          <View
            style={s.categorySection}
            accessibilityRole="tablist"
          >
            {layout === 'desktop' ? (
              <View style={s.categoryDesktop}>
                {chips.map((c) => (
                  <CategoryChip
                    key={c.id}
                    label={c.name}
                    selected={!searching && categoryId === c.id}
                    onPress={() => {
                      setQuery('');
                      setCategoryId(c.id);
                    }}
                  />
                ))}
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={s.categoryHorizontal}
              >
                {chips.map((c) => (
                  <CategoryChip
                    key={c.id}
                    label={c.name}
                    selected={!searching && categoryId === c.id}
                    onPress={() => {
                      setQuery('');
                      setCategoryId(c.id);
                    }}
                  />
                ))}
              </ScrollView>
            )}
          </View>

          <Text
            style={s.resultLine}
            accessibilityLiveRegion="polite"
          >
            {menu.status !== 'ready'
              ? ' '
              : searching
                ? `${visible.length} ${visible.length === 1 ? 'result' : 'results'} for "${query.trim()}"`
                : `${visible.length} ${visible.length === 1 ? 'dish' : 'dishes'}`}
          </Text>

          {body}

          <Text style={s.legal}>
            Menu details shown are sample information until confirmed by the restaurant. If you have a serious allergy, please speak with our staff before ordering.
          </Text>
        </Animated.View>
      </ScrollView>

      {showStickyBar && (
        <Pressable
          onPress={() => setCartOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`View cart, ${totals.itemCount} items, ${formatPrice(totals.totalCents)}`}
          style={[
            s.sticky,
            isSmallPhone && s.stickySmall,
            web({ cursor: 'pointer' }),
          ]}
        >
          <Text style={s.stickyText}>
            View cart ({totals.itemCount})
          </Text>

          <Text style={s.stickyText}>
            {formatPrice(totals.totalCents)}
          </Text>
        </Pressable>
      )}

      <Toast
        toast={toast}
        bottom={showStickyBar ? 92 : 28}
      />

      {selected && (
        <ProductModal
          key={selected.id}
          product={selected}
          categoryName={catName.get(selected.categoryId) || ''}
          layout={layout}
          onClose={() => setSelected(null)}
          onAdd={(p, qty, notes) => {
            addToCart(p, qty, notes);
            setSelected(null);
          }}
        />
      )}

      {cartOpen && (
        <CartDrawer
          cart={cart}
          table={table}
          layout={layout}
          dispatch={dispatch}
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false);
            onCheckout();
          }}
        />
      )}

      {/* Floating chatbot launcher */}
      {!chatOpen && (
        <Pressable
          onPress={() => setChatOpen(true)}
          style={[
            s.chatLauncher,
            showStickyBar && s.chatLauncherAboveCart,
            web({
              cursor: 'pointer',
              transitionDuration: '180ms',
            }),
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open restaurant assistant"
        >
          <Text style={s.chatLauncherIcon}>✦</Text>

          {layout !== 'mobile' && (
            <Text style={s.chatLauncherText}>
              Ask our assistant
            </Text>
          )}
        </Pressable>
      )}

      {/* Chatbot window */}
      <Modal
        visible={chatOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setChatOpen(false)}
        statusBarTranslucent
      >
        <View style={s.chatModalRoot}>
          <Chatbot
            visible={chatOpen}
            onClose={() => setChatOpen(false)}
            products={menu.products}
            onAdd={addToCart}
            layout={layout}
            width={width}
            height={height}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ---------- styles ----------
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.cream,
  },

  mainScroll: {
    flex: 1,
    minWidth: 0,
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },

  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 16,
  },

  page: {
    width: '100%',
    maxWidth: 1240,
    minWidth: 0,
    alignSelf: 'center',
  },

  // Header
  header: {
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.beige,
    backgroundColor: C.cream,
  },

  headerMobile: {
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  headerSmall: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },

  headerTiny: {
    paddingHorizontal: 8,
    paddingVertical: 9,
  },

  brandBlock: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    marginRight: 8,
  },

  wordmark: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 23,
    color: C.espresso,
  },

  wordmarkSmall: {
    fontSize: 19,
  },

  wordmarkTiny: {
    fontSize: 17,
  },

  wordmarkSub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10.5,
    color: C.gold,
    letterSpacing: 2.2,
  },

  headerTable: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 13.5,
    color: '#7A6A5C',
    marginTop: 2,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },

  cartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.beige,
    backgroundColor: '#FBF8F2',
    marginRight: 10,
  },

  cartBtnSmall: {
    height: 38,
    paddingHorizontal: 10,
    marginRight: 7,
  },

  cartBtnTiny: {
    height: 36,
    paddingHorizontal: 8,
    marginRight: 6,
  },

  cartText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: C.espresso,
  },

  badgeCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.espresso,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },

  badgeCountText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: C.cream,
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

  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  avatarTiny: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },

  avatarText: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
    color: C.espresso,
  },

  dropdown: {
    position: 'absolute',
    top: 62,
    right: 12,
    width: 220,
    maxWidth: '90%',
    backgroundColor: C.cream,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.beige,
    padding: 14,
    shadowColor: C.espresso,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 10,
  },

  ddName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: C.espresso,
  },

  ddEmail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: '#7A6A5C',
    marginTop: 2,
  },

  ddDivider: {
    height: 1,
    backgroundColor: C.beige,
    marginVertical: 10,
  },

  ddItem: {
    paddingVertical: 7,
  },

  ddText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: C.espresso,
  },

  // Intro
  intro: {
    marginBottom: 22,
  },

  introMobile: {
    marginBottom: 18,
  },

  welcome: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    letterSpacing: 1.5,
    color: C.gold,
    textTransform: 'uppercase',
  },

  title: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 40,
    color: C.espresso,
    marginTop: 6,
  },

  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 25,
    color: '#6F6258',
    marginTop: 8,
    maxWidth: 520,
  },

  subtitleMobile: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },

  tablePill: {
    alignSelf: 'flex-start',
    marginTop: 14,
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#F0E6D8',
  },

  tablePillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: C.espresso,
  },

  // Search
  mobileSearch: {
    marginBottom: 18,
    width: '100%',
  },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderWidth: 1.5,
    borderColor: C.beige,
    borderRadius: 14,
    backgroundColor: '#FBF8F2',
    paddingHorizontal: 14,
    minWidth: 0,
  },

  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    fontFamily: 'Inter_400Regular',
    fontSize: 14.5,
    color: C.espresso,
    ...(Platform.OS === 'web'
      ? { outlineStyle: 'none' }
      : null),
  },

  clear: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#7A6A5C',
    paddingLeft: 10,
  },

  // Featured
  featured: {
    backgroundColor: '#FBF8F2',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.beige,
    overflow: 'hidden',
    width: '100%',
    minWidth: 0,
  },

  featuredRow: {
    flexDirection: 'row',
  },

  featuredImageDesktop: {
    flex: 1.1,
    minWidth: 0,
    minHeight: 220,
    maxHeight: 300,
    overflow: 'hidden',
  },

  featuredImagePressableMobile: {
    width: '100%',
    height: 120,
    overflow: 'hidden',
  },

  featuredImageRow: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: 220,
    maxHeight: 300,
  },

  featuredImageMobile: {
    width: '100%',
    height: 120,
    aspectRatio: undefined,
  },

  featuredBody: {
    padding: 24,
    justifyContent: 'center',
    minWidth: 0,
    flexShrink: 1,
  },

  featuredBodyRow: {
    flex: 1,
  },

  featuredBodyMobile: {
    padding: 14,
    paddingTop: 13,
  },

  badge: {
    alignSelf: 'flex-start',
    backgroundColor: C.espresso,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },

  badgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11.5,
    letterSpacing: 1.2,
    color: C.gold,
    textTransform: 'uppercase',
  },

  featuredCat: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12.5,
    color: C.gold,
  },

  featuredName: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 30,
    color: C.espresso,
    marginTop: 4,
  },

  featuredNameMobile: {
    fontSize: 22,
  },

  featuredDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#5C5148',
    marginTop: 7,
  },

  featuredPrice: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    color: C.espresso,
    marginVertical: 11,
  },

  featuredActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },

  featuredAdd: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginBottom: 8,
  },

  featuredMore: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  featuredMoreText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: C.espresso,
  },

  // Categories
  categorySection: {
    marginTop: 28,
    marginBottom: 6,
    minWidth: 0,
  },

  categoryPressable: {
    marginRight: 7,
    marginBottom: 8,
    flexShrink: 0,
  },

  categoryDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  categoryHorizontal: {
    paddingRight: 12,
    flexGrow: 0,
  },

  chip: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
  },

  chipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },

  chipBar: {
    position: 'absolute',
    bottom: 4,
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: C.gold,
  },

  resultLine: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#7A6A5C',
    marginBottom: 14,
  },

  // Product grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    minWidth: 0,
  },

  cell: {
    marginBottom: 20,
    minWidth: 0,
  },

  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.beige,
    overflow: 'hidden',
    shadowColor: C.espresso,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  imageWrapper: {
    width: '100%',
    height: 'auto',
    overflow: 'hidden',
    flexShrink: 0,
  },

  cardImg: {
    width: '100%',
    aspectRatio: undefined,
    flexGrow: 0,
    flexShrink: 0,
  },

  unavailBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: C.espresso,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '90%',
  },

  unavailText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: C.cream,
  },

  cardBody: {
    padding: 16,
    paddingBottom: 6,
    minWidth: 0,
  },

  cardBodyMobile: {
    padding: 12,
    paddingBottom: 5,
    minWidth: 0,
  },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },

  cat: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: C.gold,
    flexShrink: 1,
  },

  prep: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#7A6A5C',
  },

  dishName: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 20,
    color: C.espresso,
    marginTop: 4,
  },

  dishNameMobile: {
    fontSize: 18,
  },

  dishDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: '#6F6258',
    marginTop: 5,
    minHeight: 38,
  },

  allergenLine: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 17,
    color: '#5C5148',
    marginTop: 8,
    minHeight: 34,
  },

  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    padding: 16,
    paddingTop: 8,
    gap: 10,
  },

  cardFootMobile: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 7,
    gap: 8,
  },

  priceBlock: {
    flexShrink: 0,
  },

  cardPrice: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: C.espresso,
  },

  avail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: C.success,
    marginTop: 1,
  },

  addBtn: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },

  addBtnMobile: {
    minWidth: 105,
    minHeight: 40,
    flexGrow: 1,
    paddingHorizontal: 10,
  },

  addOff: {
    backgroundColor: C.beige,
  },

  addText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: C.espresso,
  },

  // Skeleton
  skeletonBody: {
    padding: 14,
  },

  // States
  stateBox: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 16,
  },

  stateTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 22,
    color: C.espresso,
    textAlign: 'center',
  },

  stateText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14.5,
    color: '#6F6258',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 380,
  },

  stateBtn: {
    marginTop: 18,
    borderWidth: 1.5,
    borderColor: C.gold,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },

  stateBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14.5,
    color: C.espresso,
  },

  legal: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#8A7E72',
    textAlign: 'center',
    marginTop: 24,
  },

  // Sticky cart
  sticky: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: C.espresso,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 8,
  },

  stickySmall: {
    left: 12,
    right: 12,
    bottom: 12,
    paddingHorizontal: 14,
  },

  stickyText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15.5,
    color: C.cream,
  },

  // Toast
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '90%',
    backgroundColor: C.espresso,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    zIndex: 40,
  },

  toastText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: C.cream,
    textAlign: 'center',
  },

  // Chat launcher
  chatLauncher: {
    position: 'absolute',
    right: 20,
    bottom: 22,
    minHeight: 58,
    minWidth: 58,
    paddingHorizontal: 17,
    borderRadius: 30,
    backgroundColor: C.espresso,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 9,
    zIndex: 50,
  },

  chatLauncherAboveCart: {
    bottom: 88,
  },

  chatLauncherIcon: {
    fontSize: 23,
    color: C.gold,
    marginRight: 8,
  },

  chatLauncherText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: C.cream,
  },

  // Chat modal
  chatModalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  chatBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(31, 23, 17, 0.48)',
  },

  chatKeyboardContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },

  chatWindow: {
    backgroundColor: '#FBF8F2',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.beige,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 22,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 15,
  },

  chatHeader: {
    minHeight: 76,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: C.espresso,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  chatHeaderAvatar: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: '#F0E6D8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  chatHeaderAvatarText: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 21,
    color: C.espresso,
  },

  chatHeaderText: {
    flex: 1,
  },

  chatTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: C.cream,
  },

  chatOnlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  chatOnlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#9BC49A',
    marginRight: 6,
  },

  chatOnlineText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11.5,
    color: '#D7C7B4',
  },

  chatCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  chatCloseText: {
    color: C.cream,
    fontSize: 18,
  },

  chatIntro: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EADFCE',
  },

  chatIntroTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 19,
    color: C.espresso,
  },

  chatIntroSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: '#7A6A5C',
    marginTop: 3,
  },

  chatMessagesScroll: {
    flex: 1,
    minHeight: 0,
  },

  chatMessagesContent: {
    padding: 15,
    paddingBottom: 20,
  },

  chatMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 13,
  },

  chatMessageRowUser: {
    justifyContent: 'flex-end',
  },

  chatBotAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EDE1D1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 3,
    flexShrink: 0,
  },

  chatBotAvatarText: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 14,
    color: C.espresso,
  },

  chatBubble: {
    maxWidth: '84%',
    borderRadius: 17,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },

  chatAssistantBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EADFCE',
    borderBottomLeftRadius: 5,
  },

  chatUserBubble: {
    backgroundColor: C.espresso,
    borderBottomRightRadius: 5,
  },

  chatMessageText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: '#4E4238',
  },

  chatUserText: {
    color: '#FFFFFF',
  },

  chatRecommendations: {
    marginTop: 13,
    width: '100%',
  },

  chatRecommendationHeading: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: C.espresso,
    marginBottom: 8,
  },

  chatProductCard: {
    backgroundColor: '#FBF8F2',
    borderWidth: 1,
    borderColor: '#EADFCE',
    borderRadius: 12,
    padding: 10,
    marginTop: 7,
  },

  chatProductInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },

  chatProductName: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: C.espresso,
  },

  chatProductPrice: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: C.gold,
  },

  chatAddButton: {
    minHeight: 34,
    backgroundColor: C.gold,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  chatAddButtonDisabled: {
    backgroundColor: C.beige,
  },

  chatAddButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: C.espresso,
  },

  chatLoadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },

  chatTypingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EADFCE',
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },

  chatTypingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#7A6A5C',
    marginLeft: 8,
  },

  chatSuggestions: {
    paddingHorizontal: 15,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#EADFCE',
  },

  chatSuggestionsTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.1,
    color: '#8A7E72',
    marginBottom: 9,
  },

  chatSuggestionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },

  chatSuggestion: {
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },

  chatSuggestionText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11.5,
    color: C.espresso,
  },

  chatInputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 13,
    marginTop: 8,
    marginBottom: 7,
    paddingLeft: 13,
    paddingRight: 6,
    minHeight: 48,
    maxHeight: 100,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3D6C5',
    borderRadius: 15,
  },

  chatInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 86,
    paddingTop: 11,
    paddingBottom: 9,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: C.espresso,
    ...(Platform.OS === 'web'
      ? { outlineStyle: 'none' }
      : null),
  },

  chatSendButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.espresso,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 7,
  },

  chatSendButtonDisabled: {
    backgroundColor: '#C9BDAE',
  },

  chatSendText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    color: '#FFFFFF',
    lineHeight: 25,
  },

  chatDisclaimer: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9.5,
    lineHeight: 14,
    color: '#8A7E72',
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
});