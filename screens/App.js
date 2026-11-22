
import React, { useReducer, useState } from 'react';
import { Alert } from 'react-native';

import TablesScreen from './TablesScreen';
import MenuScreen from './MenuScreen';
import CheckoutScreen from './CheckoutScreen';
import AdminAuth from './adminAuth';
import AdminDashboard from './AdminDashboard';

import { cartReducer, initialCart } from './cartLogic';

export default function App() {
  const [screen, setScreen] = useState('tables');
  const [selectedTable, setSelectedTable] = useState(null);
  const [user, setUser] = useState(null);

  const [cart, dispatch] = useReducer(cartReducer, initialCart);

  // TABLE SELECTION
  const handleTableContinue = (table) => {
    if (!table || !table.id) {
      Alert.alert('Table error', 'Please select and confirm a table.');
      return;
    }

    setSelectedTable(table);

    setUser({
      id: null,
      fullName: table.customerName || '',
      email: '',
      guestNames: table.guestNames || [],
    });

    setScreen('menu');
  };

  // OPEN CHECKOUT
  const handleCheckout = () => {
    if (!cart.lines || cart.lines.length === 0) {
      Alert.alert('Empty cart', 'Please add something to your cart first.');
      return;
    }

    setScreen('checkout');
  };

  // RETURN TO MENU
  const handleBackToMenu = () => {
    setScreen('menu');
  };

  // CHANGE TABLE
  const handleChangeTable = () => {
    setScreen('tables');
  };

  // ORDER SUCCESS
  const handleOrderPlaced = (order) => {
    dispatch({ type: 'clear' });
    setSelectedTable(null);
    setUser(null);
    setScreen('tables');

    Alert.alert(
      'Order placed!',
      'Your order has been successfully submitted.'
    );
  };

  // OPEN ADMIN LOGIN
  const handleOpenAdmin = () => {
    setScreen('adminAuth');
  };

  // CLOSE ADMIN LOGIN
  const handleCloseAdmin = () => {
    setScreen('tables');
  };

  // TABLE SCREEN
  if (screen === 'tables') {
    return (
      <TablesScreen
        onContinue={handleTableContinue}
        onAdminPress={handleOpenAdmin}
      />
    );
  }

  // ADMIN LOGIN SCREEN
  if (screen === 'adminAuth') {
    return (
      <AdminAuth
        onBack={handleCloseAdmin}
        onSuccess={() => setScreen('adminDashboard')}
      />
    );
  }

  // MENU SCREEN
  if (screen === 'menu' && selectedTable && user) {
    return (
      <MenuScreen
        user={user}
        table={selectedTable}
        cart={cart}
        dispatch={dispatch}
        onLogout={() => {
          setSelectedTable(null);
          setUser(null);
          dispatch({ type: 'clear' });
          setScreen('tables');
        }}
        onChangeTable={handleChangeTable}
        onCheckout={handleCheckout}
      />
    );
  }

  // CHECKOUT SCREEN
  if (screen === 'checkout' && selectedTable && user) {
    return (
      <CheckoutScreen
        user={user}
        table={selectedTable}
        cart={cart}
        dispatch={dispatch}
        onBack={handleBackToMenu}
        onChangeTable={handleChangeTable}
        onPlaced={handleOrderPlaced}
      />
    );
  }

  // ADMIN DASHBOARD
  if (screen === 'adminDashboard') {
    return (
      <AdminDashboard
        onBack={() => setScreen('tables')}
      />
    );
  }

  // FALLBACK
  return (
    <TablesScreen
      onContinue={handleTableContinue}
      onAdminPress={handleOpenAdmin}
    />
  );
}
