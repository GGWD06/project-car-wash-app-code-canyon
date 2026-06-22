import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { collection, doc, setDoc, getDoc, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { fetchForecastByCoords, getUserLocation, getWeatherEmoji } from '../utils/weatherService';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// 计算两个经纬度之间的距离 (km)
// --- 逻辑函数：计算两个经纬度之间的距离 (球面三角算法/Haversine Formula) ---
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // 地球半径，单位公里 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // 返回单位为公里的距离
};

// 车型与服务的数据定义
const CAR_TYPES = [
  { id: 'sedan', name: 'Sedan', surcharge: 0 },
  { id: 'suv', name: 'SUV/Crossover', surcharge: 5 },
  { id: 'mpv', name: 'MPV / 4x4', surcharge: 10 },
];

const SERVICES = [
  { id: 'basic', name: 'Standard Wash', desc: 'Exterior foam wash, basic interior vacuuming', basePrice: 15 },
  { id: 'premium', name: 'Premium Wax', desc: 'Includes standard wash, plus hand wax and tire shine', basePrice: 45 },
  { id: 'interior', name: 'Interior Deep Clean', desc: 'Steam cleaning seats & carpets, complete odor removal', basePrice: 80 },
  { id: 'full', name: 'Full Detail', desc: 'Interior & exterior full detail, polishing & engine bay surface wash', basePrice: 150 },
];

// 动态生成未来3天的可选日期
const getAvailableDates = () => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 4; i++) {
    const nextDate = new Date();
    nextDate.setDate(today.getDate() + i);
    let label = '';
    if (i === 0) label = 'Today';
    else if (i === 1) label = 'Tomorrow';
    else if (i === 2) label = 'Day after tom.';
    else label = 'In 3 days';

    // 格式化为 MM/DD
    const dateStr = `${nextDate.getMonth() + 1}/${nextDate.getDate()}`;
    dates.push({ id: `date_${i}`, label, dateStr, value: nextDate.toISOString().split('T')[0] });
  }
  return dates;
};

const AVAILABLE_DATES = getAvailableDates();
const AVAILABLE_TIMES = ['09:00', '10:30', '13:00', '14:30', '16:00', '17:30'];


export default function BookingScreen({ route }) {
  const { theme, isDark } = useTheme();
  const [carPlate, setCarPlate] = useState(route?.params?.plate || '');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedCarType, setSelectedCarType] = useState(CAR_TYPES[0]);
  
  const initialService = route?.params?.serviceId 
    ? SERVICES.find(s => s.id === route.params.serviceId) || SERVICES[0] 
    : SERVICES[0];
  const [selectedService, setSelectedService] = useState(initialService);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forecast, setForecast] = useState([]);
  const [rainWarning, setRainWarning] = useState(null);

  const [isOutOfRange, setIsOutOfRange] = useState(false);
  const [isShopClosed, setIsShopClosed] = useState(false);
  const [distance, setDistance] = useState(null);
  const [nearbyShops, setNearbyShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [userCoords, setUserCoords] = useState(null);


  const fetchNearbyShops = async () => {
    try {
      if (!isRefreshing) setIsRefreshing(true);
      // 1. Get User Location
      let { status } = await Location.requestForegroundPermissionsAsync();
      let location = null;
      if (status === 'granted') {
        location = await Location.getLastKnownPositionAsync({});
        if (!location) {
          location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }
      }

      if (location && location.coords) {
        setUserCoords(location.coords);
      }

      // 2. Fetch Shops from Firestore
      const shopsSnap = await getDocs(collection(db, "shops"));
      let allShops = [];
      
      shopsSnap.forEach(doc => {
        allShops.push({ id: doc.id, ...doc.data() });
      });



      // 3. Filter shops within 60km
      if (location && location.coords) {
        const filtered = allShops.map(shop => {
          // Ensure coords are numbers
          const sLat = Number(shop.latitude);
          const sLng = Number(shop.longitude);
          
          if (isNaN(sLat) || isNaN(sLng)) return null;

          const dist = calculateDistance(
            location.coords.latitude, 
            location.coords.longitude, 
            sLat, 
            sLng
          );
          return { ...shop, distance: dist, latitude: sLat, longitude: sLng };
        }).filter(shop => shop !== null && shop.distance <= 60)
          .sort((a, b) => a.distance - b.distance);

        setNearbyShops(filtered);
        
        if (filtered.length > 0) {
          // Check if currently selected shop is still in the list
          const stillAvailable = selectedShop ? filtered.find(s => s.id === selectedShop.id) : null;
          
          if (stillAvailable) {
            // Keep current selection but update its data
            setSelectedShop(stillAvailable);
            setDistance(stillAvailable.distance);
            setIsShopClosed(stillAvailable.isOpen === false);
          } else {
            // Default to closest only if nothing selected or current selection gone
            setSelectedShop(filtered[0]);
            setDistance(filtered[0].distance);
            setIsShopClosed(filtered[0].isOpen === false);
          }
          setIsOutOfRange(false);
        } else {
          setIsOutOfRange(true);
          setDistance(null);
        }
      } else {
        // No location permission/data, show all shops but no distance
        setNearbyShops(allShops);
        if (allShops.length > 0) setSelectedShop(allShops[0]);
      }
    } catch (e) {
      console.log("Fetch shops error", e);
      setDistance(0);
    } finally {
      setIsRefreshing(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    fetchNearbyShops();
  }, [selectedShop]); // Now recognizes the current selection

  React.useEffect(() => {
    fetchNearbyShops();
  }, []);

  // 4. Auto-switch service if currently selected one becomes unavailable
  React.useEffect(() => {
    if (selectedShop && selectedService) {
      const shopSvc = selectedShop.offeredServices?.[selectedService.id];
      // If current service is disabled in this shop
      if (shopSvc && shopSvc.enabled === false) {
        // Find first available service
        const firstAvailable = SERVICES.find(s => {
          const cfg = selectedShop.offeredServices?.[s.id];
          return !cfg || cfg.enabled !== false;
        });
        if (firstAvailable) {
          const price = selectedShop.offeredServices?.[firstAvailable.id]?.price ?? firstAvailable.basePrice;
          setSelectedService({ ...firstAvailable, basePrice: price });
        }
      } else if (shopSvc && shopSvc.price !== undefined) {
        // Also update price if it changed
        setSelectedService(prev => ({ ...prev, basePrice: shopSvc.price }));
      }
    }
  }, [selectedShop]);

  React.useEffect(() => {
    if (route.params?.serviceId) {
      const service = SERVICES.find(s => s.id === route.params.serviceId);
      if (service) setSelectedService(service);
    }
    if (route.params?.plate) {
      setCarPlate(route.params.plate);
    }

    // Load forecast
    const loadForecast = async () => {
      const loc = await getUserLocation();
      const data = await fetchForecastByCoords(loc.coords.latitude, loc.coords.longitude);
      if (data && data.list) {
        setForecast(data.list);
      }
    };
    loadForecast();
  }, [route.params]);

  // Check for rain when date changes
  React.useEffect(() => {
    if (selectedDate && forecast.length > 0) {
      const selectedDayStr = selectedDate.value; // YYYY-MM-DD
      const rainySlots = forecast.filter(item => {
        const itemDate = item.dt_txt.split(' ')[0];
        return itemDate === selectedDayStr && item.weather[0].main.toLowerCase().includes('rain');
      });

      if (rainySlots.length > 0) {
        setRainWarning(`Warning: Rain predicted for ${selectedDate.label}. Consider rescheduling!`);
      } else {
        setRainWarning(null);
      }
    } else {
      setRainWarning(null);
    }
  }, [selectedDate, forecast]);

  // 动态计算总价
  const totalPrice = selectedService.basePrice + selectedCarType.surcharge;

  const handleBooking = async () => {
    // 强制登录检查
    if (!auth.currentUser) {
      Alert.alert(
        "Login Required",
        "You need to sign in to book a car wash service.",
        [
          { text: "Later", style: "cancel" },
          { text: "Login Now", onPress: () => navigation.navigate('Login') }
        ]
      );
      return;
    }

    if (!carPlate.trim()) {
      Alert.alert("Notice", "Please enter your car plate number");
      return;
    }
    // 检查是否选择了过去的时间
    if (selectedDate?.label === 'Today') {
        const now = new Date();
        const [h, m] = selectedTime.split(':').map(Number);
        const slotTime = new Date();
        slotTime.setHours(h, m, 0, 0);
        if (slotTime < now) {
            Alert.alert("Time Expired", "This time slot has already passed. Please pick a later time.");
            return;
        }
    }

    setIsSubmitting(true);
    try {
      // Re-verify the shop selection just before submitting
      const finalShop = selectedShop;
      if (!finalShop) throw new Error("No shop selected");

      const bookingData = {
        carPlate: carPlate.trim().toUpperCase(),
        bookingDate: selectedDate.value,
        bookingTime: selectedTime,
        carType: selectedCarType.name,
        serviceType: selectedService.name,
        basePrice: selectedService.basePrice,
        surcharge: selectedCarType.surcharge,
        price: totalPrice,
        status: "Pending",
        currentStep: 0,
        userId: auth.currentUser?.uid || 'user_unknown',
        shopId: finalShop.id,
        shopName: finalShop.shopName,
        createdAt: new Date().toISOString(),
      };

      console.log("📤 Submitting booking to:", bookingData.shopName, "(ID:", bookingData.shopId, ")");

      const orderId = "BKG" + Date.now();
      const docRef = doc(collection(db, "bookings"), orderId);
      await setDoc(docRef, bookingData);

      Alert.alert(
        "Booking Successful",
        `ID: ${orderId}\nTime: ${selectedDate.label} ${selectedTime}\nService: ${selectedService.name}\nCar Type: ${selectedCarType.name}\nPlate: ${bookingData.carPlate}\nTotal: RM${totalPrice}`,
        [{
          text: "OK", onPress: () => {
            // 清空表单以便下次预约
            setCarPlate('');
            setSelectedDate(null);
            setSelectedTime(null);
            setSelectedCarType(CAR_TYPES[0]);
            setSelectedService(SERVICES[0]);
          }
        }]
      );
    } catch (e) {
      console.error("增加文档出错: ", e);
      Alert.alert("Booking Failed", "Network error occurred, please try again");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />
        }
      >
        <View style={[styles.shopHeader, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <Ionicons name="storefront" size={24} color={theme.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.shopNameText, { color: theme.text }]}>{selectedShop?.shopName || 'Finding Shop...'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Text style={{ fontSize: 12, color: theme.subText }}>{selectedShop?.distance?.toFixed(1)} km away</Text>
              
              {/* Facility Icons integrated here */}
              {selectedShop?.facilities?.length > 0 && (
                <View style={{ flexDirection: 'row', marginLeft: 10, gap: 4 }}>
                  {selectedShop.facilities.map(f => {
                    const icons = { cafe: 'cafe', wifi: 'wifi', lounge: 'tv', parking: 'car', snack: 'pizza' };
                    return (
                      <Ionicons key={f} name={icons[f] || 'star'} size={12} color={theme.primary} />
                    );
                  })}
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.changeShopBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={16} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* 0. Select Shop List */}
        {nearbyShops.length > 0 && (
          <View style={styles.shopListSection}>
            <Text style={[styles.sectionTitle, { color: theme.text, marginLeft: 15 }]}>Nearby Shops (within 60km)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shopListScroll}>
              {nearbyShops.map((shop) => {
                const isActive = selectedShop?.id === shop.id;
                return (
                  <TouchableOpacity
                    key={shop.id}
                    style={[
                      styles.shopListItem,
                      { backgroundColor: theme.card, borderColor: theme.border },
                      isActive && { borderColor: theme.primary, backgroundColor: theme.primary + '10' }
                    ]}
                    onPress={() => {
                      setSelectedShop(shop);
                      setDistance(shop.distance);
                      setIsShopClosed(shop.isOpen === false);
                    }}
                  >
                    <Ionicons name="location" size={16} color={isActive ? theme.primary : theme.subText} />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={[styles.shopListLabel, { color: theme.text }, isActive && { fontWeight: 'bold', color: theme.primary }]} numberOfLines={1}>
                        {shop.shopName}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.subText }}>{shop.distance?.toFixed(1)} km</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
        <Text style={[styles.pageTitle, { color: theme.text }]}>Customize Your Wash</Text>

        {/* 距离校验状态展示 */}
        <View style={[styles.rangeWarningBox, isOutOfRange && { backgroundColor: '#FFF5F5', borderColor: '#FFD1D1' }]}>
          {distance === null && !isOutOfRange ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={{ marginLeft: 12, color: '#4A5568', fontSize: 14 }}>Finding nearby shops within 60km...</Text>
            </View>
          ) : isOutOfRange ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="warning" size={20} color="#E53E3E" />
              <Text style={[styles.rangeHeaderText, { color: '#E53E3E' }]}>No shops found within 60km</Text>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons 
                  name={isShopClosed ? "time-outline" : "location-outline"} 
                  size={20} 
                  color={isShopClosed ? "#E53E3E" : "#38A169"} 
                />
                <Text style={[styles.rangeHeaderText, { color: isShopClosed ? "#E53E3E" : "#38A169" }]}>
                  {isShopClosed ? "Shop is Currently Closed" : "Ready for Booking"}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginLeft: 28 }}>
                <Text style={{ fontSize: 14, color: '#4A5568' }}>
                  Nearby: <Text style={{ fontWeight: 'bold' }}>{nearbyShops.length} shops found</Text>
                </Text>
              </View>
            </>
          )}
        </View>

        {/* 1. 车牌号码输入 */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>1. Car Plate Number</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            placeholder="e.g. JRD 1234"
            placeholderTextColor={theme.subText}
            value={carPlate}
            onChangeText={setCarPlate}
            autoCapitalize="characters"
          />
        </View>

        {/* 2. 选择预约日期 */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>2. Booking Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateScroll}>
            {AVAILABLE_DATES.map((d) => {
              const isActive = selectedDate && selectedDate.id === d.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.dateCard, 
                    { backgroundColor: theme.background, borderColor: theme.border }, 
                    isActive && [styles.activeCard, isDark && { backgroundColor: '#002C59', borderColor: '#FFD60A' }]
                  ]}
                  onPress={() => setSelectedDate(d)}
                >
                  <Text style={[styles.dateLabel, { color: theme.subText }, isActive && styles.activeText]}>{d.label}</Text>
                  <Text style={[styles.dateStr, { color: theme.text }, isActive && styles.activeSubText]}>{d.dateStr}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          
          {rainWarning && (
            <View style={[styles.warningBox, isDark && { backgroundColor: '#3b2500', borderColor: '#8c5900' }]}>
              <Ionicons name="rainy" size={18} color="#FF9500" />
              <Text style={[styles.warningText, isDark && { color: '#ffbd59' }]}>{rainWarning}</Text>
            </View>
          )}
        </View>

        {/* 3. 选择预约时间 */}
        <View style={[styles.section, { backgroundColor: theme.card, padding: 15, borderRadius: 12 }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>3. Time (Estimated 1 hour)</Text>
          <View style={styles.timeGrid}>
            {AVAILABLE_TIMES.map((t) => {
              const isActive = selectedTime === t;
              
              let isPast = false;
              if (selectedDate?.label === 'Today') {
                const now = new Date();
                const [h, m] = t.split(':').map(Number);
                const slotTime = new Date();
                slotTime.setHours(h, m, 0, 0);
                if (slotTime < now) isPast = true;
              }

              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.timeCard, 
                    { backgroundColor: theme.background, borderColor: theme.border },
                    isActive && [styles.activeCard, isDark && { backgroundColor: '#002C59', borderColor: '#FFD60A' }],
                    isPast && { backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0', borderColor: isDark ? '#333' : '#eee' }
                  ]}
                  onPress={() => !isPast && setSelectedTime(t)}
                  disabled={isPast}
                >
                  <Text style={[
                    styles.timeText, 
                    { color: theme.text },
                    isActive && styles.activeText,
                    isPast && { color: isDark ? '#555' : '#bbb' }
                  ]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 4. 选择车型 */}
        <View style={[styles.section, { backgroundColor: theme.card, padding: 15, borderRadius: 12 }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>4. Car Type</Text>
          <View style={styles.carTypeRow}>
            {CAR_TYPES.map((type) => {
              const isActive = selectedCarType.id === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.carTypeCard, 
                    { backgroundColor: theme.background, borderColor: theme.border },
                    isActive && [styles.activeCard, isDark && { backgroundColor: '#002C59', borderColor: '#FFD60A' }]
                  ]}
                  onPress={() => setSelectedCarType(type)}
                >
                  <Text style={[styles.carTypeText, { color: theme.text }, isActive && styles.activeText]}>
                    {type.name}
                  </Text>
                  <Text style={[styles.surchargeText, { color: theme.subText }, isActive && styles.activeSubText]}>
                    {type.surcharge === 0 ? 'No Surcharge' : `+ RM${type.surcharge}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 5. 选择服务项目 */}
        <View style={[styles.section, { backgroundColor: theme.card, padding: 15, borderRadius: 12 }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>5. Wash Service</Text>
          {SERVICES.map((service) => {
            const shopSvc = selectedShop?.offeredServices?.[service.id];
            
            // Determine availability
            const isAvailable = selectedShop ? (shopSvc?.enabled !== false) : true;
            
            // Use shop's custom price if available, otherwise fallback to default
            const displayPrice = shopSvc?.price !== undefined ? shopSvc.price : service.basePrice;
            const isActive = selectedService.id === service.id;
            
            return (
              <TouchableOpacity
                key={service.id}
                disabled={!isAvailable}
                style={[
                  styles.serviceCard, 
                  { backgroundColor: theme.background, borderColor: theme.border },
                  isActive && [styles.activeCard, isDark && { backgroundColor: '#002C59', borderColor: '#FFD60A' }],
                  !isAvailable && { opacity: 0.4, backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0' }
                ]}
                onPress={() => setSelectedService({ ...service, basePrice: displayPrice })}
              >
                <View style={styles.serviceHeader}>
                  <Text style={[
                    styles.serviceName, 
                    { color: theme.text }, 
                    isActive && styles.activeText,
                    !isAvailable && { color: theme.subText }
                  ]}>
                    {service.name} {!isAvailable && '(Off)'}
                  </Text>
                  <Text style={[
                    styles.servicePrice, 
                    { color: theme.primary }, 
                    isActive && styles.activeText,
                    !isAvailable && { color: theme.subText }
                  ]}>
                    {isAvailable ? `RM ${displayPrice}` : 'N/A'}
                  </Text>
                </View>
                <Text style={[
                  styles.serviceDesc, 
                  { color: theme.subText }, 
                  isActive && styles.activeSubText,
                  !isAvailable && { color: '#999' }
                ]}>
                  {isAvailable ? service.desc : 'This service is currently not offered by this shop.'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 底部留白，防止内容被绝对定位的按钮遮挡 */}
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* 固定在底部的总计明细与预约按钮 */}
      <View style={[styles.bottomBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <View style={styles.priceContainer}>
          <Text style={[styles.totalLabel, { color: theme.subText }]}>Total</Text>
          <Text style={[styles.totalPrice, { color: '#FF3B30' }]}>RM {totalPrice}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.submitBtn, 
            (isSubmitting || !auth.currentUser || isOutOfRange || isShopClosed) && { backgroundColor: theme.border }
          ]}
          onPress={handleBooking}
          disabled={isSubmitting || isOutOfRange || isShopClosed}
        >
          <Text style={[styles.submitText, (isSubmitting || !auth.currentUser || isOutOfRange || isShopClosed) && { color: theme.subText }]}>
            {isSubmitting ? 'Submitting...' : 
             !auth.currentUser ? 'Login to Book' : 
             isShopClosed ? 'Shop Closed' :
             isOutOfRange ? 'Out of Range' : 'Book Now'}
          </Text>
        </TouchableOpacity>
      </View>


    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  shopHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, marginHorizontal: 15, marginTop: 15, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 },
  shopNameText: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginLeft: 10 },
  rangeWarningBox: { margin: 15, padding: 15, borderRadius: 12, backgroundColor: '#F0FFF4', borderWidth: 1, borderColor: '#C6F6D5' },
  rangeHeaderText: { fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  distText: { fontSize: 14, color: '#4A5568', marginTop: 4, marginLeft: 28 },
  rangeSubText: { fontSize: 12, color: '#E53E3E', marginTop: 4, marginLeft: 28 },
  scrollContent: { padding: 20, paddingTop: 40 },
  pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 25 },

  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  warningText: {
    color: '#E65100',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },

  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e1e4e8',
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05,
  },

  dateScroll: { flexDirection: 'row', gap: 10, paddingRight: 20 },
  dateCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#e1e4e8',
    alignItems: 'center',
    marginRight: 10,
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05,
  },
  dateLabel: { fontSize: 13, color: '#888', marginBottom: 4 },
  dateStr: { fontSize: 16, fontWeight: 'bold', color: '#333' },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#e1e4e8',
    alignItems: 'center',
    elevation: 1,
    width: '30%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05,
  },
  timeText: { fontSize: 16, fontWeight: '600', color: '#333' },

  carTypeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  carTypeCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e1e4e8',
    alignItems: 'center',
    elevation: 1,
    justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05,
  },
  carTypeText: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 4, textAlign: 'center' },
  surchargeText: { fontSize: 11, color: '#888' },

  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e1e4e8',
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05,
  },
  serviceHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  serviceName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  servicePrice: { fontSize: 16, fontWeight: 'bold', color: '#007AFF' },
  serviceDesc: { fontSize: 13, color: '#666', lineHeight: 18 },

  activeCard: { borderColor: '#007AFF', backgroundColor: '#f0f7ff' },
  activeText: { color: '#007AFF' },
  activeSubText: { color: '#005bb5' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 30, // iPhone 或全面屏底部留海预留
    borderTopWidth: 1, borderTopColor: '#eee',
    elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  priceContainer: { flex: 1, justifyContent: 'center' },
  totalLabel: { fontSize: 13, color: '#666', marginBottom: 2 },
  totalPrice: { fontSize: 24, fontWeight: 'bold', color: '#FF3B30' },

  submitBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledBtn: { backgroundColor: '#a0cfff' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  changeShopBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF15',
  },
  facilitiesRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -10,
    marginBottom: 10,
    gap: 8,
  },
  facilityIconSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopListSection: {
    marginTop: 15,
  },
  shopListScroll: {
    paddingHorizontal: 15,
    paddingBottom: 5,
    gap: 12,
  },
  shopListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 15,
    borderWidth: 1,
    minWidth: 160,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  shopListLabel: {
    fontSize: 14,
    marginBottom: 2,
  }
});