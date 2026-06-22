import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { checkPasswordStrength, validatePasswordMatch } from '../utils/passwordUtils';
import { Ionicons } from '@expo/vector-icons';
export default function LoginScreen({ navigation }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [strength, setStrength] = useState({ level: 0, message: '' });
  const [matchError, setMatchError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handlePasswordChange = (text) => {
    setPassword(text);
    if (!isLoginMode) {
      setStrength(checkPasswordStrength(text));
      if (confirmPassword) {
        setMatchError(validatePasswordMatch(text, confirmPassword).message);
      }
    }
  };

  const handleConfirmPasswordChange = (text) => {
    setConfirmPassword(text);
    setMatchError(validatePasswordMatch(password, text).message);
  };

  const getStrengthColor = (level) => {
    switch (level) {
      case 0: return '#FF3B30';
      case 1: return '#FF9500';
      case 2: return '#34C759';
      default: return '#8E8E93';
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert("Notice", "Please enter your email address first");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert("Success", "Password reset email has been sent. Please check your inbox.");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Notice", "Please enter email and password");
      return;
    }
    if (!isLoginMode) {
      if (!name.trim()) {
        Alert.alert("Notice", "Please enter your name");
        return;
      }
      if (strength.level === 0) {
        Alert.alert("Notice", "Please choose a stronger password");
        return;
      }
      if (!validatePasswordMatch(password, confirmPassword).isMatch) {
        Alert.alert("Notice", "Passwords do not match");
        return;
      }
    }

    setLoading(true);
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        // 1. Check if user already exists
        const q = query(collection(db, 'users'), where('email', '==', email.trim().toLowerCase()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          Alert.alert("Registration Failed", "This email is already registered. Please login instead.");
          setLoading(false);
          return;
        }

        // 2. Create User in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;

        // 3. Send Official Verification Email
        await sendEmailVerification(user);

        // 4. Create Profile in Firestore
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

        Alert.alert(
          "Success", 
          "Registration successful! We have sent a verification link to your email. Please verify before logging in.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error(error);
      let errorMsg = error.message;
      if (error.code === 'auth/user-not-found') errorMsg = "No account found with this email.";
      if (error.code === 'auth/wrong-password') errorMsg = "Incorrect password.";
      if (error.code === 'auth/email-already-in-use') errorMsg = "Email already registered.";
      Alert.alert("Authentication Failed", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Text style={styles.title}>Car Wash Manager</Text>
      <Text style={styles.subtitle}>{isLoginMode ? 'Login to continue' : 'Create an account to start'}</Text>

      {!isLoginMode && (
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <View style={styles.passwordContainer}>
        <TextInput
          style={[styles.input, (!isLoginMode && strength.message && strength.level === 0) ? styles.inputError : null, styles.passwordInput]}
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={handlePasswordChange}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity 
          style={styles.eyeIcon} 
          onPress={() => setShowPassword(!showPassword)}
        >
          <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#999" />
        </TouchableOpacity>
      </View>

      {isLoginMode && (
        <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>
      )}

      {(!isLoginMode && password.length > 0) && (
        <Text style={[styles.hintText, { color: getStrengthColor(strength.level) }]}>
          {strength.message}
        </Text>
      )}

      {!isLoginMode && (
        <>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, matchError ? styles.inputError : null, styles.passwordInput]}
              placeholder="Confirm Password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={handleConfirmPasswordChange}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity 
              style={styles.eyeIcon} 
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#999" />
            </TouchableOpacity>
          </View>
          {matchError ? (
            <Text style={styles.errorText}>{matchError}</Text>
          ) : null}
        </>
      )}

      <TouchableOpacity style={styles.loginBtn} onPress={handleAuth} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{isLoginMode ? 'Login' : 'Register'}</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => {
        setIsLoginMode(!isLoginMode);
        setPassword('');
        setConfirmPassword('');
        setStrength({ level: 0, message: '' });
        setMatchError('');
        setShowPassword(false);
        setShowConfirmPassword(false);
      }} style={styles.toggleBtn}>
        <Text style={styles.toggleText}>
          {isLoginMode ? "Don't have an account? Register Now" : "Already have an account? Login"}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: '#f5f7fa', padding: 25 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#007AFF', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 30, textAlign: 'center' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e1e4e8',
    marginBottom: 15,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 15,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -5,
  },
  forgotText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  hintText: {
    fontSize: 12,
    marginBottom: 15,
    marginLeft: 5,
    marginTop: -10,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginBottom: 15,
    marginLeft: 5,
    marginTop: -10,
  },
  loginBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  toggleBtn: { marginTop: 25, alignItems: 'center' },
  toggleText: { color: '#007AFF', fontSize: 15, fontWeight: '600' }
});
