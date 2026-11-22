
import React, { useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { C } from './theme';

const ADMIN_PASSWORD = 'admin123';

// Typography shared across the screen
const FONT = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export default function AdminAuth({ onBack, onSuccess }) {
  const { width } = useWindowDimensions();
  const mobile = width < 600;

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 550,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 6,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 55,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleLogin = () => {
    if (loading) return;

    Keyboard.dismiss();
    setError('');

    if (!password.trim()) {
      setError('Please enter the admin password.');
      shake();
      return;
    }

    if (password === ADMIN_PASSWORD) {
      setLoading(true);
      setPassword('');

      setTimeout(() => {
        setLoading(false);

        if (typeof onSuccess === 'function') {
          onSuccess();
        }
      }, 350);
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
      shake();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={C.cream}
      />

      <View style={styles.container}>
        <View style={styles.glowOne} />
        <View style={styles.glowTwo} />

        <View style={styles.topBar}>
          <Pressable
            onPress={() => onBack?.()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && { opacity: 0.65 },
            ]}
          >
            <Text style={styles.backText}>‹</Text>
            <Text style={styles.backLabel}>BACK</Text>
          </Pressable>

          <View style={styles.topBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.topBadgeText}>SECURE ACCESS</Text>
          </View>
        </View>

        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.iconOuter}>
            <View style={styles.iconInner}>
              <Text style={styles.lockIcon}>♙</Text>
            </View>
            <View style={styles.iconDot} />
          </View>

          <Text style={styles.eyebrow}>RESTRICTED AREA</Text>

          <Text style={styles.title}>Admin Portal</Text>

          <Text style={styles.subtitle}>
            Enter your administrator password to access the management
            dashboard.
          </Text>

          <Animated.View
            style={[
              styles.card,
              {
                width: mobile ? '100%' : 420,
                transform: [{ translateX: shakeAnim }],
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>
                  Administrator Login
                </Text>
                <Text style={styles.cardSubtitle}>
                  AUTHENTICATION REQUIRED
                </Text>
              </View>

              <View style={styles.cardLock}>
                <Text style={styles.cardLockText}>✦</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.inputLabel}>
              ADMIN PASSWORD
            </Text>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>◆</Text>

              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (error) setError('');
                }}
                placeholder="Enter admin password"
                placeholderTextColor={C.muted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handleLogin}
                returnKeyType="go"
                style={styles.input}
              />

              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.showButton}
              >
                <Text style={styles.showText}>
                  {showPassword ? 'HIDE' : 'SHOW'}
                </Text>
              </Pressable>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorIcon}>!</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <View style={styles.hintRow}>
                <Text style={styles.hintText}>
                  Your credentials are required to continue.
                </Text>
              </View>
            )}

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [
                styles.loginButton,
                pressed && !loading && styles.loginButtonPressed,
                loading && { opacity: 0.7 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={C.espresso} />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>
                    ACCESS DASHBOARD
                  </Text>
                  <Text style={styles.loginArrow}>↗</Text>
                </>
              )}
            </Pressable>

            <View style={styles.securityRow}>
              <Text style={styles.securityIcon}>◆</Text>
              <Text style={styles.securityText}>
                ADMINISTRATOR ACCESS ONLY
              </Text>
            </View>
          </Animated.View>

          <Text style={styles.footer}>
            RESTAURANT MANAGEMENT SYSTEM
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.cream,
  },

  container: {
    flex: 1,
    backgroundColor: C.cream,
    overflow: 'hidden',
    paddingHorizontal: 22,
  },

  glowOne: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: C.gold,
    opacity: 0.09,
    top: -180,
    right: -100,
  },

  glowTwo: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: C.gold,
    opacity: 0.07,
    bottom: -150,
    left: -100,
  },

  topBar: {
    height: 65,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingRight: 12,
  },

  backText: {
    color: C.gold,
    fontSize: 30,
    lineHeight: 32,
    fontWeight: '500',
  },

  backLabel: {
    color: C.espresso,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    fontFamily: FONT.bold,
  },

  topBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.gold,
  },

  topBadgeText: {
    color: C.espresso,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    fontFamily: FONT.bold,
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 35,
  },

  iconOuter: {
    width: 82,
    height: 82,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
    backgroundColor: C.card,
  },

  iconInner: {
    width: 62,
    height: 62,
    borderRadius: 19,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },

  lockIcon: {
    fontSize: 30,
    color: C.gold,
  },

  iconDot: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: C.gold,
    right: -3,
    top: -3,
    borderWidth: 2,
    borderColor: C.cream,
  },

  eyebrow: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.8,
    marginBottom: 10,
    fontFamily: FONT.bold,
  },

  title: {
    color: C.espresso,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
    fontFamily: FONT.bold,
  },

  subtitle: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 340,
    marginTop: 12,
    marginBottom: 30,
    fontFamily: FONT.regular,
  },

  card: {
    maxWidth: 420,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 22,
    padding: 24,
    shadowColor: C.espresso,
    shadowOpacity: 0.10,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 12 },
    elevation: 7,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardTitle: {
    color: C.espresso,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontFamily: FONT.bold,
  },

  cardSubtitle: {
    color: C.gold,
    fontSize: 10,
    letterSpacing: 1.3,
    marginTop: 6,
    fontWeight: '800',
    fontFamily: FONT.bold,
  },

  cardLock: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },

  cardLockText: {
    color: C.gold,
    fontSize: 19,
  },

  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 22,
  },

  inputLabel: {
    color: C.espresso,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 10,
    fontFamily: FONT.bold,
  },

  inputWrapper: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 13,
    backgroundColor: C.cream,
    paddingHorizontal: 14,
  },

  inputIcon: {
    color: C.gold,
    fontSize: 12,
    marginRight: 11,
  },

  input: {
    flex: 1,
    color: C.espresso,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 12,
    fontFamily: FONT.medium,
  },

  showButton: {
    paddingVertical: 10,
    paddingLeft: 10,
  },

  showText: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: FONT.bold,
  },

  hintRow: {
    minHeight: 40,
    justifyContent: 'center',
  },

  hintText: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '500',
    fontFamily: FONT.regular,
  },

  errorBox: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  errorIcon: {
    color: '#D94A4A',
    fontWeight: '900',
    fontSize: 14,
  },

  errorText: {
    color: '#C83D3D',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    fontFamily: FONT.medium,
  },

  loginButton: {
    height: 55,
    borderRadius: 13,
    backgroundColor: C.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
    gap: 12,
    shadowColor: C.gold,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },

  loginButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  loginButtonText: {
    color: C.espresso,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    fontFamily: FONT.bold,
  },

  loginArrow: {
    color: C.espresso,
    fontSize: 19,
    fontWeight: '900',
  },

  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },

  securityIcon: {
    color: C.gold,
    fontSize: 9,
  },

  securityText: {
    color: C.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    fontFamily: FONT.bold,
  },

  footer: {
    color: C.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginTop: 30,
    textAlign: 'center',
    fontFamily: FONT.bold,
  },
});
