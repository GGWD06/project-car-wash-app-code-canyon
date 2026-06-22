import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Switch, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';

export default function MerchantSettingsScreen() {
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    shopName: 'My Car Wash',
    latitude: null,
    longitude: null,
    maxDistance: 20,
    isOpen: true,
    updatedAt: '',
    offeredServices: {
      basic: { enabled: true, price: 15 },
      premium: { enabled: true, price: 45 },
      interior: { enabled: true, price: 80 },
      full: { enabled: true, price: 150 },
    },
    facilities: []
  });

  const FACILITY_OPTIONS = [
    { id: 'cafe', name: 'Coffee/Cafe', icon: 'cafe' },
    { id: 'wifi', name: 'Free Wi-Fi', icon: 'wifi' },
    { id: 'lounge', name: 'Indoor Lounge', icon: 'tv' },
    { id: 'parking', name: 'Ample Parking', icon: 'car' },
    { id: 'snack', name: 'Snacks/Vending', icon: 'pizza' },
  ];

  const [shopId, setShopId] = useState('default_shop');

  useEffect(() => {
    fetchConfig();
  }, []);

  // --- 核心逻辑：从云端获取店铺配置 ---
  const fetchConfig = async () => {
    try {
      const userEmail = auth.currentUser?.email;
      if (!userEmail) return;

      // 1. 根据当前登录的商家邮箱，查询对应的店铺文档
      const q = query(collection(db, "shops"), where("ownerEmail", "==", userEmail));
      const snap = await getDocs(q);
      
      let shopDocId = 'default_shop';
      let data = null;

      if (!snap.empty) {
        // 2. 如果找到了店铺，读取其配置（如坐标、价格、服务开关等）
        shopDocId = snap.docs[0].id;
        data = snap.docs[0].data();
        setShopId(shopDocId);
        
        // 3. 将云端数据与本地默认模版合并，确保 UI 能显示最新的配置
        setConfig(prev => ({
          ...prev,
          ...data,
          // 特别处理服务开关对象，确保商家自定义的价格和开关状态能被正确加载
          offeredServices: { ...prev.offeredServices, ...(data.offeredServices || {}) },
          facilities: data.facilities || []
        }));
      } else {
        setShopId(null); // 如果没找到店，UI 会提示商家先创建店铺
      }
    } catch (e) {
      console.log("Fetch error", e);
    } finally {
      setLoading(false);
    }
  };

  const updateLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Error", "Location access is required to set shop address");
        return;
      }

      setSaving(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const newPos = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, "shops", "default_shop"), newPos, { merge: true });
      setConfig(prev => ({ ...prev, ...newPos }));
      Alert.alert("Success", "Shop location has been updated to your current position");
    } catch (e) {
      Alert.alert("Failed", "Unable to get current location");
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (updates) => {
    setSaving(true);
    try {
      await setDoc(doc(db, "shops", shopId), updates, { merge: true });
      setConfig(prev => ({ ...prev, ...updates }));
    } catch (e) {
      Alert.alert("Error", "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleManualSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "shops", shopId), {
        ...config,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      Alert.alert("Success", "Shop settings uploaded to Firebase!");
    } catch (e) {
      Alert.alert("Error", "Upload failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator color={theme.primary} /></View>;

  if (!shopId) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background, padding: 30 }]}>
        <Ionicons name="alert-circle-outline" size={80} color={theme.subText} />
        <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 20, color: theme.text }}>No Shop Linked</Text>
        <Text style={{ textAlign: 'center', marginTop: 10, color: theme.subText }}>
          Your account ({auth.currentUser?.email}) is not linked to any car wash shop. 
          Please contact the administrator to assign a shop to you.
        </Text>
        <TouchableOpacity 
          style={{ marginTop: 30, backgroundColor: theme.primary, padding: 15, borderRadius: 12 }}
          onPress={() => auth.signOut()}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.scrollContent}>

      {/* 0. Shop Name Setting */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="storefront-outline" size={24} color={isDark ? "#FFD60A" : "#FF9500"} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Shop Name</Text>
        </View>
        <TextInput
          style={[styles.input, { backgroundColor: isDark ? '#3A3A3C' : '#f0f0f0', color: theme.text, borderColor: theme.border }]}
          value={config.shopName}
          placeholder="Enter display name..."
          placeholderTextColor={theme.subText}
          onChangeText={(val) => setConfig(prev => ({ ...prev, shopName: val }))}
          onBlur={() => saveSettings({ shopName: config.shopName })}
        />
        <Text style={[styles.infoText, { color: theme.subText }]}>This name will precisely be displayed on the booking interface.</Text>
      </View>

      {/* 1. Location Coordinate Config */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="location-sharp" size={24} color={isDark ? "#FFD60A" : "#FF9500"} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Shop Location</Text>
        </View>

        <View style={[styles.locInfo, { backgroundColor: isDark ? '#3A3A3C' : '#f0f0f0' }]}>
          <View style={styles.coordRow}>
            <Text style={[styles.coordLabel, { color: theme.subText }]}>Latitude (Lat):</Text>
            <Text style={[styles.coordValue, { color: theme.text }]}>{config.latitude?.toFixed(6) || 'Not Configured'}</Text>
          </View>
          <View style={styles.coordRow}>
            <Text style={[styles.coordLabel, { color: theme.subText }]}>Longitude (Lng):</Text>
            <Text style={[styles.coordValue, { color: theme.text }]}>{config.longitude?.toFixed(6) || 'Not Configured'}</Text>
          </View>
        </View>

        <Text style={[styles.timestamp, { color: theme.subText }]}>
          Last Updated: {config.updatedAt ? new Date(config.updatedAt).toLocaleString() : 'Never'}
        </Text>

        <TouchableOpacity
          style={[styles.refreshBtn, { backgroundColor: isDark ? '#FFD60A' : '#FF9500' }]}
          onPress={updateLocation}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#1C1C1E" /> : (
            <>
              <Ionicons name="refresh" size={18} color="#1C1C1E" />
              <Text style={styles.refreshBtnText}>Update to Current Location</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* 2. Service Radius */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="resize" size={22} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Service Radius</Text>
        </View>

        <View style={styles.radiusRow}>
          {[10, 20, 50, 100].map(r => (
            <TouchableOpacity
              key={r}
              style={[
                styles.radiusChip,
                { backgroundColor: isDark ? '#3A3A3C' : '#f0f0f0' },
                config.maxDistance === r && { backgroundColor: theme.primary }
              ]}
              onPress={() => saveSettings({ maxDistance: r })}
            >
              <Text style={[
                styles.chipText,
                { color: theme.subText },
                config.maxDistance === r && { color: '#fff' }
              ]}>{r}km</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.infoText, { color: theme.subText }]}>Only users within {config.maxDistance}km of the shop can request bookings.</Text>
      </View>

      {/* 3. Business Status */}
      <View style={[styles.card, styles.row, { backgroundColor: theme.card }]}>
        <View style={styles.rowLeft}>
          <Ionicons name="power" size={22} color={config.isOpen ? "#30D158" : "#FF453A"} />
          <View style={{ marginLeft: 12 }}>
            <Text style={[styles.cardTitle, { color: theme.text, marginLeft: 0 }]}>Accepting Bookings</Text>
            <Text style={[styles.infoText, { color: theme.subText }]}>{config.isOpen ? 'Shop is Currently Open' : 'Bookings Paused'}</Text>
          </View>
        </View>
        <Switch
          value={config.isOpen}
          onValueChange={(val) => saveSettings({ isOpen: val })}
          trackColor={{ false: theme.border, true: "#30D158" }}
        />
      </View>

      {/* 4. Service Customization */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="construct-outline" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Services & Pricing</Text>
        </View>

        {Object.keys(config.offeredServices || {}).map((key) => {
          const svc = config.offeredServices[key];
          const labels = {
            basic: 'Standard Wash',
            premium: 'Premium Wax',
            interior: 'Interior Deep',
            full: 'Full Detail'
          };

          return (
            <View key={key} style={styles.servicePriceRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.serviceName, { color: theme.text }]}>{labels[key]}</Text>
                <View style={styles.priceInputWrapper}>
                  <Text style={{ color: theme.subText, marginRight: 5 }}>RM</Text>
                  <TextInput
                    style={[styles.priceInput, { color: theme.text, borderColor: theme.border }]}
                    keyboardType="numeric"
                    value={String(svc.price)}
                    onChangeText={(val) => {
                      const newServices = { ...config.offeredServices };
                      newServices[key].price = val === '' ? 0 : parseFloat(val);
                      setConfig(prev => ({ ...prev, offeredServices: newServices }));
                    }}
                    onBlur={() => saveSettings({ offeredServices: config.offeredServices })}
                  />
                </View>
              </View>
              <Switch
                value={svc.enabled}
                onValueChange={(val) => {
                  const newServices = { ...config.offeredServices };
                  newServices[key].enabled = val;
                  saveSettings({ offeredServices: newServices });
                }}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
          );
        })}
      </View>

      {/* 5. Facility Tags */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="list-outline" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Shop Facilities</Text>
        </View>
        <View style={styles.facilitiesGrid}>
          {FACILITY_OPTIONS.map(opt => {
            const isSelected = config.facilities?.includes(opt.id);
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.facilityChip,
                  { backgroundColor: isDark ? '#3A3A3C' : '#f0f0f0' },
                  isSelected && { backgroundColor: theme.primary }
                ]}
                onPress={() => {
                  const newFacilities = isSelected
                    ? config.facilities.filter(f => f !== opt.id)
                    : [...(config.facilities || []), opt.id];
                  saveSettings({ facilities: newFacilities });
                }}
              >
                <Ionicons name={opt.icon} size={16} color={isSelected ? '#fff' : theme.subText} />
                <Text style={[styles.facilityText, { color: isSelected ? '#fff' : theme.text }]}>{opt.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      
      {/* 6. Explicit Save Button */}
      <TouchableOpacity 
        style={[styles.saveAllBtn, { backgroundColor: theme.primary }]}
        onPress={handleManualSave}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color="#fff" /> : (
          <>
            <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
            <Text style={styles.saveAllBtnText}>Upload to Firebase</Text>
          </>
        )}
      </TouchableOpacity>
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: { borderRadius: 20, padding: 20, marginBottom: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', marginLeft: 10 },

  input: { borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 12, borderWidth: 1 },

  locInfo: { borderRadius: 12, padding: 15, marginBottom: 12 },
  coordRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  coordLabel: { fontSize: 14 },
  coordValue: { fontSize: 14, fontWeight: '600', fontFamily: 'monospace' },

  timestamp: { fontSize: 12, marginBottom: 20 },

  refreshBtn: { height: 50, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  refreshBtnText: { color: '#1C1C1E', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },

  radiusRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  radiusChip: { flex: 1, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4 },
  chipText: { fontWeight: '600' },

  infoText: { fontSize: 13, lineHeight: 18 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },

  servicePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5, // Give some space from the service name
  },
  priceInput: {
    width: 70,
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 16,
    textAlign: 'center',
    paddingTop: 4, // Nudge text down
    textAlignVertical: 'center', // Android specific
  },
  facilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  facilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 5,
  },
  facilityText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  saveAllBtn: {
    height: 55,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  saveAllBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    marginLeft: 10,
  }
});
