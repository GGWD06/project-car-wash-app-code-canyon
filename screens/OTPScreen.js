import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { sendOTPEmail } from '../utils/emailService';

export default function OTPScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Params passed from LoginScreen
  const { email, password, name } = route.params || {};

  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  
  const inputRef = useRef(null);

  useEffect(() => {
    if (!email || !password || !name) {
      Alert.alert('Error', 'Missing registration data. Please try again.');
      navigation.goBack();
      return;
    }

    // Start countdown
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 处理按键（无需单独处理，由单一 TextInput 接管）
  const handleOTPChange = (text) => {
    // 只保留数字
    const cleaned = text.replace(/[^0-9]/g, '');
    setOtpCode(cleaned);
  };

  const verifyOTPAndRegister = async () => {
    if (otpCode.length !== 6) {
      Alert.alert('Notice', 'Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      // 1. Fetch OTP from Firestore
      const otpDocRef = doc(db, 'otp_verifications', email.toLowerCase());
      const otpSnap = await getDoc(otpDocRef);

      if (!otpSnap.exists()) {
        throw new Error('OTP expired or not found. Please resend.');
      }

      const otpData = otpSnap.data();

      // 2. Check expiration (5 minutes = 300000 ms)
      if (Date.now() - otpData.createdAt > 300000) {
        await deleteDoc(otpDocRef); // Clean up expired
        throw new Error('Verification code has expired. Please resend.');
      }

      // 3. Compare OTP
      if (otpData.code !== otpCode) {
        throw new Error('Incorrect verification code.');
      }

      // 4. OTP is correct! Now create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 5. Create Profile in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name: name.trim(),
        phone: '',
        points: 0,
        vehicles: [],
        email: user.email,
        role: 'user', 
        currentMode: 'user',
        createdAt: new Date().toISOString()
      });

      // 6. Clean up OTP document
      await deleteDoc(otpDocRef);

      // App.js listener will automatically navigate to MainTabs
    } catch (error) {
      console.error(error);
      Alert.alert("Verification Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;

    setResending(true);
    try {
      const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Update in Firestore
      await setDoc(doc(db, 'otp_verifications', email.toLowerCase()), {
        code: newOtpCode,
        createdAt: Date.now()
      });

      // Send email
      await sendOTPEmail(email, newOtpCode);

      setCountdown(60);
      Alert.alert('Success', 'A new verification code has been sent to your email.');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', error.message || 'Failed to resend email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={28} color="#333" />
      </TouchableOpacity>

      <Text style={styles.title}>Email Verification</Text>
      <Text style={styles.subtitle}>
        We've sent a 6-digit code to <Text style={{fontWeight: 'bold', color: '#333'}}>{email}</Text>. 
        Please enter it below to verify your account.
      </Text>

      {/* 隐藏的真实输入框 */}
      <TextInput
        ref={inputRef}
        value={otpCode}
        onChangeText={handleOTPChange}
        maxLength={6}
        keyboardType="number-pad"
        style={styles.hiddenInput}
        autoFocus={true}
      />

      {/* 视觉上的 6 个方框 */}
      <TouchableOpacity 
        style={styles.otpContainer} 
        activeOpacity={1} 
        onPress={() => inputRef.current?.focus()}
      >
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const isCurrentDigit = otpCode.length === index;
          const digit = otpCode[index] || '';
          return (
            <View 
              key={index} 
              style={[
                styles.otpBox, 
                isCurrentDigit && styles.otpBoxActive
              ]}
            >
              <Text style={styles.otpText}>{digit}</Text>
            </View>
          );
        })}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.verifyBtn, loading && {opacity: 0.7}]} 
        onPress={verifyOTPAndRegister} 
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.verifyBtnText}>Verify & Register</Text>
        )}
      </TouchableOpacity>

      <View style={styles.resendContainer}>
        <Text style={styles.resendText}>Didn't receive the code? </Text>
        <TouchableOpacity onPress={handleResendOTP} disabled={countdown > 0 || resending}>
          <Text style={[styles.resendLink, (countdown > 0 || resending) && styles.resendDisabled]}>
            {resending ? 'Sending...' : countdown > 0 ? `Resend in ${countdown}s` : 'Resend Now'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    padding: 25,
    justifyContent: 'center'
  },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    padding: 10,
    zIndex: 10
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 15,
    marginTop: 40
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 40
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    width: '100%',
  },
  otpBox: {
    width: 45,
    height: 55,
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpBoxActive: {
    borderColor: '#007AFF', // 当前正在输入的框高亮
  },
  otpText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  verifyBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#007AFF', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 8, 
    elevation: 4
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30
  },
  resendText: {
    color: '#666',
    fontSize: 15
  },
  resendLink: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: 'bold'
  },
  resendDisabled: {
    color: '#aaa'
  }
});
