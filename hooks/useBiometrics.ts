import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BIOMETRIC_ENABLED_KEY = 'biometric_login_enabled';
const BIOMETRIC_CREDENTIALS_KEY = 'biometric_credentials';
const BIOMETRIC_PROMPT_SHOWN_KEY = 'biometric_prompt_shown';

interface BiometricCredentials {
  identifier: string;
  password: string;
}

interface BiometricState {
  isSupported: boolean;
  isEnrolled: boolean;
  isEnabled: boolean;
  biometricType: string | null;
}

export const useBiometrics = () => {
  const [state, setState] = useState<BiometricState>({
    isSupported: false,
    isEnrolled: false,
    isEnabled: false,
    biometricType: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  const getBiometricType = useCallback((types: LocalAuthentication.AuthenticationType[]): string => {
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'Iris Recognition';
    }
    return 'Biometric';
  }, []);

  const checkBiometricSupport = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        setState(prev => ({ ...prev, isSupported: false, isEnrolled: false }));
        setIsLoading(false);
        return;
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const biometricType = supportedTypes.length > 0 ? getBiometricType(supportedTypes) : null;

      const enabledStr = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      const isEnabled = enabledStr === 'true';

      setState({
        isSupported: hasHardware,
        isEnrolled,
        isEnabled: isEnabled && isEnrolled,
        biometricType,
      });
    } catch (error) {
      __DEV__ && console.log('Biometric check error:', error);
      setState(prev => ({ ...prev, isSupported: false, isEnrolled: false }));
    } finally {
      setIsLoading(false);
    }
  }, [getBiometricType]);

  useEffect(() => {
    checkBiometricSupport();
  }, [checkBiometricSupport]);

  const authenticateWithBiometrics = useCallback(async (): Promise<{
    success: boolean;
    credentials?: BiometricCredentials;
    error?: string;
  }> => {
    try {
      if (!state.isSupported || !state.isEnrolled) {
        return { success: false, error: 'Biometric authentication not available' };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Login with ${state.biometricType || 'biometrics'}`,
        fallbackLabel: 'Use password',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (!result.success) {
        return { success: false, error: 'Authentication failed' };
      }

      const credentialsStr = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY);
      if (!credentialsStr) {
        return { success: false, error: 'No saved credentials found' };
      }

      const credentials: BiometricCredentials = JSON.parse(credentialsStr);
      return { success: true, credentials };
    } catch (error) {
      __DEV__ && console.log('Biometric authentication error:', error);
      return { success: false, error: 'Authentication error' };
    }
  }, [state.isSupported, state.isEnrolled, state.biometricType]);

  const enableBiometricLogin = useCallback(async (
    identifier: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!state.isSupported || !state.isEnrolled) {
        return { success: false, error: 'Biometric authentication not available' };
      }

      const credentials: BiometricCredentials = { identifier, password };
      await SecureStore.setItemAsync(BIOMETRIC_CREDENTIALS_KEY, JSON.stringify(credentials));
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');

      setState(prev => ({ ...prev, isEnabled: true }));
      return { success: true };
    } catch (error) {
      __DEV__ && console.log('Enable biometric error:', error);
      return { success: false, error: 'Failed to enable biometric login' };
    }
  }, [state.isSupported, state.isEnrolled]);

  const disableBiometricLogin = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);

      setState(prev => ({ ...prev, isEnabled: false }));
      return { success: true };
    } catch (error) {
      __DEV__ && console.log('Disable biometric error:', error);
      return { success: false, error: 'Failed to disable biometric login' };
    }
  }, []);

  const hasShownBiometricPrompt = useCallback(async (): Promise<boolean> => {
    try {
      const shown = await SecureStore.getItemAsync(BIOMETRIC_PROMPT_SHOWN_KEY);
      return shown === 'true';
    } catch {
      return false;
    }
  }, []);

  const markBiometricPromptShown = useCallback(async (): Promise<void> => {
    try {
      await SecureStore.setItemAsync(BIOMETRIC_PROMPT_SHOWN_KEY, 'true');
    } catch (error) {
      __DEV__ && console.log('Mark prompt shown error:', error);
    }
  }, []);

  return {
    ...state,
    isLoading,
    authenticateWithBiometrics,
    enableBiometricLogin,
    disableBiometricLogin,
    hasShownBiometricPrompt,
    markBiometricPromptShown,
    checkBiometricSupport,
  };
};
