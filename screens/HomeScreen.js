import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { doc, getDoc, collection, query, where, limit, getDocs, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { fetchWeatherByCoords, getUserLocation, getWeatherEmoji } from '../utils/weatherService';
import { Colors } from '../constants/Colors';

const CAR_NEWS = []; // Kept as empty to avoid reference errors if any, or just remove if safe.
// Since I removed the rendering code, I can safely remove the constant.

const PROGRESS_STEPS = [
  { label: 'Booked', icon: 'calendar' },
  { label: 'Foaming', icon: 'water' },
  { label: 'Vacuuming', icon: 'leaf' },
  { label: 'QC Check', icon: 'checkmark-circle' },
  { label: 'Ready', icon: 'car' },
];

export default function HomeScreen({ navigation }) {
  const [userData, setUserData] = React.useState(null);
  const [fuelData, setFuelData] = React.useState(null);
  const [region, setRegion] = React.useState('peninsula'); // 'peninsula' or 'east'
  const [activeOrder, setActiveOrder] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [weather, setWeather] = React.useState(null);
  const [userLocation, setUserLocation] = React.useState(null);
  const isDark = userData?.theme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const userId = auth.currentUser?.uid;



  // Fetch all data
  useFocusEffect(
    React.useCallback(() => {
      let unsubscribeBooking = () => {};

      const fetchData = async () => {
        if (!userId) {
          setLoading(false);
          return;
        }
        
        try {
          // 1. Fetch User Profile
          const userSnap = await getDoc(doc(db, 'users', userId));
          if (userSnap.exists()) setUserData(userSnap.data());

          // 2. Real-time Active Booking Listener
          const q = query(
            collection(db, 'bookings'),
            where('userId', '==', userId),
            where('status', 'in', ['Pending', 'In Progress', 'Completed'])
          );
          
          unsubscribeBooking = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
              const orders = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
              orders.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
              });
              setActiveOrder(orders[0]);
            } else {
              setActiveOrder(null);
            }
          });

          // 3. Fetch Fuel Prices
          const fuelRes = await fetch('https://api.data.gov.my/data-catalogue?id=fuelprice&limit=1&sort=-date');
          const fuelJson = await fuelRes.json();
          if (fuelJson && fuelJson.length > 0) {
            setFuelData(fuelJson[0]);
          }

          // 4. Fetch Weather
          const loc = await getUserLocation();
          setUserLocation(loc);
          const weatherData = await fetchWeatherByCoords(loc.coords.latitude, loc.coords.longitude);
          setWeather(weatherData);
        } catch (error) {
          console.error("Home data fetch error:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchData();

      return () => {
        unsubscribeBooking();
      };
    }, [userId])
  );
  


  if (loading && !userData) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const currentFuel = fuelData;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} showsVerticalScrollIndicator={false}>
      {/* 1. Personalized Header */}
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80' }}
        style={styles.headerBg}
      >
        <View style={styles.headerOverlay}>
          <View style={styles.userHeader}>
            <View>
              <Text style={styles.welcomeText}>Hello,</Text>
              <Text style={styles.userNameText}>{userData?.name || 'Guest User'}</Text>
            </View>

            {weather && (
              <View style={styles.weatherHeader}>
                <Text style={styles.weatherText}>
                  {getWeatherEmoji(weather.weather[0].main)} {Math.round(weather.main.temp)}°C
                </Text>
                <Text style={styles.weatherCity}>{userLocation?.city}</Text>
              </View>
            )}
          </View>
        </View>
      </ImageBackground>

      {/* 2. Service Quick Grid */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Services</Text>
      </View>
      <View style={styles.serviceGrid}>
        {[
          { id: 'express', title: 'Express Wash', icon: 'water', color: '#007AFF', serviceId: 'basic' },
          { id: 'premium', title: 'Premium Wax', icon: 'sparkles', color: '#5856D6', serviceId: 'premium' },
          { id: 'interior', title: 'Interior Clean', icon: 'leaf', color: '#4CD964', serviceId: 'interior' },
          { id: 'ceramic', title: 'Ceramic Coat', icon: 'shield-checkmark', color: '#FF9500', serviceId: 'full' },
        ].map(svc => (
          <TouchableOpacity 
            key={svc.id} 
            style={[styles.serviceItem, { backgroundColor: theme.card }]}
            onPress={() => {
              // If user has only 1 vehicle, pre-select it
              const params = { serviceId: svc.serviceId };
              if (userData?.vehicles?.length === 1) {
                params.plate = userData.vehicles[0].plate;
              }
              navigation.navigate('Book', params);
            }}
          >
            <View style={[styles.serviceIcon, { backgroundColor: svc.color + '15' }]}>
              <Ionicons name={svc.icon} size={28} color={svc.color} />
            </View>
            <Text style={[styles.serviceLabel, { color: theme.text }]}>{svc.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 2.5 My Garage (Quick Selection) */}
      {userData?.vehicles?.length > 0 && (
        <View style={styles.garageSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>My Garage</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
              <Text style={styles.viewAllText}>Manage</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.garageScroll}>
            {userData.vehicles.map((v) => (
              <TouchableOpacity 
                key={v.id || v.plate} 
                style={[styles.vehicleCard, { backgroundColor: theme.card }]}
                onPress={() => navigation.navigate('Book', { plate: v.plate, serviceId: v.preferenceId || 'basic' })}
              >
                <View style={[styles.vehicleIconWrapper, isDark && { backgroundColor: '#1a1a1a' }]}>
                  <Ionicons name={v.icon || 'car-sport-outline'} size={24} color="#007AFF" />
                </View>
                <View style={styles.vehicleInfo}>
                  <Text style={[styles.vehiclePlate, { color: theme.text }]}>{v.plate}</Text>
                  <Text style={[styles.vehicleType, { color: theme.subText }]} numberOfLines={1}>
                    {v.type} • Auto-preset
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 3. Fuel Price Widget */}
      <View style={[styles.fuelWidget, { backgroundColor: theme.card }]}>
        <View style={styles.fuelHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="color-fill" size={20} color={theme.text} />
            <Text style={[styles.fuelTitle, { color: theme.text }]}>Today's Fuel Price</Text>
          </View>
          <View style={[styles.regionToggle, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}>
            <TouchableOpacity 
              style={[styles.toggleBtn, region === 'peninsula' && [styles.toggleActive, { backgroundColor: isDark ? '#555' : '#fff' }]]}
              onPress={() => setRegion('peninsula')}
            >
              <Text style={[styles.toggleText, region === 'peninsula' && styles.toggleTextActive]}>Peninsular</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleBtn, region === 'east' && [styles.toggleActive, { backgroundColor: isDark ? '#555' : '#fff' }]]}
              onPress={() => setRegion('east')}
            >
              <Text style={[styles.toggleText, region === 'east' && styles.toggleTextActive]}>East MY</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.fuelPrices}>
          {[
            { label: 'RON 95', key: 'ron95', color: '#ffcc00' },
            { label: 'RON 97', key: 'ron97', color: '#ff3333' },
            { label: 'Diesel', key: region === 'peninsula' ? 'diesel' : 'diesel_eastmsia', color: isDark ? '#fff' : '#000000' }
          ].map((fuel, idx) => (
            <View key={idx} style={styles.fuelItem}>
              <View style={[styles.fuelIndicator, { backgroundColor: fuel.color }]} />
              <Text style={[styles.fuelLabel, { color: theme.subText }]}>{fuel.label}</Text>
              <Text style={[styles.fuelPrice, { color: theme.text }]}>
                RM {currentFuel && currentFuel[fuel.key] ? Number(currentFuel[fuel.key]).toFixed(2) : '---'}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[styles.fuelUpdated, { color: theme.subText }]}>
          Latest update: {currentFuel?.date || '---'} (data.gov.my)
        </Text>
      </View>

      {activeOrder && (
        <View style={[styles.activeOrderCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity 
            style={styles.activeOrderHeader}
            onPress={() => navigation.navigate('History')}
          >
            <View>
              <Text style={[styles.activeOrderTitle, { color: theme.text }]}>
                {activeOrder.status === 'Completed' ? 'Order Ready! ✨' : (activeOrder.status === 'Pending' ? 'Booking Confirmed' : 'Wash in Progress')}
              </Text>
              <Text style={[styles.activeOrderSub, { color: theme.subText }]}>Order #{activeOrder.id?.slice(-6) || 'N/A'}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: activeOrder.status === 'Completed' ? '#4CD964' : '#007AFF' }]}>
              <Text style={styles.statusText}>{activeOrder.status}</Text>
            </View>
          </TouchableOpacity>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.lineWrapper}>
              <View style={[styles.progressLineBase, isDark && { backgroundColor: '#333' }]} />
              <View 
                style={[
                  styles.progressLineActive, 
                  { width: `${Math.min(activeOrder.currentStep || 0, 4) * 25}%` }
                ]} 
              />
            </View>
            <View style={styles.stepsRow}>
              {PROGRESS_STEPS.map((step, index) => {
                const isActive = (activeOrder.currentStep || 0) >= index;
                const isCurrent = (activeOrder.currentStep || 0) === index;
                return (
                  <View key={index} style={styles.stepItem}>
                    <View style={[
                      styles.stepDot, 
                      isDark && { backgroundColor: '#333', borderColor: theme.card },
                      isActive && styles.stepDotActive,
                      isCurrent && styles.stepDotCurrent
                    ]}>
                      <Ionicons 
                        name={step.icon} 
                        size={12} 
                        color={isActive ? '#fff' : (isDark ? '#666' : '#ccc')} 
                      />
                    </View>
                    <Text style={[
                      styles.stepLabelText, 
                      { color: isDark ? '#666' : '#ccc' },
                      isActive && styles.stepLabelActive
                    ]}>
                      {step?.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={[styles.activeOrderFooter, { borderTopColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="flash" size={16} color="#007AFF" />
              <Text style={styles.activeOrderTime}>
              Current: {PROGRESS_STEPS[activeOrder.currentStep || 0]?.label || 'Done'}
              </Text>
            </View>

          </View>
        </View>
      )}

      <View style={{ height: 40 }}/>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fc' },
  
  // Header
  headerBg: { width: '100%', height: 180, overflow: 'hidden' },
  headerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', padding: 20 },
  userHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  welcomeText: { color: '#efefef', fontSize: 16, fontWeight: '500' },
  userNameText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },

  // Weather Widget in Header
  weatherHeader: { alignItems: 'flex-end' },
  weatherText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  weatherCity: { color: '#fff', fontSize: 12, opacity: 0.8 },


  // Sections
  sectionHeader: { paddingHorizontal: 20, marginTop: 25, marginBottom: 15 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a' },

  // Service Grid
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 15, justifyContent: 'space-between' },
  serviceItem: { width: '47%', borderRadius: 20, padding: 20, marginBottom: 15, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  serviceIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  serviceLabel: { fontSize: 15, fontWeight: '600' },

  // Garage Section
  garageSection: { marginBottom: 10 },
  viewAllText: { color: '#007AFF', fontWeight: 'bold', fontSize: 14 },
  garageScroll: { paddingLeft: 15, paddingRight: 5, paddingBottom: 10 },
  vehicleCard: { 
    flexDirection: 'row', alignItems: 'center', 
    padding: 15, borderRadius: 20, marginRight: 12, width: 220, 
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5 
  },
  vehicleIconWrapper: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  vehicleInfo: { flex: 1 },
  vehiclePlate: { fontSize: 16, fontWeight: 'bold' },
  vehicleType: { fontSize: 12, marginTop: 2 },

  // Fuel Widget
  fuelWidget: { marginHorizontal: 15, padding: 18, borderRadius: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, marginBottom: 20 },
  fuelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  fuelTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  regionToggle: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderRadius: 10, padding: 2 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  toggleActive: { backgroundColor: '#fff', elevation: 2 },
  toggleText: { fontSize: 12, color: '#888', fontWeight: '600' },
  toggleTextActive: { color: '#007AFF' },
  fuelPrices: { flexDirection: 'row', justifyContent: 'space-between' },
  fuelItem: { alignItems: 'center', flex: 1 },
  fuelIndicator: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  fuelLabel: { fontSize: 12, marginBottom: 4 },
  fuelPrice: { fontSize: 16, fontWeight: 'bold' },
  fuelUpdated: { fontSize: 11, textAlign: 'center', marginTop: 15, fontStyle: 'italic' },

  activeOrderCard: { 
    marginHorizontal: 15, marginTop: 20, padding: 18, borderRadius: 24,
    borderWidth: 1, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10
  },
  activeOrderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  activeOrderTitle: { fontSize: 17, fontWeight: 'bold' },
  activeOrderSub: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

  // Progress Bar Styles
  progressContainer: { marginHorizontal: 5, marginBottom: 25, height: 40, justifyContent: 'center' },
  lineWrapper: { position: 'absolute', left: 30, right: 30, height: 3, top: 12 },
  progressLineBase: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 2, backgroundColor: '#eee' },
  progressLineActive: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#007AFF', borderRadius: 2 },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepItem: { alignItems: 'center', width: 60 },
  stepDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 4, borderWidth: 2 },
  stepDotActive: { backgroundColor: '#007AFF' },
  stepDotCurrent: { shadowColor: '#007AFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6, transform: [{ scale: 1.1 }] },
  stepLabelText: { fontSize: 9, fontWeight: 'bold' },
  stepLabelActive: { color: '#007AFF' },

  activeOrderFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 0, paddingTop: 15, borderTopWidth: 1 },
  activeOrderTime: { fontSize: 13, color: '#007AFF', marginLeft: 6, fontWeight: '600' },
  simulateBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  simulateText: { fontSize: 10, fontWeight: 'bold' },

  // Featured Banner
  featuredBox: {
    margin: 15, marginTop: 25, borderRadius: 24, overflow: 'hidden', height: 200, elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15,
  },
  featuredImage: { width: '100%', height: '100%' },
  featuredOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', padding: 20 },
  featuredBadge: { backgroundColor: '#FF3B30', color: '#fff', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, fontSize: 11, fontWeight: 'bold', marginBottom: 8 },
  featuredTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  featuredDesc: { color: '#eee', fontSize: 14 },
  
  // News Card
  newsCard: {
    flexDirection: 'row', marginHorizontal: 15, marginBottom: 15,
    borderRadius: 20, overflow: 'hidden', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8,
  },
  newsImage: { width: 100, height: 100 },
  newsContent: { flex: 1, padding: 15, justifyContent: 'center' },
  newsDate: { color: '#007AFF', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  newsCardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  newsExcerpt: { fontSize: 13, lineHeight: 18 }
});