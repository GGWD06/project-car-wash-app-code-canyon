import React, { useState, useEffect, createContext, useContext } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { onAuthStateChanged, sendEmailVerification } from 'firebase/auth';
import { auth, db } from './firebaseConfig';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { Alert, TouchableOpacity, Text } from 'react-native';
import { Colors } from './constants/Colors';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// 页面导入
import HomeScreen from './screens/HomeScreen';
import BookingScreen from './screens/BookingScreen';
import ProfileScreen from './screens/ProfileScreen';
import HistoryScreen from './screens/HistoryScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import LoginScreen from './screens/LoginScreen';
import OTPScreen from './screens/OTPScreen';
import SecurityScreen from './screens/SecurityScreen';
import PolicyScreen from './screens/PolicyScreen';
import MerchantDashboard from './screens/MerchantDashboard';
import WorkerActionScreen from './screens/WorkerActionScreen';
import MerchantSettingsScreen from './screens/MerchantSettingsScreen';

import { ThemeProvider, useTheme } from './context/ThemeContext';

// --- 导航实例 ---
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// --- 导航子组件 ---
function MainTabs() {
  const { theme, isDark } = useTheme();
  return (
    <Tab.Navigator
      sceneContainerStyle={{ backgroundColor: theme.background }}
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: isDark ? theme.tabBar : '#007AFF' },
        headerTintColor: '#fff',
        headerTitleAlign: 'center',
        tabBarIcon: ({ focused, size }) => {
          let iconName;
          if (route.name === 'Home')   iconName = focused ? 'home' : 'home-outline';
          if (route.name === 'Book')   iconName = focused ? 'car' : 'car-outline';
          if (route.name === 'History') iconName = focused ? 'time' : 'time-outline';
          if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          const iconColor = focused ? (isDark ? '#FFD60A' : '#007AFF') : theme.subText;
          return <Ionicons name={iconName} size={size} color={iconColor} />;
        },
        tabBarActiveTintColor: isDark ? '#FFD60A' : '#007AFF',
        tabBarInactiveTintColor: theme.subText,
        tabBarStyle: { 
          backgroundColor: theme.tabBar, 
          borderTopColor: theme.border,
          display: 'flex'
        }
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Book" component={BookingScreen} options={{ title: 'Book' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

function MerchantTabs() {
  const { theme, isDark } = useTheme();
  return (
    <Tab.Navigator
      sceneContainerStyle={{ backgroundColor: theme.background }}
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: isDark ? theme.tabBar : '#007AFF' },
        headerTintColor: '#fff',
        headerTitleAlign: 'center',
        tabBarIcon: ({ focused, size }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = focused ? 'file-tray-full' : 'file-tray-full-outline';
          if (route.name === 'Profile')   iconName = focused ? 'person' : 'person-outline';
          const iconColor = focused ? (isDark ? '#FFD60A' : '#007AFF') : theme.subText;
          return <Ionicons name={iconName} size={size} color={iconColor} />;
        },
        tabBarActiveTintColor: isDark ? '#FFD60A' : '#007AFF',
        tabBarInactiveTintColor: theme.subText,
        tabBarStyle: { 
          backgroundColor: theme.tabBar, 
          borderTopColor: theme.border,
          display: 'flex'
        }
      })}
    >
      <Tab.Screen name="Dashboard" component={MerchantDashboard} options={{ title: 'Merchant Hub' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}

function MainApp() {
  // --- 状态管理 ---
  const [user, setUser] = useState(null); // 存储 Firebase Auth 的当前登录用户对象
  const [initializing, setInitializing] = useState(true); // 用于在 Auth 状态初始加载时显示 Loading 画面
  const [userRole, setUserRole] = useState('user'); // 存储用户视图模式：'user' (顾客) 或 'merchant' (商家)
  const { theme, isDark } = useTheme(); // 从上下文获取全局主题（深色/浅色）

  // --- 监听登录状态 (Firebase Auth) ---
  useEffect(() => {
    // 监听用户登录、退出或令牌刷新
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      if (initializing) setInitializing(false); // 一旦拿到用户状态，关闭初始化 Loading
    });
    return unsubscribe;
  }, []);

  // --- 监听用户数据与模式 (Firestore) ---
  useEffect(() => {
    if (user) {
      // 实时监听 Firestore 中 users 集合下该 UID 的文档
      const userDocRef = doc(db, 'users', user.uid);
      const unsubscribeMode = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          // currentMode 决定了用户当前处于什么视图，这在 Profile 页面可以手动切换
          setUserRole(data.currentMode || 'user');
        }
      });
      return unsubscribeMode;
    } else {
      setUserRole('user'); // 未登录时默认为顾客模式
    }
  }, [user]);

  // 初始化加载时的 Loading 界面
  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={isDark ? theme.primary : '#007AFF'} />
      </View>
    );
  }

  // 为 React Navigation 配置全局颜色主题
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.background,
      card: theme.card,
    },
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            contentStyle: { backgroundColor: theme.background },
            headerStyle: { 
              // 导航栏背景：深色模式或商家模式下使用深灰色，普通用户模式下使用蓝色
              backgroundColor: isDark ? '#1C1C1E' : (userRole === 'merchant' ? '#1C1C1E' : '#007AFF') 
            },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
            headerBackTitleVisible: false,
            animation: 'fade', // 切换根页面时使用渐变效果，视觉更平滑
          }}
        >
          {!user ? (
            // --- 场景 A: 用户未登录 ---
            <>
              <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            </>
          ) : !user.emailVerified ? (
            // --- 场景 B: 用户已登录但未验证邮箱 ---
            // 这是一个“门禁系统”，不验证邮箱无法进入主功能区
            <Stack.Screen name="Verification" options={{ title: 'Verify Email' }}>
              {() => (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                  <Ionicons name="mail-unread-outline" size={80} color="#007AFF" />
                  <Text style={{ fontSize: 24, fontWeight: 'bold', marginTop: 20, color: theme.text }}>Verify Your Email</Text>
                  <Text style={{ textAlign: 'center', marginTop: 15, color: theme.subText, lineHeight: 22 }}>
                    We've sent a verification link to <Text style={{fontWeight: 'bold'}}>{user.email}</Text>. 
                    Please check your inbox and click the link to continue.
                  </Text>
                  
                  {/* 手动触发状态同步：用户点击邮件链接后，点击此按钮刷新 App 状态 */}
                  <TouchableOpacity 
                    style={{ backgroundColor: '#007AFF', padding: 15, borderRadius: 12, width: '100%', alignItems: 'center', marginTop: 40 }}
                    onPress={() => {
                      auth.currentUser.reload().then(() => {
                        if (auth.currentUser.emailVerified) {
                          setUser({ ...auth.currentUser }); // 验证成功，强制触发 React 状态更新
                        } else {
                          Alert.alert("Not Verified", "Please click the link in your email first.");
                        }
                      });
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>I've Verified</Text>
                  </TouchableOpacity>
                  
                  {/* 重发验证邮件 */}
                  <TouchableOpacity 
                    style={{ marginTop: 20 }}
                    onPress={() => {
                      sendEmailVerification(auth.currentUser);
                      Alert.alert("Success", "Verification email resent!");
                    }}
                  >
                    <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>Resend Email</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={{ marginTop: 40 }}
                    onPress={() => auth.signOut()}
                  >
                    <Text style={{ color: '#FF3B30' }}>Sign Out</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Stack.Screen>
          ) : userRole === 'user' ? (
            // --- 场景 C: 普通顾客视图 ---
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          ) : (
            // --- 场景 D: 商家管理视图 ---
            <Stack.Screen name="MerchantTabs" component={MerchantTabs} options={{ headerShown: false }} />
          )}
          
          {/* --- 公用独立页面 (在任何模式下都可以跳转) --- */}
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
          <Stack.Screen name="WorkerAction" component={WorkerActionScreen} options={{ title: 'Update Status' }} />
          <Stack.Screen name="Security" component={SecurityScreen} options={{ title: 'Privacy & Security' }} />
          <Stack.Screen name="Policy" component={PolicyScreen} options={({ route }) => ({ title: route.params.type === 'privacy' ? 'Privacy Policy' : 'Terms of Service' })} />
          <Stack.Screen name="MerchantSettings" component={MerchantSettingsScreen} options={{ title: 'Shop Settings' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
       <MainApp />
    </ThemeProvider>
  );
}