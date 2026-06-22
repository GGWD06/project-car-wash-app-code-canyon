import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from '../firebaseConfig';
// 使用 ../ 代表返回上一级目录

export const getBookingHistory = async (userId) => {
    try {
        // 1. 先拿本地缓存
        const localData = await AsyncStorage.getItem(`bookings_${userId}`);
        let bookings = localData ? JSON.parse(localData) : [];

        // 2. 尝试从云端拿新数据
        // 这里的逻辑可以根据你的后端调整
        const snapshot = await db.collection('bookings').where('userId', '==', userId).get();
        const cloudData = snapshot.docs.map(doc => doc.data());

        if (cloudData.length > 0) {
            // 3. 如果云端有数据，存入本地并返回
            await AsyncStorage.setItem(`bookings_${userId}`, JSON.stringify(cloudData));
            return cloudData;
        }

        return bookings;
    } catch (error) {
        console.error("Failed to get data, returning local old data", error);
        // 报错时（比如没网），返回本地缓存
        return JSON.parse(await AsyncStorage.getItem(`bookings_${userId}`));
    }
};