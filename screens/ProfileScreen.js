import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, Modal, TextInput, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { doc, getDoc, updateDoc, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { Colors } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { theme, isDark, toggleTheme } = useTheme();

  const [currentUid, setCurrentUid] = useState(auth.currentUser?.uid);
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMerchant, setIsMerchant] = useState(false);
  const [modeAlert, setModeAlert] = useState(null);

  // --- 新增：车辆管理相关的状态 ---
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [newType, setNewType] = useState('Car');
  const [newPreference, setNewPreference] = useState('basic');
  const [isAdding, setIsAdding] = useState(false);

  // 洗车偏好选项定义
  const PREFS = [
    { id: 'basic', label: 'Standard Wash' },
    { id: 'premium', label: 'Premium Wax' },
    { id: 'interior', label: 'Interior Deep Clean' },
    { id: 'full', label: 'Full Detail' },
  ];

  useFocusEffect(
    useCallback(() => {
      const liveUid = auth.currentUser?.uid;
      setCurrentUid(liveUid);

      if (!liveUid) {
        setIsLoading(false);
        return;
      }
      
      // --- 核心逻辑：获取用户云端数据与商家身份验证 ---
      const fetchUserData = async () => {
        setIsLoading(true);
        try {
          // 1. 从 Firestore 读取用户的基本资料（姓名、电话、当前模式等）
          const userRef = doc(db, 'users', liveUid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const data = userSnap.data();
            setUserData(data);

            // 2. 权限校验：检查当前用户的邮箱是否在 'shops' 集合中被登记为 ownerEmail
            // 只要匹配成功，就说明该用户是商家，从而显示“切换模式”的开关
            const q = query(collection(db, "shops"), where("ownerEmail", "==", auth.currentUser.email.toLowerCase()));
            const shopSnap = await getDocs(q);
            setIsMerchant(!shopSnap.empty);
          } else {
            // 如果新用户还没有文档，设置默认初始数据
            setUserData({
              name: "New User",
              phone: "+60 00-000 0000",
              points: 0,
              vehicles: []
            });
          }
        } catch (error) {
          console.error("加载用户信息失败:", error);
          Alert.alert("Error", "Cannot connect to cloud database");
        } finally {
          setIsLoading(false);
        }
      };

      fetchUserData();
    }, [currentUid])
  );

  // --- 核心动作：添加车辆到云端 ---
  const handleAddVehicle = async () => {
    if (!newPlate.trim()) {
      Alert.alert("Notice", "Please enter plate number");
      return;
    }

    setIsAdding(true);
    try {
      const userRef = doc(db, 'users', currentUid);
      const vehicleData = {
        id: Date.now().toString(),
        plate: newPlate.trim().toUpperCase(),
        type: newType,
        preferenceId: newPreference,
        icon: newType === 'Car' ? 'car-sport-outline' : 'bicycle-outline'
      };
      
      // 1. 同步到 Firestore
      await updateDoc(userRef, {
        vehicles: arrayUnion(vehicleData)
      });
      
      // 2. 更新本地 UI 状态
      setUserData(prev => ({
        ...prev,
        vehicles: [...(prev.vehicles || []), vehicleData]
      }));
      
      // 3. 重置表单
      setIsModalVisible(false);
      setNewPlate('');
      Alert.alert("Success", "Vehicle added to your garage!");
    } catch (error) {
      console.error("Add vehicle error:", error);
      Alert.alert("Error", "Failed to add vehicle");
    } finally {
      setIsAdding(false);
    }
  };

  // --- 核心动作：身份/视图切换 ---
  const toggleUserMode = async () => {
    try {
        // 计算切换后的新模式
        const newMode = userData.currentMode === 'merchant' ? 'user' : 'merchant';
        
        // 先弹出提示框，用户点击 OK 后再更新数据库（避免页面瞬间销毁导致提示框一闪而过）
        setModeAlert({
          title: "Switch Mode",
          message: `You are about to switch to ${newMode === 'merchant' ? 'Merchant' : 'Customer'} view.`,
          newMode: newMode
        });
    } catch (e) {
        Alert.alert("Error", "Failed to switch mode: " + e.message);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out of your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut(auth);
              setCurrentUid(null);
              setUserData(null);
            } catch (error) {
              console.error("登出失败:", error);
              Alert.alert('Error', 'Logout failed: ' + error.message);
            }
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary || "#007AFF"} />
        <Text style={{ marginTop: 10, color: theme.subText }}>Syncing with cloud...</Text>
      </View>
    );
  }

  const vehicles = userData?.vehicles || [];

  if (!currentUid) {
    return (
      <View style={[styles.guestContainer, { backgroundColor: theme.background }]}>
        <View style={styles.guestHeader}>
          <View style={[styles.guestAvatarPlaceholder, { backgroundColor: isDark ? '#333' : '#ddd' }]}>
            <Ionicons name="person" size={60} color={isDark ? '#666' : '#fff'} />
          </View>
          <Text style={[styles.guestTitle, { color: theme.text }]}>Welcome back!</Text>
          <Text style={[styles.guestSub, { color: theme.subText }]}>Login to manage your vehicles and view order history</Text>
        </View>

        <TouchableOpacity 
          style={[styles.guestLoginBtn, { backgroundColor: theme.primary || '#007AFF' }]} 
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.guestLoginText}>Login / Get Started</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>

        <View style={styles.guestFeatures}>
          <View style={styles.featureItem}>
            <Ionicons name="gift-outline" size={24} color={theme.primary || "#007AFF"} />
            <Text style={[styles.featureText, { color: theme.text }]}>Accumulate points for rewards</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="stats-chart-outline" size={24} color={theme.primary || "#007AFF"} />
            <Text style={[styles.featureText, { color: theme.text }]}>Monitor wash progress live</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="shield-checkmark-outline" size={24} color={theme.primary || "#007AFF"} />
            <Text style={[styles.featureText, { color: theme.text }]}>Secure service digitization</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.headerSection, { backgroundColor: theme.card }]}>
        <Image
          source={{ uri: userData?.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: theme.text }]}>{userData?.name || 'Unnamed User'}</Text>
          <Text style={[styles.userPhone, { color: theme.subText }]}>{userData?.phone || 'No Phone Linked'}</Text>
        </View>
        <TouchableOpacity style={[styles.editBtn, isDark && { backgroundColor: 'rgba(10,132,255,0.1)' }]} onPress={() => navigation.navigate('EditProfile')}>
          <Ionicons name="create-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.orderSection, { backgroundColor: theme.card }]}>
        <TouchableOpacity style={styles.orderItem} onPress={() => navigation.navigate('History', { initialTab: 'Pending' })}>
          <View style={[styles.iconCircle, isDark && { backgroundColor: 'rgba(10,132,255,0.1)' }]}>
            <Ionicons name="time-outline" size={24} color={theme.primary} />
          </View>
          <Text style={[styles.orderItemText, { color: theme.text }]}>Pending</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.orderItem} onPress={() => navigation.navigate('History', { initialTab: 'In Progress' })}>
          <View style={[styles.iconCircle, isDark && { backgroundColor: 'rgba(10,132,255,0.1)' }]}>
            <Ionicons name="sync-outline" size={24} color={theme.primary} />
          </View>
          <Text style={[styles.orderItemText, { color: theme.text }]}>In Prog</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.orderItem} onPress={() => navigation.navigate('History', { initialTab: 'Completed' })}>
          <View style={[styles.iconCircle, isDark && { backgroundColor: 'rgba(10,132,255,0.1)' }]}>
            <Ionicons name="checkmark-done-circle-outline" size={24} color={theme.primary} />
          </View>
          <Text style={[styles.orderItemText, { color: theme.text }]}>Completed</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>My Garage</Text>
          <TouchableOpacity style={[styles.addBtn, isDark && { backgroundColor: 'rgba(10,132,255,0.1)' }]} onPress={() => setIsModalVisible(true)}>
            <Ionicons name="add" size={16} color={theme.primary} />
            <Text style={[styles.addBtnText, { color: theme.primary }]}>Add Vehicle</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.garageScroll}>
          {vehicles.length > 0 ? (
            vehicles.map((v) => (
              <TouchableOpacity 
                key={v.id || v.plate} 
                style={[styles.vehicleCard, { backgroundColor: theme.card }]}
                onPress={() => navigation.navigate('Book', { plate: v.plate, serviceId: v.preferenceId || 'basic' })}
              >
                <View style={[styles.vehicleIconWrapper, isDark && { backgroundColor: '#1a1a1a' }]}>
                  <Ionicons name={v.icon || 'car-sport-outline'} size={28} color={theme.primary} />
                </View>
                <View style={styles.vehicleInfo}>
                  <Text style={[styles.vehiclePlate, { color: theme.text }]}>{v.plate}</Text>
                  <Text style={[styles.vehicleType, { color: theme.subText }]}>
                    {v.type} • {PREFS.find(p => p.id === v.preferenceId)?.label || 'Standard Wash'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={{ color: theme.subText, marginVertical: 15, paddingLeft: 20 }}>
              No vehicles found, click above to add!
            </Text>
          )}
        </ScrollView>
      </View>

      <View style={[styles.settingsSection, { backgroundColor: theme.card, marginHorizontal: 20, borderRadius: 16, padding: 10, marginBottom: 20 }]}>
        <Text style={[styles.sectionTitle, { color: theme.text, marginLeft: 10, marginBottom: 10 }]}>Account Management</Text>
        
        {isMerchant && (
          <TouchableOpacity style={[styles.settingsItem, { borderBottomWidth: 1, borderBottomColor: theme.border }]} onPress={toggleUserMode}>
            <View style={styles.settingsItemLeft}>
              <Ionicons name="swap-horizontal" size={22} color="#FF9500" />
              <Text style={[styles.settingsItemText, { color: theme.text }]}>
                {userData?.currentMode === 'merchant' ? 'Switch to Customer Mode' : 'Switch to Merchant Mode'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.border} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.settingsItem} onPress={() => navigation.navigate('EditProfile')}>
          <View style={styles.settingsItemLeft}>
            <Ionicons name="person-circle-outline" size={22} color={theme.subText} />
            <Text style={[styles.settingsItemText, { color: theme.text }]}>Edit Profile Info</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.border} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.settingsItem}>
          <View style={styles.settingsItemLeft}>
            <Ionicons name={userData?.theme === 'dark' ? "moon" : "moon-outline"} size={22} color={userData?.theme === 'dark' ? "#FFD60A" : theme.subText} />
            <Text style={[styles.settingsItemText, { color: theme.text }]}>Dark Mode</Text>
          </View>
          <Switch 
            value={isDark} 
            onValueChange={toggleTheme}
            trackColor={{ false: theme.border, true: "#007AFF" }}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 50 }} />

      <Modal visible={isModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add New Vehicle</Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: isDark ? '#3A3A3C' : '#f8f8f8', color: theme.text, borderColor: theme.border }]}
              placeholder="Enter plate number (e.g. JRD 1234)"
              placeholderTextColor={theme.subText}
              value={newPlate}
              onChangeText={setNewPlate}
              autoCapitalize="characters"
            />

            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeBtn, { backgroundColor: isDark ? '#3A3A3C' : '#f0f0f0' }, newType === 'Car' && styles.typeBtnActive]}
                onPress={() => setNewType('Car')}
              >
                <Text style={[styles.typeBtnText, { color: theme.subText }, newType === 'Car' && styles.typeBtnTextActive]}>Car</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, { backgroundColor: isDark ? '#3A3A3C' : '#f0f0f0' }, newType === 'Motorcycle' && styles.typeBtnActive]}
                onPress={() => setNewType('Motorcycle')}
              >
                <Text style={[styles.typeBtnText, { color: theme.subText }, newType === 'Motorcycle' && styles.typeBtnTextActive]}>Motorcycle</Text>
              </TouchableOpacity>
            </View>

            <Text style={{fontSize: 14, color: theme.text, marginBottom: 8, fontWeight: '600'}}>Wash Preference</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20}}>
              {PREFS.map(pref => (
                <TouchableOpacity 
                   key={pref.id}
                   style={[styles.typeBtn, {marginBottom: 8, width: '48%', marginHorizontal: 0, backgroundColor: isDark ? '#3A3A3C' : '#f0f0f0'}, newPreference === pref.id && styles.typeBtnActive]}
                   onPress={() => setNewPreference(pref.id)}
                >
                   <Text style={[styles.typeBtnText, {fontSize: 13, color: theme.subText}, newPreference === pref.id && styles.typeBtnTextActive]}>{pref.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: isDark ? '#3A3A3C' : '#f5f5f5' }]}
                onPress={() => { setIsModalVisible(false); setNewPlate(''); }}
                disabled={isAdding}
              >
                <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, isAdding && { opacity: 0.7 }]}
                onPress={handleAddVehicle}
                disabled={isAdding}
              >
                {isAdding ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Mode Switch Custom Alert Modal */}
      <Modal visible={!!modeAlert} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: 300, backgroundColor: theme.card, borderRadius: 16, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.1, shadowRadius: 10, elevation: 5 }}>
            <Ionicons name={modeAlert?.title === 'Error' ? "alert-circle" : "checkmark-circle"} size={50} color={modeAlert?.title === 'Error' ? "#FF3B30" : theme.primary || "#007AFF"} style={{ marginBottom: 15 }} />
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text, marginBottom: 10 }}>{modeAlert?.title}</Text>
            <Text style={{ fontSize: 16, color: theme.subText, textAlign: 'center', marginBottom: 25, lineHeight: 22 }}>
              {modeAlert?.message}
            </Text>
            <TouchableOpacity 
              style={{ paddingVertical: 12, paddingHorizontal: 30, backgroundColor: theme.primary || '#007AFF', borderRadius: 8, width: '100%', alignItems: 'center' }} 
              onPress={async () => {
                const pendingMode = modeAlert?.newMode;
                setModeAlert(null);
                if (pendingMode) {
                  try {
                    await updateDoc(doc(db, 'users', currentUid), {
                        currentMode: pendingMode
                    });
                    setUserData(prev => ({ ...prev, currentMode: pendingMode }));
                  } catch (e) {
                    Alert.alert("Error", "Failed to switch mode: " + e.message);
                  }
                }
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },

  // 头部区域
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eee',
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 14,
    color: '#888',
  },
  editBtn: {
    padding: 8,
    backgroundColor: '#f0f7ff',
    borderRadius: 20,
  },



  // 快捷订单入口
  orderSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5,
    marginBottom: 25,
  },
  orderItem: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderItemText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
  },

  // 我的车库
  section: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f0fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  addBtnText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  garageScroll: {
    paddingLeft: 20,
    paddingRight: 10,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginRight: 10,
    width: 220,
    elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5,
  },
  vehicleIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f7fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehiclePlate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  vehicleType: {
    fontSize: 13,
    color: '#888',
  },

  // 设置列表
  settingsSection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 16,
    paddingHorizontal: 20,
    elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5,
    marginBottom: 30,
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsItemText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },

  // 退出登录
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    backgroundColor: '#ffebee',
    paddingVertical: 16,
    borderRadius: 16,
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  // 模态框样式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  typeBtnActive: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f7ff',
  },
  typeBtnText: {
    color: '#666',
    fontWeight: '600',
  },
  typeBtnTextActive: {
    color: '#007AFF',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginRight: 10,
  },
  modalCancelText: {
    color: '#666',
    fontWeight: '600',
  },
  modalSubmitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalSubmitText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // Guest UI Styles
  guestContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 30,
    justifyContent: 'center',
  },
  guestHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  guestAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  guestTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 10,
  },
  guestSub: {
    fontSize: 15,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  guestLoginBtn: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  guestLoginText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  guestFeatures: {
    gap: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
  },
  featureText: {
    marginLeft: 15,
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  }
});