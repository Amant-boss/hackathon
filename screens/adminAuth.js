
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
      <StatusBar barStyle="light-content" backgroundColor={C.espresso} />

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
                <Text style={styles.cardTitle}>Administrator Login</Text>
                <Text style={styles.cardSubtitle}>
                  AUTHENTICATION REQUIRED
                </Text>
              </View>

              <View style={styles.cardLock}>
                <Text style={styles.cardLockText}>✦</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.inputLabel}>ADMIN PASSWORD</Text>

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
    backgroundColor: C.espresso,
  },

  container: {
    flex: 1,
    backgroundColor: C.espresso,
    overflow: 'hidden',
    paddingHorizontal: 22,
  },

  glowOne: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: C.gold,
    opacity: 0.045,
    top: -180,
    right: -100,
  },

  glowTwo: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: C.gold,
    opacity: 0.035,
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
    fontSize: 27,
    lineHeight: 28,
  },

  backLabel: {
    color: C.cream,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  topBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.gold,
  },

  topBadgeText: {
    color: C.gold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
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
    backgroundColor: 'rgba(255,255,255,0.025)',
  },

  iconInner: {
    width: 62,
    height: 62,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  lockIcon: {
    fontSize: 30,
    color: C.gold,
  },

  iconDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.gold,
    right: -3,
    top: -3,
    borderWidth: 2,
    borderColor: C.espresso,
  },

  eyebrow: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 10,
  },

  title: {
    color: C.cream,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    textAlign: 'center',
  },

  subtitle: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 340,
    marginTop: 12,
    marginBottom: 30,
  },

  card: {
    maxWidth: 420,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardTitle: {
    color: C.cream,
    fontSize: 17,
    fontWeight: '800',
  },

  cardSubtitle: {
    color: C.gold,
    fontSize: 9,
    letterSpacing: 1.5,
    marginTop: 6,
    fontWeight: '700',
  },

  cardLock: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },

  cardLockText: {
    color: C.gold,
    fontSize: 18,
  },

  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 22,
  },

  inputLabel: {
    color: C.cream,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
  },

  inputWrapper: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.espresso,
    paddingHorizontal: 14,
  },

  inputIcon: {
    color: C.gold,
    fontSize: 12,
    marginRight: 11,
  },

  input: {
    flex: 1,
    color: C.cream,
    fontSize: 14,
    paddingVertical: 12,
  },

  showButton: {
    paddingVertical: 10,
    paddingLeft: 10,
  },

  showText: {
    color: C.gold,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },

  hintRow: {
    minHeight: 36,
    justifyContent: 'center',
  },

  hintText: {
    color: C.muted,
    fontSize: 10,
  },

  errorBox: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  errorIcon: {
    color: '#FF7777',
    fontWeight: '900',
    fontSize: 13,
  },

  errorText: {
    color: '#FF9999',
    fontSize: 11,
    flex: 1,
  },

  loginButton: {
    height: 54,
    borderRadius: 12,
    backgroundColor: C.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
    gap: 12,
  },

  loginButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  loginButtonText: {
    color: C.espresso,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },

  loginArrow: {
    color: C.espresso,
    fontSize: 17,
    fontWeight: '800',
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
    fontSize: 8,
  },

  securityText: {
    color: C.muted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.3,
  },

  footer: {
    color: C.muted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 30,
    textAlign: 'center',
  },
});
