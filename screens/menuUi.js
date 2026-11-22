// menuUi.js — small shared pieces for the menu screens
import React, { useEffect, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { C } from './theme';

export const web = (o) => (Platform.OS === 'web' ? o : null);

// Food photo with a graceful fallback plate if the image is missing or fails to load.
export function FoodImage({ uri, label, style, dim }) {
  const [state, setState] = useState('loading');

  useEffect(() => {
    setState('loading');
  }, [uri]);

  const failed = !uri || state === 'failed';

  return (
    <View
      style={[s.imgBox, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {state !== 'ok' && (
        <View style={s.fallback}>
          <View style={s.plateOuter}>
            <View style={s.plateInner} />
          </View>

          {failed && (
            <Text style={s.fallbackText} numberOfLines={1}>
              Photo coming soon
            </Text>
          )}
        </View>
      )}

      {!failed && (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onLoad={() => setState('ok')}
          onError={() => setState('failed')}
        />
      )}

      {dim && <View style={s.dim} />}
    </View>
  );
}

export function QtyStepper({ value, onChange, min = 1, max = 20 }) {
  return (
    <View style={s.stepper}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        hitSlop={4}
        style={[
          s.stepBtn,
          value <= min && s.disabledStep,
          web({ cursor: 'pointer' }),
        ]}
      >
        <Text style={s.stepText}>−</Text>
      </Pressable>

      <Text
        style={s.qty}
        accessibilityLabel={`Quantity ${value}`}
      >
        {value}
      </Text>

      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        hitSlop={4}
        style={[
          s.stepBtn,
          value >= max && s.disabledStep,
          web({ cursor: 'pointer' }),
        ]}
      >
        <Text style={s.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  imgBox: {
    backgroundColor: '#EADFCE',
    overflow: 'hidden',
  },

  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  plateOuter: {
    width: '42%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3EADB',
  },

  plateInner: {
    width: '62%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(184,149,98,0.6)',
  },

  fallbackText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11.5,
    color: '#8A7E72',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: '100%',
  },

  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(247,241,232,0.62)',
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    borderWidth: 1.5,
    borderColor: C.beige,
    borderRadius: 12,
    backgroundColor: '#FBF8F2',
  },

  stepBtn: {
    width: 40,
    height: 40,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 20,
    color: C.espresso,
  },

  qty: {
    minWidth: 28,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: C.espresso,
  },

  disabledStep: {
    opacity: 0.35,
  },
});