
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  getDb,
  updateAdminOrderStatus,
  saveAdminProduct,
  deleteAdminProduct,
  getAdminCategories,
  saveAdminCategory,
  setAdminCategoryActive,
  saveAdminTable,
  setAdminTableStatus,
  deleteAdminTable,
  setProductAvailability,
} from './db';

import { C } from './theme';

const TABS = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'orders', label: 'Orders', icon: '▤' },
  { id: 'menu', label: 'Menu', icon: '♨' },
  { id: 'ingredients', label: 'Ingredients', icon: '◈' },
  { id: 'tables', label: 'Tables', icon: '▧' },
];

const FILTERS = [
  'all',
  'pending',
  'preparing',
  'ready',
  'completed',
  'cancelled',
];

const money = (cents = 0) =>
  `€${(Number(cents || 0) / 100).toFixed(2)}`;

const parseJson = (value, fallback = []) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const formatDate = (value) => {
  if (!value) return 'Unknown date';

  const date = new Date(
    value.includes('T') ? value : value.replace(' ', 'T') + 'Z'
  );

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
};

const statusColor = (status) => {
  switch (String(status || '').toLowerCase()) {
    case 'available':
    case 'completed':
    case 'ready':
      return C.success;

    case 'pending':
    case 'held':
    case 'preparing':
      return C.gold;

    case 'cancelled':
    case 'occupied':
      return C.terracotta;

    default:
      return '#8B8178';
  }
};

function Badge({ value }) {
  const color = statusColor(value);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${color}18`,
          borderColor: `${color}55`,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>
        {String(value || 'unknown').toUpperCase()}
      </Text>
    </View>
  );
}

function ActionButton({ title, onPress, color, disabled }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: color || C.espresso },
        pressed && styles.actionButtonPressed,
        disabled && styles.disabledButton,
      ]}
    >
      <Text style={styles.actionButtonText}>{title}</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <TextInput
        value={String(value ?? '')}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor="#A69A8E"
        style={[
          styles.input,
          multiline && styles.multilineInput,
        ]}
        multiline={multiline}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="sentences"
        autoCorrect={false}
      />
    </View>
  );
}

function EditorModal({
  visible,
  title,
  children,
  onClose,
  onSave,
  saving,
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalEyebrow}>MANAGEMENT</Text>
              <Text style={styles.modalTitle}>{title}</Text>
            </View>

            <Pressable
              onPress={onClose}
              disabled={saving}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalContent}
          >
            {children}
          </ScrollView>

          <View style={styles.modalFooter}>
            <ActionButton
              title="Cancel"
              color="#8B8178"
              onPress={onClose}
              disabled={saving}
            />

            <ActionButton
              title={saving ? 'Saving...' : 'Save changes'}
              onPress={onSave}
              disabled={saving}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function AdminDashboard({ onBack }) {
  const { width } = useWindowDimensions();

  const isPhone = width < 600;
  const isSmallPhone = width < 380;
  const isTablet = width >= 600 && width < 1000;

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [tables, setTables] = useState([]);
  const [categories, setCategories] = useState([]);

  const [orderFilter, setOrderFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [menuSearch, setMenuSearch] = useState('');
  const [expandedOrder, setExpandedOrder] = useState(null);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editorType, setEditorType] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});

  const [pendingOrderAction, setPendingOrderAction] = useState(null);
  const [orderUpdating, setOrderUpdating] = useState(false);
  const [orderActionError, setOrderActionError] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      setError('');

      const db = await getDb();

      const [orderRows, productRows, tableRows, categoryRows] =
        await Promise.all([
          db.getAllAsync(`
            SELECT
              o.id, o.order_number, o.customer_name, o.guest_names,
              o.table_id, o.status, o.payment_method,
              o.subtotal_cents, o.service_charge_cents, o.total_cents,
              o.special_instructions, o.created_at,
              t.section AS table_section,
              (
                SELECT COUNT(*) FROM order_items oi
                WHERE oi.order_id = o.id
              ) AS item_count,
              (
                SELECT group_concat(
                  product_name_snapshot || ' × ' || quantity, ', '
                )
                FROM order_items oi
                WHERE oi.order_id = o.id
              ) AS item_summary
            FROM orders o
            LEFT JOIN restaurant_tables t ON t.id = o.table_id
            ORDER BY o.id DESC
          `),

          db.getAllAsync(`
            SELECT
              p.id, p.name, p.description, p.price_cents,
              p.image_url, p.ingredients, p.allergen_info,
              p.dietary_labels, p.category_id,
              p.is_available, p.is_featured, p.prep_minutes,
              c.name AS category_name
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            ORDER BY c.display_order, p.name
          `),

          db.getAllAsync(`
            SELECT
              t.id, t.section, t.seats, t.status, t.held_by,
              (
                SELECT o.order_number
                FROM orders o
                WHERE o.table_id = t.id
                  AND o.status NOT IN ('cancelled', 'completed')
                ORDER BY o.id DESC LIMIT 1
              ) AS current_order
            FROM restaurant_tables t
            ORDER BY t.id
          `),

          getAdminCategories(),
        ]);

      setOrders(orderRows);
      setProducts(productRows);
      setTables(tableRows);
      setCategories(categoryRows);
    } catch (e) {
      console.error('Admin dashboard loading error:', e);
      setError('Could not load dashboard data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const refresh = () => {
    if (refreshing) return;

    setRefreshing(true);
    loadDashboard();
  };

  const stats = useMemo(() => ({
    totalOrders: orders.length,
    pendingOrders: orders.filter((o) => o.status === 'pending').length,

    revenue: orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.total_cents || 0), 0),

    totalProducts: products.length,

    availableProducts: products.filter(
      (p) => Number(p.is_available) === 1
    ).length,

    totalTables: tables.length,

    availableTables: tables.filter(
      (t) => t.status === 'available'
    ).length,

    heldTables: tables.filter(
      (t) => t.status === 'held'
    ).length,

    occupiedTables: tables.filter(
      (t) => t.status === 'occupied'
    ).length,
  }), [orders, products, tables]);

  const filteredOrders = useMemo(() => {
    const search = orderSearch.toLowerCase().trim();

    return orders.filter((order) => {
      const statusMatches =
        orderFilter === 'all' || order.status === orderFilter;

      const searchable = [
        order.order_number,
        order.customer_name,
        order.table_id,
        order.payment_method,
        order.status,
        order.item_summary,
        parseJson(order.guest_names, []).join(' '),
      ].join(' ').toLowerCase();

      return statusMatches && searchable.includes(search);
    });
  }, [orders, orderFilter, orderSearch]);

  const filteredProducts = useMemo(() => {
    const search = menuSearch.toLowerCase().trim();

    return products.filter((product) =>
      [
        product.name,
        product.description,
        product.category_name,
        product.ingredients,
      ].join(' ').toLowerCase().includes(search)
    );
  }, [products, menuSearch]);

  const ingredients = useMemo(() => {
    const result = {};

    products.forEach((product) => {
      const list = parseJson(product.ingredients, []);

      if (!Array.isArray(list)) return;

      list.forEach((item) => {
        const name = typeof item === 'string'
          ? item.trim()
          : String(
              item?.name ||
              item?.ingredient ||
              item?.label ||
              ''
            ).trim();

        if (!name) return;

        const key = name.toLowerCase();

        if (!result[key]) {
          result[key] = { name, dishes: [] };
        }

        if (!result[key].dishes.includes(product.name)) {
          result[key].dishes.push(product.name);
        }
      });
    });

    return Object.values(result).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [products]);

  const openEditor = (type, item = null) => {
    setEditorType(type);
    setEditingId(item?.id ?? null);

    if (type === 'product') {
      setForm(item ? {
        name: item.name,
        description: item.description,
        price: (Number(item.price_cents) / 100).toFixed(2),
        imageUrl: item.image_url || '',
        categoryId: String(item.category_id || ''),

        ingredients: parseJson(item.ingredients, []).map(
          (x) => typeof x === 'string' ? x : x.name
        ).join(', '),

        allergenInfo: parseJson(item.allergen_info, []).join(', '),
        dietary: parseJson(item.dietary_labels, []).join(', '),
        prepMinutes: String(item.prep_minutes || 10),
        available: Number(item.is_available) === 1,
        featured: Number(item.is_featured) === 1,
      } : {
        name: '',
        description: '',
        price: '',
        imageUrl: '',
        categoryId: categories[0]
          ? String(categories[0].id)
          : '',
        ingredients: '',
        allergenInfo: '',
        dietary: '',
        prepMinutes: '10',
        available: true,
        featured: false,
      });
    } else if (type === 'table') {
      setForm(item ? {
        id: String(item.id),
        section: item.section,
        seats: String(item.seats),
        status: item.status,
      } : {
        id: '',
        section: 'Main Dining Area',
        seats: '4',
        status: 'available',
        isNew: true,
      });
    } else if (type === 'category') {
      setForm(item ? {
        name: item.name,
        description: item.description || '',
      } : {
        name: '',
        description: '',
      });
    }

    setEditorVisible(true);
  };

  const closeEditor = () => {
    if (saving) return;

    setEditorVisible(false);
    setEditorType('');
    setEditingId(null);
  };

  const saveEditor = async () => {
    if (saving) return;

    setSaving(true);

    try {
      let result;

      if (editorType === 'product') {
        const price = Number(form.price);

        if (!form.name?.trim()) {
          Alert.alert('Missing name', 'Enter a dish name.');
          return;
        }

        if (!Number.isFinite(price) || price < 0) {
          Alert.alert('Invalid price', 'Enter a valid price.');
          return;
        }

        result = await saveAdminProduct({
          id: editingId,
          name: form.name,
          description: form.description,
          priceCents: Math.round(price * 100),
          imageUrl: form.imageUrl,
          categoryId: Number(form.categoryId),
          ingredients: form.ingredients,
          allergenInfo: form.allergenInfo,
          dietary: form.dietary,
          prepMinutes: Number(form.prepMinutes),
          available: form.available,
          featured: form.featured,
        });
      } else if (editorType === 'table') {
        if (!Number(form.id) || !Number(form.seats)) {
          Alert.alert(
            'Invalid table',
            'Enter a valid table number and seat count.'
          );
          return;
        }

        result = await saveAdminTable({
          id: Number(form.id),
          section: form.section,
          seats: Number(form.seats),
          isNew: Boolean(form.isNew),
        });
      } else if (editorType === 'category') {
        if (!form.name?.trim()) {
          Alert.alert('Missing name', 'Enter a category name.');
          return;
        }

        result = await saveAdminCategory({
          id: editingId,
          name: form.name,
          description: form.description,
        });
      }

      if (!result?.ok) {
        Alert.alert(
          'Could not save',
          result?.error || 'Please try again.'
        );
        return;
      }

      setEditorVisible(false);

      await loadDashboard();

      Alert.alert('Saved', 'Your changes have been saved.');
    } catch (e) {
      console.error('Admin save error:', e);
      Alert.alert('Error', 'Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  };

  const changeOrderStatus = (order, status) => {
    setOrderActionError('');
    setPendingOrderAction({ order, status });
  };

  const confirmOrderStatusChange = async () => {
    if (!pendingOrderAction || orderUpdating) return;

    const { order, status } = pendingOrderAction;

    setOrderUpdating(true);
    setOrderActionError('');

    try {
      const result = await updateAdminOrderStatus(order.id, status);

      if (!result?.ok) {
        setOrderActionError(
          result?.error || 'Could not update this order.'
        );
        return;
      }

      setPendingOrderAction(null);
      setExpandedOrder(null);

      await loadDashboard();
    } catch (error) {
      console.error('Order status update error:', error);

      setOrderActionError(
        error?.message ||
        'Something went wrong while updating the order.'
      );
    } finally {
      setOrderUpdating(false);
    }
  };

  const toggleProduct = async (product) => {
    try {
      await setProductAvailability(
        product.id,
        Number(product.is_available) !== 1
      );

      await loadDashboard();
    } catch (e) {
      Alert.alert(
        'Update failed',
        'Could not update dish availability.'
      );
    }
  };

  const removeProduct = (product) => {
    Alert.alert(
      'Delete dish',
      `Are you sure you want to delete "${product.name}"? Existing order history will keep its saved item name.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAdminProduct(product.id);

            if (!result.ok) {
              Alert.alert('Could not delete', result.error);
              return;
            }

            await loadDashboard();
          },
        },
      ]
    );
  };

  const removeTable = (table) => {
    Alert.alert(
      'Delete table',
      `Delete table ${table.id}? Tables with order history cannot be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAdminTable(table.id);

            if (!result.ok) {
              Alert.alert('Could not delete', result.error);
              return;
            }

            await loadDashboard();
          },
        },
      ]
    );
  };

  const changeTableStatus = async (table, status) => {
    const result = await setAdminTableStatus(table.id, status);

    if (!result.ok) {
      Alert.alert('Table update failed', result.error);
      return;
    }

    await loadDashboard();
  };

  const setValue = (key, value) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.brand}>
          <View style={styles.brandIcon}>
            <Text style={styles.brandIconText}>A</Text>
          </View>

          <View>
            <Text style={styles.brandName}>AMANT'S</Text>
            <Text style={styles.brandSub}>
              RESTAURANT MANAGEMENT
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backText}>← Back to tables</Text>
        </Pressable>
      </View>

      <View style={[
        styles.heading,
        isPhone && styles.headingPhone,
      ]}>
        <View>
          <Text style={styles.eyebrow}>ADMINISTRATION</Text>
          <Text style={[
            styles.headerTitle,
            isSmallPhone && styles.headerTitleSmall,
          ]}>
            Dashboard
          </Text>
          <Text style={styles.headerDescription}>
            Your restaurant, all in one place.
          </Text>
        </View>

        <Pressable
          onPress={refresh}
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.refreshText}>
            {refreshing ? 'Refreshing...' : '↻ Refresh data'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.connectionRow}>
        <View style={styles.liveDot} />
        <Text style={styles.connectionText}>
          LOCAL DATABASE CONNECTED
        </Text>
        <View style={styles.connectionDivider} />
        <Text style={styles.connectionText}>
          {stats.totalOrders} TOTAL ORDERS
        </Text>
      </View>
    </View>
  );

  const renderTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabs}
      contentContainerStyle={styles.tabsContent}
    >
      {TABS.map((tab) => {
        const selected = activeTab === tab.id;

        return (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={({ pressed }) => [
              styles.tab,
              selected && styles.tabActive,
              pressed && styles.tabPressed,
            ]}
          >
            <Text style={[
              styles.tabIcon,
              selected && styles.tabTextActive,
            ]}>
              {tab.icon}
            </Text>

            <Text style={[
              styles.tabText,
              selected && styles.tabTextActive,
            ]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const renderOverview = () => {
    const cards = [
      ['▤', 'Total orders', stats.totalOrders, C.gold],
      ['◷', 'Pending orders', stats.pendingOrders, C.terracotta],
      ['€', 'Recorded revenue', money(stats.revenue), C.success],
      [
        '♨',
        'Available dishes',
        `${stats.availableProducts}/${stats.totalProducts}`,
        C.gold,
      ],
    ];

    return (
      <View>
        <Text style={styles.sectionTitle}>Restaurant overview</Text>

        <Text style={styles.subtitle}>
          Here's what's happening in your restaurant.
        </Text>

        <View style={styles.statsGrid}>
          {cards.map(([icon, label, value, accent]) => (
            <View key={label} style={styles.statCard}>
              <View style={[
                styles.statIconBox,
                { backgroundColor: `${accent}18` },
              ]}>
                <Text style={[
                  styles.statIcon,
                  { color: accent },
                ]}>
                  {icon}
                </Text>
              </View>

              <Text style={styles.statValue}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeadingRow}>
            <View style={styles.panelAccent} />
            <Text style={styles.panelTitle}>Table availability</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              Available: {stats.availableTables}
            </Text>

            <Text style={styles.summaryText}>
              Held: {stats.heldTables}
            </Text>

            <Text style={styles.summaryText}>
              Occupied: {stats.occupiedTables}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${stats.totalTables
                    ? (stats.occupiedTables / stats.totalTables) * 100
                    : 0}%`,
                },
              ]}
            />
          </View>

          <Text style={styles.progressCaption}>
            {stats.totalTables
              ? `${Math.round(
                  (stats.occupiedTables / stats.totalTables) * 100
                )}% of tables currently occupied`
              : 'No tables registered yet'}
          </Text>
        </View>

        <View style={styles.panel}>
          <View style={styles.rowBetween}>
            <Text style={styles.panelTitle}>Recent orders</Text>

            <Pressable onPress={() => setActiveTab('orders')}>
              <Text style={styles.link}>View all →</Text>
            </Pressable>
          </View>

          {orders.slice(0, 5).map((order) => (
            <Pressable
              key={order.id}
              style={styles.recentOrder}
              onPress={() => {
                setExpandedOrder(order.id);
                setActiveTab('orders');
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.orderNumber}>
                  {order.order_number}
                </Text>

                <Text style={styles.smallText}>
                  {order.customer_name} · Table {order.table_id}
                </Text>
              </View>

              <View style={styles.alignEnd}>
                <Text style={styles.orderTotal}>
                  {money(order.total_cents)}
                </Text>
                <Badge value={order.status} />
              </View>
            </Pressable>
          ))}

          {!orders.length && (
            <Text style={styles.emptyText}>No orders yet.</Text>
          )}
        </View>
      </View>
    );
  };

  const renderOrderActions = (order) => {
    const status = order.status;

    if (status === 'pending') {
      return (
        <View style={styles.actionRow}>
          <ActionButton
            title="✓ Accept order"
            color={C.success}
            onPress={() => changeOrderStatus(order, 'preparing')}
          />

          <ActionButton
            title="✕ Reject"
            color={C.terracotta}
            onPress={() => changeOrderStatus(order, 'cancelled')}
          />
        </View>
      );
    }

    if (status === 'preparing') {
      return (
        <View style={styles.actionRow}>
          <ActionButton
            title="Mark as ready"
            color={C.success}
            onPress={() => changeOrderStatus(order, 'ready')}
          />

          <ActionButton
            title="Cancel order"
            color={C.terracotta}
            onPress={() => changeOrderStatus(order, 'cancelled')}
          />
        </View>
      );
    }

    if (status === 'ready') {
      return (
        <View style={styles.actionRow}>
          <ActionButton
            title="Complete order"
            color={C.success}
            onPress={() => changeOrderStatus(order, 'completed')}
          />

          <ActionButton
            title="Cancel order"
            color={C.terracotta}
            onPress={() => changeOrderStatus(order, 'cancelled')}
          />
        </View>
      );
    }

    return (
      <Text style={styles.closedOrderText}>
        This order is {status}.
      </Text>
    );
  };

  const renderOrders = () => (
    <View>
      <Text style={styles.sectionTitle}>Order management</Text>

      <Text style={styles.subtitle}>
        Accept, reject and manage customer orders.
      </Text>

      <View style={styles.searchWrapper}>
        <Text style={styles.searchIcon}>⌕</Text>

        <TextInput
          value={orderSearch}
          onChangeText={setOrderSearch}
          placeholder="Search orders, customers or dishes..."
          placeholderTextColor="#A69A8E"
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((filter) => (
          <Pressable
            key={filter}
            onPress={() => setOrderFilter(filter)}
            style={[
              styles.filter,
              orderFilter === filter && styles.filterActive,
            ]}
          >
            <Text style={[
              styles.filterText,
              orderFilter === filter && styles.filterTextActive,
            ]}>
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
              {' '}
              ({filter === 'all'
                ? orders.length
                : orders.filter((o) => o.status === filter).length})
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {filteredOrders.map((order) => {
        const expanded = expandedOrder === order.id;
        const guests = parseJson(order.guest_names, []);

        return (
          <View key={order.id} style={styles.card}>
            <Pressable
              onPress={() =>
                setExpandedOrder(expanded ? null : order.id)
              }
            >
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderNumber}>
                    {order.order_number}
                  </Text>

                  <Text style={styles.smallText}>
                    {formatDate(order.created_at)}
                  </Text>
                </View>

                <View style={styles.alignEnd}>
                  <Badge value={order.status} />

                  <Text style={styles.expandText}>
                    {expanded ? '−' : '+'}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.label}>CUSTOMER</Text>
                  <Text style={styles.value}>
                    {order.customer_name || 'Guest'}
                  </Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.label}>TABLE</Text>
                  <Text style={styles.value}>#{order.table_id}</Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.label}>PAYMENT</Text>
                  <Text style={styles.value}>
                    {String(
                      order.payment_method || 'cash'
                    ).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.label}>ITEMS</Text>
                  <Text style={styles.value}>
                    {order.item_count || 0}
                  </Text>
                </View>
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.label}>ORDER TOTAL</Text>

                <Text style={styles.orderTotal}>
                  {money(order.total_cents)}
                </Text>
              </View>
            </Pressable>

            {expanded && (
              <View style={styles.expanded}>
                {!!guests.length && (
                  <Text style={styles.detailLine}>
                    Guests: {guests.join(', ')}
                  </Text>
                )}

                <Text style={styles.label}>ORDER ITEMS</Text>

                <Text style={styles.detailLine}>
                  {order.item_summary || 'No item details'}
                </Text>

                <View style={styles.divider} />

                <View style={styles.rowBetween}>
                  <Text style={styles.smallText}>Subtotal</Text>
                  <Text style={styles.value}>
                    {money(order.subtotal_cents)}
                  </Text>
                </View>

                <View style={styles.rowBetween}>
                  <Text style={styles.smallText}>Service charge</Text>
                  <Text style={styles.value}>
                    {money(order.service_charge_cents)}
                  </Text>
                </View>

                <View style={styles.rowBetween}>
                  <Text style={styles.value}>Total</Text>
                  <Text style={styles.orderTotal}>
                    {money(order.total_cents)}
                  </Text>
                </View>

                {!!order.special_instructions && (
                  <View style={styles.noteBox}>
                    <Text style={styles.label}>
                      CUSTOMER INSTRUCTIONS
                    </Text>

                    <Text style={styles.detailLine}>
                      {order.special_instructions}
                    </Text>
                  </View>
                )}

                <View style={styles.divider} />

                {renderOrderActions(order)}
              </View>
            )}
          </View>
        );
      })}

      {!filteredOrders.length && (
        <Text style={styles.emptyText}>
          No matching orders found.
        </Text>
      )}
    </View>
  );

  const renderMenu = () => (
    <View>
      <Text style={styles.sectionTitle}>Menu management</Text>

      <Text style={styles.subtitle}>
        Add, edit, remove and control your dishes.
      </Text>

      <View style={styles.actionRow}>
        <ActionButton
          title="+ Add dish"
          onPress={() => openEditor('product')}
        />

        <ActionButton
          title="+ Category"
          color={C.terracotta}
          onPress={() => openEditor('category')}
        />
      </View>

      <View style={styles.searchWrapper}>
        <Text style={styles.searchIcon}>⌕</Text>

        <TextInput
          value={menuSearch}
          onChangeText={setMenuSearch}
          placeholder="Search dishes..."
          placeholderTextColor="#A69A8E"
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Categories</Text>

        {categories.map((category) => (
          <View key={category.id} style={styles.categoryRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.value}>{category.name}</Text>

              <Text style={styles.smallText}>
                {category.description}
              </Text>

              <Text style={styles.smallText}>
                {Number(category.is_active) === 1
                  ? 'Active'
                  : 'Hidden'}
              </Text>
            </View>

            <Pressable
              onPress={() => openEditor('category', category)}
              style={styles.smallAction}
            >
              <Text style={styles.smallActionText}>Edit</Text>
            </Pressable>

            <Pressable
              onPress={async () => {
                const next = Number(category.is_active) !== 1;

                const result = await setAdminCategoryActive(
                  category.id,
                  next
                );

                if (!result.ok) {
                  Alert.alert('Error', result.error);
                } else {
                  await loadDashboard();
                }
              }}
              style={styles.smallAction}
            >
              <Text style={styles.smallActionText}>
                {Number(category.is_active) === 1 ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>

      {filteredProducts.map((product) => {
        const available = Number(product.is_available) === 1;

        return (
          <View key={product.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.productName}>
                  {product.name}
                </Text>

                <Text style={styles.smallText}>
                  {product.category_name || 'No category'}
                </Text>
              </View>

              <Badge value={available ? 'available' : 'unavailable'} />
            </View>

            <Text style={styles.detailLine}>
              {product.description}
            </Text>

            <View style={styles.productMeta}>
              <Text style={styles.orderTotal}>
                {money(product.price_cents)}
              </Text>

              <Text style={styles.smallText}>
                {product.prep_minutes} min preparation
              </Text>
            </View>

            <View style={styles.actionRow}>
              <ActionButton
                title="Edit dish"
                onPress={() => openEditor('product', product)}
              />

              <ActionButton
                title={available ? 'Disable' : 'Enable'}
                color={available ? C.terracotta : C.success}
                onPress={() => toggleProduct(product)}
              />

              <ActionButton
                title="Delete"
                color="#8B8178"
                onPress={() => removeProduct(product)}
              />
            </View>
          </View>
        );
      })}

      {!filteredProducts.length && (
        <Text style={styles.emptyText}>No dishes found.</Text>
      )}
    </View>
  );

  const renderIngredients = () => (
    <View>
      <Text style={styles.sectionTitle}>Ingredients</Text>

      <Text style={styles.subtitle}>
        Ingredients are extracted from your saved product recipes.
      </Text>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Inventory information</Text>

        <Text style={styles.noticeText}>
          Inventory quantities and supplier tracking are not configured yet.
          Editing an ingredient is done through the dish recipe in Menu.
        </Text>
      </View>

      {ingredients.map((ingredient) => (
        <View key={ingredient.name} style={styles.card}>
          <Text style={styles.productName}>
            {ingredient.name}
          </Text>

          <Text style={styles.smallText}>
            Used in {ingredient.dishes.length}{' '}
            {ingredient.dishes.length === 1 ? 'dish' : 'dishes'}
          </Text>

          <Text style={styles.detailLine}>
            {ingredient.dishes.join(', ')}
          </Text>
        </View>
      ))}

      {!ingredients.length && (
        <Text style={styles.emptyText}>
          No ingredients found in your recipes.
        </Text>
      )}
    </View>
  );

  const renderTables = () => (
    <View>
      <Text style={styles.sectionTitle}>Restaurant tables</Text>

      <Text style={styles.subtitle}>
        Edit seating, sections and table availability.
      </Text>

      <View style={styles.actionRow}>
        <ActionButton
          title="+ Add table"
          onPress={() => openEditor('table')}
        />
      </View>

      {tables.map((table) => (
        <View key={table.id} style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>
                TABLE {String(table.id).padStart(2, '0')}
              </Text>

              <Text style={styles.smallText}>
                {table.section}
              </Text>

              <Text style={styles.smallText}>
                {table.seats} seats
              </Text>
            </View>

            <Badge value={table.status} />
          </View>

          {!!table.current_order && (
            <Text style={styles.detailLine}>
              Current order: {table.current_order}
            </Text>
          )}

          <View style={styles.actionRow}>
            <ActionButton
              title="Edit"
              onPress={() => openEditor('table', table)}
            />

            <ActionButton
              title="Available"
              color={C.success}
              onPress={() => changeTableStatus(table, 'available')}
            />

            <ActionButton
              title="Occupied"
              color={C.terracotta}
              onPress={() => changeTableStatus(table, 'occupied')}
            />

            <ActionButton
              title="Held"
              color={C.gold}
              onPress={() => changeTableStatus(table, 'held')}
            />

            <ActionButton
              title="Delete"
              color="#8B8178"
              onPress={() => removeTable(table)}
            />
          </View>
        </View>
      ))}

      {!tables.length && (
        <Text style={styles.emptyText}>
          No tables registered.
        </Text>
      )}
    </View>
  );

  const renderEditor = () => {
    const title = editorType === 'product'
      ? editingId ? 'Edit dish' : 'Add a dish'
      : editorType === 'table'
        ? editingId ? 'Edit table' : 'Add a table'
        : editingId ? 'Edit category' : 'Add category';

    return (
      <EditorModal
        visible={editorVisible}
        title={title}
        onClose={closeEditor}
        onSave={saveEditor}
        saving={saving}
      >
        {editorType === 'product' && (
          <>
            <Field
              label="Dish name"
              value={form.name}
              onChangeText={(v) => setValue('name', v)}
            />

            <Field
              label="Description"
              value={form.description}
              onChangeText={(v) => setValue('description', v)}
              multiline
            />

            <Field
              label="Price (€)"
              value={form.price}
              onChangeText={(v) => setValue('price', v)}
              keyboardType="decimal-pad"
            />

            <Field
              label="Image URL"
              value={form.imageUrl}
              onChangeText={(v) => setValue('imageUrl', v)}
            />

            <Field
              label="Category ID"
              value={form.categoryId}
              onChangeText={(v) => setValue('categoryId', v)}
              keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>
              AVAILABLE CATEGORIES
            </Text>

            {categories
              .filter((c) => Number(c.is_active) === 1)
              .map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setValue('categoryId', String(c.id))}
                  style={[
                    styles.choice,
                    String(form.categoryId) === String(c.id) &&
                      styles.choiceActive,
                  ]}
                >
                  <Text style={styles.choiceText}>
                    {c.name} · ID {c.id}
                  </Text>

                  {String(form.categoryId) === String(c.id) && (
                    <Text style={styles.choiceCheck}>✓</Text>
                  )}
                </Pressable>
              ))}

            <Field
              label="Ingredients (comma separated)"
              value={form.ingredients}
              onChangeText={(v) => setValue('ingredients', v)}
              multiline
            />

            <Field
              label="Allergens (comma separated)"
              value={form.allergenInfo}
              onChangeText={(v) => setValue('allergenInfo', v)}
            />

            <Field
              label="Dietary labels (comma separated)"
              value={form.dietary}
              onChangeText={(v) => setValue('dietary', v)}
            />

            <Field
              label="Preparation time (minutes)"
              value={form.prepMinutes}
              onChangeText={(v) => setValue('prepMinutes', v)}
              keyboardType="numeric"
            />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.value}>
                  Available to customers
                </Text>
                <Text style={styles.smallText}>
                  Show this dish on the menu
                </Text>
              </View>

              <Switch
                value={Boolean(form.available)}
                onValueChange={(v) => setValue('available', v)}
                trackColor={{ false: '#D8CEC3', true: C.gold }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.value}>Featured dish</Text>
                <Text style={styles.smallText}>
                  Highlight this dish
                </Text>
              </View>

              <Switch
                value={Boolean(form.featured)}
                onValueChange={(v) => setValue('featured', v)}
                trackColor={{ false: '#D8CEC3', true: C.gold }}
                thumbColor="#FFFFFF"
              />
            </View>
          </>
        )}

        {editorType === 'table' && (
          <>
            <Field
              label="Table number"
              value={form.id}
              onChangeText={(v) => setValue('id', v)}
              keyboardType="numeric"
            />

            <Field
              label="Section"
              value={form.section}
              onChangeText={(v) => setValue('section', v)}
              placeholder="e.g. Main Dining Area"
            />

            <Field
              label="Number of seats"
              value={form.seats}
              onChangeText={(v) => setValue('seats', v)}
              keyboardType="numeric"
            />

            {form.isNew && (
              <Text style={styles.infoText}>
                New tables are created as available.
              </Text>
            )}
          </>
        )}

        {editorType === 'category' && (
          <>
            <Field
              label="Category name"
              value={form.name}
              onChangeText={(v) => setValue('name', v)}
            />

            <Field
              label="Description"
              value={form.description}
              onChangeText={(v) => setValue('description', v)}
              multiline
            />
          </>
        )}
      </EditorModal>
    );
  };

  const content = () => {
    switch (activeTab) {
      case 'orders':
        return renderOrders();

      case 'menu':
        return renderMenu();

      case 'ingredients':
        return renderIngredients();

      case 'tables':
        return renderTables();

      default:
        return renderOverview();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={C.espresso}
        />

        <Text style={styles.loadingLogo}>A</Text>

        <ActivityIndicator color={C.gold} size="large" />

        <Text style={styles.loadingText}>
          Preparing your dashboard...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={C.espresso}
      />

      {renderHeader()}
      {renderTabs()}

      {!!error && (
        <Pressable onPress={refresh} style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error} Tap to retry.
          </Text>
        </Pressable>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentInner,
          isPhone && styles.contentPhone,
          isTablet && styles.contentTablet,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={C.gold}
            colors={[C.gold]}
          />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {content()}

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>
            AMANT'S RESTAURANT
          </Text>

          <Text style={styles.footerSub}>
            RESTAURANT MANAGEMENT SYSTEM
          </Text>
        </View>
      </ScrollView>

      {renderEditor()}

      <Modal
        visible={!!pendingOrderAction}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!orderUpdating) {
            setPendingOrderAction(null);
            setOrderActionError('');
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.orderConfirmModal}>
            <View style={styles.confirmIcon}>
              <Text style={styles.confirmIconText}>
                {pendingOrderAction?.status === 'cancelled' ? '!' : '✓'}
              </Text>
            </View>

            <Text style={styles.modalTitleDark}>
              {pendingOrderAction?.status === 'cancelled'
                ? 'Reject this order?'
                : 'Accept this order?'}
            </Text>

            <Text style={styles.confirmDescription}>
              Order {pendingOrderAction?.order?.order_number}
            </Text>

            <Text style={styles.confirmDescription}>
              {pendingOrderAction?.status === 'preparing'
                ? 'This order will be moved to preparation.'
                : 'This order will be cancelled.'}
            </Text>

            {!!orderActionError && (
              <Text style={styles.orderError}>
                {orderActionError}
              </Text>
            )}

            <View style={styles.actionRow}>
              <ActionButton
                title="Go back"
                color="#8B8178"
                disabled={orderUpdating}
                onPress={() => {
                  setPendingOrderAction(null);
                  setOrderActionError('');
                }}
              />

              <ActionButton
                title={
                  orderUpdating
                    ? 'Updating...'
                    : pendingOrderAction?.status === 'cancelled'
                      ? 'Confirm rejection'
                      : 'Confirm acceptance'
                }
                color={
                  pendingOrderAction?.status === 'cancelled'
                    ? C.terracotta
                    : C.success
                }
                disabled={orderUpdating}
                onPress={confirmOrderStatusChange}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.cream,
  },

  // HEADER

  header: {
    backgroundColor: C.espresso,
    paddingHorizontal: 22,
    paddingTop: 15,
    paddingBottom: 16,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },

  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },

  brandIconText: {
    color: C.espresso,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -1,
  },

  brandName: {
    color: C.cream,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 2.2,
  },

  brandSub: {
    color: C.beige,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 4,
  },

  backButton: {
    borderWidth: 1,
    borderColor: '#FFFFFF40',
    backgroundColor: '#FFFFFF0D',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 11,
  },

  backText: {
    color: C.cream,
    fontSize: 12,
    fontWeight: '800',
  },

  heading: {
    marginTop: 25,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 14,
  },

  headingPhone: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 15,
  },

  eyebrow: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.5,
  },

  headerTitle: {
    color: C.cream,
    fontSize: 37,
    fontWeight: '900',
    letterSpacing: -1.5,
    marginTop: 5,
  },

  headerTitleSmall: {
    fontSize: 32,
  },

  headerDescription: {
    color: C.beige,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 5,
  },

  refreshButton: {
    backgroundColor: '#FFFFFF18',
    borderWidth: 1,
    borderColor: '#FFFFFF35',
    borderRadius: 11,
    paddingHorizontal: 15,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },

  refreshText: {
    color: C.cream,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 9,
    borderTopWidth: 1,
    borderTopColor: '#FFFFFF25',
    marginTop: 20,
    paddingTop: 13,
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: C.success,
  },

  connectionText: {
    color: C.beige,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  connectionDivider: {
    height: 12,
    width: 1,
    backgroundColor: '#FFFFFF40',
    marginHorizontal: 3,
  },

  // NAVIGATION

  tabs: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDE4D9',
    flexGrow: 0,
  },

  tabsContent: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 9,
  },

  tab: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: C.cream,
    borderWidth: 1,
    borderColor: '#EFE6DC',
  },

  tabActive: {
    backgroundColor: C.espresso,
    borderColor: C.espresso,
  },

  tabPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  tabIcon: {
    color: C.gold,
    fontSize: 15,
    fontWeight: '900',
  },

  tabText: {
    color: C.charcoal,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  tabTextActive: {
    color: C.cream,
  },

  // MAIN CONTENT

  content: {
    flex: 1,
  },

  contentInner: {
    padding: 24,
    paddingBottom: 50,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },

  contentPhone: {
    padding: 15,
    paddingBottom: 35,
  },

  contentTablet: {
    padding: 20,
  },

  sectionTitle: {
    color: C.espresso,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.7,
    marginTop: 7,
  },

  subtitle: {
    color: '#88796B',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: 6,
    marginBottom: 19,
  },

  // STATS

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  statCard: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE4D9',
    borderRadius: 18,
    padding: 16,
    minHeight: 145,
    shadowColor: C.espresso,
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  statIconBox: {
    width: 37,
    height: 37,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statIcon: {
    fontSize: 19,
    fontWeight: '900',
  },

  statValue: {
    color: C.espresso,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.7,
    marginTop: 13,
  },

  statLabel: {
    color: C.charcoal,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },

  // PANELS

  panel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE4D9',
    borderRadius: 18,
    padding: 17,
    marginTop: 17,
    shadowColor: C.espresso,
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },

  panelHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 14,
  },

  panelAccent: {
    width: 4,
    height: 19,
    borderRadius: 5,
    backgroundColor: C.gold,
  },

  panelTitle: {
    color: C.espresso,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },

  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 9,
  },

  summaryText: {
    color: C.charcoal,
    fontSize: 11,
    fontWeight: '700',
  },

  progressTrack: {
    height: 9,
    backgroundColor: C.cream,
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 15,
  },

  progressFill: {
    height: '100%',
    backgroundColor: C.success,
    borderRadius: 20,
  },

  progressCaption: {
    color: '#938577',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 8,
  },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },

  recentOrder: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0E9E0',
    paddingVertical: 14,
    gap: 10,
  },

  alignEnd: {
    alignItems: 'flex-end',
    gap: 7,
  },

  link: {
    color: C.terracotta,
    fontSize: 11,
    fontWeight: '900',
  },

  // ORDER INFORMATION

  orderNumber: {
    color: C.espresso,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.1,
  },

  orderTotal: {
    color: C.espresso,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },

  smallText: {
    color: '#938577',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 5,
    lineHeight: 17,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 5,
  },

  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // SEARCH

  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DED2',
    borderRadius: 13,
    paddingHorizontal: 13,
    marginBottom: 14,
    minHeight: 49,
  },

  searchIcon: {
    color: C.gold,
    fontSize: 24,
    marginRight: 8,
  },

  search: {
    flex: 1,
    paddingVertical: 12,
    color: C.espresso,
    fontSize: 13,
    fontWeight: '500',
  },

  // FILTERS

  filterRow: {
    gap: 8,
    paddingBottom: 15,
  },

  filter: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DED2',
  },

  filterActive: {
    backgroundColor: C.espresso,
    borderColor: C.espresso,
  },

  filterText: {
    color: C.charcoal,
    fontSize: 10,
    fontWeight: '800',
  },

  filterTextActive: {
    color: C.cream,
  },

  // CARDS

  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE4D9',
    borderRadius: 17,
    padding: 16,
    marginBottom: 13,
    shadowColor: C.espresso,
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  divider: {
    height: 1,
    backgroundColor: '#F0E9E0',
    marginVertical: 13,
  },

  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    marginBottom: 15,
  },

  detailItem: {
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 0,
  },

  label: {
    color: '#9A8A79',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
  },

  value: {
    color: C.espresso,
    fontSize: 12,
    fontWeight: '800',
  },

  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  expandText: {
    color: C.gold,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },

  expanded: {
    borderTopWidth: 1,
    borderTopColor: '#F0E9E0',
    marginTop: 13,
    paddingTop: 13,
  },

  detailLine: {
    color: C.charcoal,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 11,
    fontWeight: '500',
  },

  noteBox: {
    backgroundColor: C.cream,
    padding: 13,
    borderRadius: 11,
    marginTop: 11,
  },

  closedOrderText: {
    color: '#938577',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 11,
  },

  // BUTTONS

  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 13,
    alignItems: 'stretch',
  },

  actionButton: {
    flexGrow: 1,
    flexBasis: 105,
    minWidth: 90,
    minHeight: 43,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },

  disabledButton: {
    opacity: 0.45,
  },

  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.1,
  },

  // PRODUCTS AND CATEGORIES

  productName: {
    color: C.espresso,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },

  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },

  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0E9E0',
    paddingVertical: 12,
  },

  smallAction: {
    backgroundColor: C.cream,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E8DED2',
  },

  smallActionText: {
    color: C.espresso,
    fontSize: 10,
    fontWeight: '900',
  },

  // INGREDIENTS

  notice: {
    backgroundColor: '#F0E7D8',
    padding: 15,
    borderRadius: 13,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E7D8C4',
  },

  noticeTitle: {
    color: C.espresso,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 5,
  },

  noticeText: {
    color: C.charcoal,
    fontSize: 11,
    lineHeight: 18,
    fontWeight: '500',
  },

  infoText: {
    color: C.charcoal,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
  },

  // EMPTY STATES

  emptyText: {
    color: '#938577',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    padding: 28,
  },

  // FOOTER

  footer: {
    alignItems: 'center',
    paddingTop: 40,
  },

  footerBrand: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.3,
  },

  footerSub: {
    color: '#A29487',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 6,
    letterSpacing: 1.2,
  },

  // MODALS

  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    padding: 14,
  },

  modal: {
    backgroundColor: C.cream,
    borderRadius: 21,
    maxHeight: '92%',
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    overflow: 'hidden',
  },

  modalHeader: {
    backgroundColor: C.espresso,
    paddingHorizontal: 19,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  modalEyebrow: {
    color: C.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 5,
  },

  modalTitle: {
    color: C.cream,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },

  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF18',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalClose: {
    color: C.cream,
    fontSize: 18,
    fontWeight: '800',
  },

  modalContent: {
    padding: 17,
    paddingBottom: 28,
  },

  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 9,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#E8DED2',
    backgroundColor: '#FFFFFF',
  },

  field: {
    marginBottom: 15,
  },

  fieldLabel: {
    color: C.espresso,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginBottom: 8,
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DED2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: C.espresso,
    fontSize: 14,
    fontWeight: '500',
    minHeight: 48,
  },

  multilineInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },

  choice: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DED2',
    borderRadius: 11,
    padding: 13,
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  choiceActive: {
    borderColor: C.gold,
    backgroundColor: '#F3E8D4',
  },

  choiceText: {
    color: C.espresso,
    fontSize: 12,
    fontWeight: '800',
  },

  choiceCheck: {
    color: C.gold,
    fontSize: 17,
    fontWeight: '900',
  },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: '#EDE4D9',
  },

  // ORDER CONFIRMATION

  orderConfirmModal: {
    backgroundColor: C.cream,
    borderRadius: 21,
    padding: 22,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
  },

  confirmIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#F0E7D8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },

  confirmIconText: {
    color: C.gold,
    fontSize: 23,
    fontWeight: '900',
  },

  modalTitleDark: {
    color: C.espresso,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 12,
  },

  confirmDescription: {
    color: C.charcoal,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
    fontWeight: '500',
  },

  orderError: {
    color: C.error,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },

  // ERROR

  errorBox: {
    backgroundColor: '#F8E6E1',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },

  errorText: {
    color: C.error,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },

  // LOADING

  loading: {
    flex: 1,
    backgroundColor: C.espresso,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 19,
  },

  loadingLogo: {
    color: C.espresso,
    backgroundColor: C.gold,
    fontSize: 42,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 23,
    paddingVertical: 9,
    borderRadius: 18,
  },

  loadingText: {
    color: C.beige,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  pressed: {
    opacity: 0.75,
  },
});
