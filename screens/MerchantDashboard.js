import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Alert } from 'react-native';
import { collection, query, orderBy, onSnapshot, where, doc, updateDoc, deleteDoc, setDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';

export default function MerchantDashboard({ navigation }) {
    const { theme, isDark } = useTheme();
    const primaryAccent = isDark ? '#FFD60A' : '#FF9500'; // 浅色模式为深橙色，深色模式为金色 / Darker orange for light mode, gold for dark mode

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('All');
    const [isScanning, setIsScanning] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    useEffect(() => {
        let unsubscribe = null;
        console.log("🚀 MerchantDashboard Mounted");

        const fetchShopAndOrders = async () => {
            const user = auth.currentUser;
            if (!user) {
                console.log("⏳ Waiting for user auth...");
                return;
            }

            try {
                // 1. 获取当前商家的邮箱并转为小写，确保匹配一致性 / Get current merchant's email and convert to lowercase to ensure consistency
                const userEmail = user.email?.trim().toLowerCase();
                console.log("🔍 Fetching data for:", userEmail);

                // 2. 核心步骤：在 'shops' 集合中查找所有 ownerEmail 等于当前商家的店铺 / Core Step: Find all shops in 'shops' collection where ownerEmail matches current merchant
                const shopQ = query(collection(db, "shops"), where("ownerEmail", "==", userEmail));
                const shopSnap = await getDocs(shopQ);

                let myShopIds = [];
                if (!shopSnap.empty) {
                    // 将该商家名下的所有店铺 ID 提取出来存入数组 / Extract all shop IDs owned by this merchant into an array
                    myShopIds = shopSnap.docs.map(d => d.id);
                    console.log("✅ Linked to Shops:", myShopIds);

                    // 3. 实时查询订单：利用 Firebase 的 'in' 操作符，同时查询该商家所有店铺的订单 / Query orders in real-time: Use Firebase 'in' operator to fetch bookings for all owned shops
                    const q = query(
                        collection(db, "bookings"),
                        where("shopId", "in", myShopIds), // 只要订单的 shopId 在我的店铺列表里，就显示 / Show bookings as long as shopId matches one of the merchant's shops
                        orderBy("createdAt", "desc") // 按下单时间倒序排列 / Order by booking creation time descending
                    );

                    // 开启实时快照监听，这样只要有新订单，页面会立刻自动刷新 / Start real-time snapshot listener to automatically update the dashboard when new orders arrive
                    unsubscribe = onSnapshot(q, (snapshot) => {
                        const list = [];
                        snapshot.forEach((doc) => {
                            list.push({ id: doc.id, ...doc.data() });
                        });
                        console.log("📦 Orders updated:", list.length);
                        setOrders(list);
                        setLoading(false);
                    });
                } else {
                    console.log("❌ No shop found for owner:", userEmail);
                    setLoading(false);
                }
            } catch (e) {
                console.log("❌ Dashboard logic error:", e);
                setLoading(false);
            }
        };

        fetchShopAndOrders();

        // 组件卸载时（比如退出登录或切换页面），必须关闭监听器防止内存泄漏 / Clean up the listener when components unmount to prevent memory leaks (e.g., logout or tab switch)
        return () => {
            console.log("⏏️ MerchantDashboard Unmounting");
            if (unsubscribe) unsubscribe();
        };
    }, [auth.currentUser]);

    const handleBarCodeScanned = async ({ data }) => {
        setIsScanning(false);
        try {
            // 数据应该是 bookingId / data should be the bookingId
            navigation.navigate('WorkerAction', { bookingId: data });
        } catch (e) {
            Alert.alert("Scan Error", "Invalid QR code or order not found.");
        }
    };

    const startScan = async () => {
        const { status } = await requestPermission();
        if (status === 'granted') {
            setIsScanning(true);
        } else {
            Alert.alert("Permission", "Camera permission is required to scan QR codes.");
        }
    };

    const filteredOrders = orders.filter(o => {
        if (activeTab === 'All') return true;
        if (activeTab === 'New') return o.status === 'Pending';
        if (activeTab === 'Active') return o.status === 'In Progress';
        if (activeTab === 'Done') return o.status === 'Completed';
        if (activeTab === 'Cancelled') return o.status === 'Cancelled';
        return true;
    });

    const TABS = ['All', 'New', 'Active', 'Done', 'Cancelled'];

    const openShopSettings = () => {
        navigation.navigate('MerchantSettings');
    };

    const handleDeleteOrder = (orderId, plate) => {
        Alert.alert(
            "Delete Order",
            `Are you sure you want to permanently delete the order for ${plate}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, "bookings", orderId));
                        } catch (e) {
                            Alert.alert("Error", "Failed to delete order");
                        }
                    }
                }
            ]
        );
    };

    const renderOrderItem = ({ item }) => (
        <TouchableOpacity
            style={[styles.orderCard, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: isDark ? 0 : 1 }]}
            onPress={() => navigation.navigate('WorkerAction', { bookingId: item.id })}
            onLongPress={() => handleDeleteOrder(item.id, item.carPlate)}
            delayLongPress={500}
        >
            <View style={styles.cardHeader}>
                <View>
                    <Text style={[styles.plateText, { color: theme.text }]}>{item.carPlate}</Text>
                    <Text style={[styles.bookingIdText, { color: theme.subText }]}>#{item.id?.slice(-8)}</Text>
                    <Text style={[styles.serviceText, { color: theme.subText }]}>{item.serviceType} • {item.carType}</Text>
                </View>
                <View style={[styles.stepBadge, { backgroundColor: item.currentStep >= 5 ? '#4CD964' : (isDark ? '#007AFF' : 'rgba(0, 122, 255, 0.1)') }]}>
                    <Text style={[styles.stepText, !isDark && item.currentStep < 5 && { color: '#007AFF' }]}>Step {Math.min(item.currentStep, 5)}/5</Text>
                </View>
            </View>

            <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
                <View style={styles.timeTag}>
                    <Ionicons name="time-outline" size={14} color={theme.subText} />
                    <Text style={[styles.timeText, { color: theme.subText }]}>{item.bookingTime} ({item.bookingDate})</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.border} />
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={[styles.loading, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={primaryAccent} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border, borderBottomWidth: isDark ? 0 : 1 }]}>
                <View>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Merchant Dashboard</Text>
                    <Text style={[styles.headerSub, { color: theme.subText }]}>Manage your car wash orders</Text>
                </View>
                <TouchableOpacity style={[styles.locBtn, { backgroundColor: isDark ? '#3A3A3C' : '#f0f0f0', borderColor: isDark ? '#48484A' : '#ddd' }]} onPress={openShopSettings}>
                    <Ionicons name="settings-outline" size={20} color={primaryAccent} />
                    <Text style={[styles.locBtnText, { color: primaryAccent }]}>Settings</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.statsContainer, { backgroundColor: theme.card, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 8, elevation: isDark ? 0 : 2 }]}>
                <View style={[styles.statBox, { borderRightColor: theme.border }]}>
                    <Text style={[styles.statValue, { color: primaryAccent }]}>{orders.filter(o => o.status === 'Pending').length}</Text>
                    <Text style={[styles.statLabel, { color: theme.subText }]}>New</Text>
                </View>
                <View style={[styles.statBox, { borderRightColor: theme.border }]}>
                    <Text style={[styles.statValue, { color: primaryAccent }]}>{orders.filter(o => o.status === 'In Progress').length}</Text>
                    <Text style={[styles.statLabel, { color: theme.subText }]}>Active</Text>
                </View>
                <View style={[styles.statBox, { borderRightWidth: 0 }]}>
                    <Text style={[styles.statValue, { color: primaryAccent }]}>{orders.filter(o => o.status === 'Completed' && o.bookingDate === new Date().toISOString().split('T')[0]).length}</Text>
                    <Text style={[styles.statLabel, { color: theme.subText }]}>Today</Text>
                </View>
            </View>

            {/* 页签 / Tabs */}
            <View style={styles.tabBar}>
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && [styles.activeTab, { backgroundColor: isDark ? '#3A3A3C' : '#e6f0fa' }]]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, { color: theme.subText }, activeTab === tab && [styles.activeTabText, { color: isDark ? primaryAccent : '#007AFF' }]]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={filteredOrders}
                renderItem={renderOrderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyView}>
                        <Ionicons name="cafe-outline" size={60} color={theme.border} />
                        <Text style={[styles.emptyText, { color: theme.subText }]}>No {activeTab.toLowerCase()} orders yet</Text>
                    </View>
                }
            />

            {/* 扫码悬浮按钮 / Scan FAB */}
            <TouchableOpacity style={[styles.fab, { backgroundColor: primaryAccent }]} onPress={startScan}>
                <Ionicons name="qr-code-outline" size={28} color={isDark ? '#1C1C1E' : '#fff'} />
            </TouchableOpacity>

            {/* 二维码扫描弹窗 / QR Scanner Modal */}
            {isScanning && (
                <Modal visible={isScanning} animationType="fade">
                    <View style={styles.scannerContainer}>
                        <CameraView
                            style={StyleSheet.absoluteFillObject}
                            onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
                            barcodeScannerSettings={{
                                barcodeTypes: ["qr"],
                            }}
                        />
                        <View style={styles.overlay}>
                            <Text style={styles.overlayText}>Center the QR code within the frame</Text>
                            <TouchableOpacity style={styles.cancelScanBtn} onPress={() => setIsScanning(false)}>
                                <Text style={styles.cancelScanText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSub: { fontSize: 12, marginTop: 2 },
    locBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
    locBtnText: { fontSize: 12, fontWeight: 'bold', marginLeft: 6 },

    statsContainer: { flexDirection: 'row', paddingVertical: 20, margin: 15, borderRadius: 16 },
    statBox: { flex: 1, alignItems: 'center', borderRightWidth: 1 },
    statValue: { fontSize: 24, fontWeight: 'bold' },
    statLabel: { fontSize: 12, marginTop: 4 },

    tabBar: { flexDirection: 'row', paddingHorizontal: 15, marginBottom: 10 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    activeTab: {},
    tabText: { fontWeight: '600' },
    activeTabText: {},

    listContent: { padding: 15 },
    orderCard: { borderRadius: 16, padding: 16, marginBottom: 12 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    plateText: { fontSize: 18, fontWeight: 'bold' },
    bookingIdText: { fontSize: 11, fontWeight: '500', marginTop: 2 },
    serviceText: { fontSize: 13, marginTop: 2 },
    stepBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    stepText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 12 },
    timeTag: { flexDirection: 'row', alignItems: 'center' },
    timeText: { fontSize: 12, marginLeft: 6 },

    emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 50 },
    emptyText: { fontSize: 16, marginTop: 15 },

    fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },

    scannerContainer: { flex: 1, backgroundColor: '#000' },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 100 },
    overlayText: { color: '#fff', fontSize: 16, marginBottom: 40, fontWeight: '600' },
    cancelScanBtn: { paddingVertical: 12, paddingHorizontal: 40, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, borderWidth: 1, borderColor: '#fff' },
    cancelScanText: { color: '#fff', fontWeight: 'bold' }
});
