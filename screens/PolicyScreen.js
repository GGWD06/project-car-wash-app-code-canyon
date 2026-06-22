import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function PolicyScreen({ route }) {
  const { theme, isDark } = useTheme();
  const { type } = route.params; // 'privacy' or 'terms'

  const content = type === 'privacy' ? {
    title: 'Privacy Policy',
    lastUpdated: 'April 12, 2026',
    sections: [
      {
        header: '1. Data Collection',
        text: 'We collect your phone number for authentication purposes, and your car plate number to facilitate service bookings and vehicle management.'
      },
      {
        header: '2. Data Usage',
        text: 'Your data is solely used to manage your bookings, provide customer support, and send order status notifications. We do not sell or rent your personal information to any third parties.'
      },
      {
        header: '3. Data Security',
        text: 'We use industry-standard encryption and secure cloud storage (Firebase) to protect your personal information against unauthorized access, disclosure, or alteration.'
      },
      {
        header: '4. Your Rights',
        text: 'You have the right to access, correct, or request the deletion of your data at any time. You may permanently delete your account through the "Danger Zone" in your security settings.'
      }
    ]
  } : {
    title: 'Terms of Service',
    lastUpdated: 'April 12, 2026',
    sections: [
      {
        header: '1. Acceptance of Service',
        text: 'By using this application, you agree to provide accurate and updated information regarding your vehicle and contact details.'
      },
      {
        header: '2. Booking & Cancellation',
        text: 'Bookings must be made at least 1 hour in advance. For any changes, please modify or cancel your order through the App promptly.'
      },
      {
        header: '3. Pricing Policy',
        text: 'Service prices may be adjusted based on the vehicle size and the complexity of the service required. Large vehicles (e.g., SUVs/MPVs) will incur additional surcharges.'
      },
      {
        header: '4. Disclaimer',
        text: 'We hold no legal liability for any pre-existing vehicle damage or loss of valuable items left in the car during the service. Please inspect your vehicle prior to hand-over.'
      }
    ]
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: theme.text }]}>{content.title}</Text>
        <Text style={styles.date}>Last Updated: {content.lastUpdated}</Text>
        
        {content.sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={[styles.header, { color: theme.text }]}>{section.header}</Text>
            <Text style={[styles.text, { color: theme.subText }]}>{section.text}</Text>
          </View>
        ))}

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Text style={[styles.footerText, { color: theme.subText }]}>© 2026 Car Wash Express. All rights reserved.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 25, paddingTop: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  date: { fontSize: 14, color: '#888', marginBottom: 30 },
  section: { marginBottom: 25 },
  header: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  text: { fontSize: 15, lineHeight: 24, textAlign: 'justify' },
  footer: { marginTop: 40, borderTopWidth: 1, paddingTop: 20, alignItems: 'center' },
  footerText: { fontSize: 12 }
});
