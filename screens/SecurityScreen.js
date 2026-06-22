import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';

export default function SecurityScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const userId = auth.currentUser?.uid;

  const handleDeleteAccount = () => {
    Alert.alert(
      "⚠ Warning: Delete Account",
      "This will permanently erase all your records. Action cannot be undone.\n\nAre you sure?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm Delete", style: "destructive", onPress: performHardDelete }
      ]
    );
  };

  const performHardDelete = async () => {
    if (!userId) return;
    setIsDeleting(true);
    try {
      const q = query(collection(db, 'bookings'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      querySnapshot.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
      await deleteDoc(doc(db, 'users', userId));
      await deleteUser(auth.currentUser);
      Alert.alert("Success", "Account deleted.");
    } catch (error) {
      console.error("Delete failed:", error);
      Alert.alert("Error", "Could not complete deletion.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isDeleting) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color="#f44336" />
        <Text style={[styles.loadingText, { color: theme.text }]}>Erasing your data securely...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark" size={40} color="#007AFF" />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Privacy & Security</Text>
        <Text style={[styles.subtitle, { color: theme.subText }]}>Manage how we protect your data and account</Text>
      </View>

      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionLabel, { color: theme.text }]}>Permissions</Text>
        <View style={styles.settingItem}>
          <Text style={[styles.settingText, { color: theme.text }]}>Push Notifications</Text>
          <Switch value={pushEnabled} onValueChange={setPushEnabled} />
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.settingItem}>
          <Text style={[styles.settingText, { color: theme.text }]}>Camera Access</Text>
          <Switch value={cameraEnabled} onValueChange={setCameraEnabled} />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionLabel, { color: theme.text }]}>Legal & Policy</Text>
        <TouchableOpacity style={styles.linkItem} onPress={() => navigation.navigate('Policy', { type: 'privacy' })}>
          <Text style={[styles.linkText, { color: theme.text }]}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.subText} />
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <TouchableOpacity style={styles.linkItem} onPress={() => navigation.navigate('Policy', { type: 'terms' })}>
          <Text style={[styles.linkText, { color: theme.text }]}>Terms of Service</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.subText} />
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionLabel, { color: '#f44336' }]}>Dangerous Zone</Text>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Ionicons name="trash-outline" size={20} color="#f44336" />
          <Text style={styles.deleteText}>Delete Account Permanently</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.subText }]}>Version 1.0.4 • Privacy Compliant</Text>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  header: { alignItems: 'center', marginTop: 20, marginBottom: 30 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,122,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
  
  section: { borderRadius: 16, padding: 15, marginBottom: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 15, letterSpacing: 0.5 },
  
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  settingText: { fontSize: 16 },
  
  divider: { height: 1, marginVertical: 12 },
  
  linkItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  linkText: { fontSize: 16 },
  
  deleteBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  deleteText: { fontSize: 16, color: '#f44336', fontWeight: '600', marginLeft: 10 },
  
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 15, fontSize: 14 },
  
  footer: { marginTop: 20, alignItems: 'center' },
  footerText: { fontSize: 12 }
});
