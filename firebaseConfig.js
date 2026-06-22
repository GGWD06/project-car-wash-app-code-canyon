import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: "carwash-1ead6.firebaseapp.com",
    projectId: "carwash-1ead6",
    storageBucket: "carwash-1ead6.firebasestorage.app",
    messagingSenderId: "411139961463",
    appId: "1:411139961463:web:621fd8e32c6ffbfa0f8c72",
    measurementId: "G-YYJ6PST6CR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 修复 Expo Go 在请求 Firestore 时经常无限卡住或无法连接的问题
// 强制开启 Long Polling (长轮询) 替代 WebSocket
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
});

// 使用 AsyncStorage 保持登录状态，修复 React Native 环境下的警告
export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
});
export const storage = getStorage(app);