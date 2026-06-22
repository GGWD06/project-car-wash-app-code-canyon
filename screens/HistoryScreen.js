import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ScrollView, Modal, Image, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import QRCode from 'react-native-qrcode-svg';

import { collection, query, orderBy, onSnapshot, doc, updateDoc, where } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';

export default function HistoryScreen({ route, navigation }) {
    const { theme, isDark } = useTheme();
    const [currentUid, setCurrentUid] = useState(auth.currentUser?.uid);
    const [isLoading, setIsLoading] = useState(true);
    const [bookingHistory, setBookingHistory] = useState([]);
    const [activeTab, setActiveTab] = useState(route?.params?.initialTab || 'All');
    const [selectedGallery, setSelectedGallery] = useState(null);
    const [isGalleryVisible, setIsGalleryVisible] = useState(false);
    const [qrValue, setQrValue] = useState(null);

    const TABS = ['All', 'Pending', 'In Progress', 'Completed', 'Cancelled'];

    const handleCancel = (id) => {
        Alert.alert("Confirm Cancellation", "Are you sure you want to cancel this booking?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Confirm",
                style: "destructive",
                onPress: async () => {
                    try {
                        const docRef = doc(db, "bookings", id);
                        await updateDoc(docRef, { status: "Cancelled" });
                    } catch (e) {
                        console.error("取消失败", e);
                        Alert.alert("Error", "Cancellation failed, please check network and try again");
                    }
                }
            }
        ]);
    };

    useFocusEffect(
        useCallback(() => {
            const liveUid = auth.currentUser?.uid;
            setCurrentUid(liveUid);
            setIsLoading(false);
            
            if (!liveUid) return;

            const q = query(
                collection(db, "bookings"), 
                orderBy("createdAt", "desc")
            );

            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const list = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.userId === liveUid) {
                        list.push({ id: doc.id, ...data });
                    }
                });
                setBookingHistory(list);
            });

            return () => unsubscribe();
        }, [])
    );

    const renderItem = ({ item }) => {
        let dateString = "No Date";
        if (item.bookingDate && item.bookingTime) {
            dateString = `${item.bookingDate}  ${item.bookingTime}`;
        } else if (item.createdAt) {
            const d = new Date(item.createdAt);
            if (!isNaN(d.getTime())) {
                dateString = d.toLocaleString();
            }
        }

        return (
            <View style={[styles.historyCard, { backgroundColor: theme.card }]}>
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={[styles.serviceText, { color: theme.text }]}>{item.serviceType || item.service || 'Unknown Service'}</Text>
                        <Text style={[styles.bookingIdText, { color: theme.subText }]}>#{item.id?.slice(-8)}</Text>
                    </View>
                    <Text style={[
                        styles.statusText,
                        { color: (item.status === 'Completed' || item.status === '已完成') ? '#4CAF50' : (item.status === 'Cancelled' || item.status === '已取消') ? '#f44336' : (isDark ? '#FFD60A' : '#FF9800') }
                    ]}>
                        {item.status === '待进行' ? 'Pending' : item.status === '已完成' ? 'Completed' : item.status === '已取消' ? 'Cancelled' : (item.status || 'Pending')}
                    </Text>
                </View>

                <View style={styles.details}>
                    <Text style={[styles.detailText, { color: theme.subText }]}>Plate: {item.carPlate || 'Unknown Plate'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Ionicons name="storefront-outline" size={14} color={theme.subText} />
                        <Text style={[styles.detailText, { color: theme.subText, marginLeft: 4 }]}>Shop: {item.shopName || 'Default Shop'}</Text>
                    </View>
                    <Text style={[styles.detailText, { color: theme.subText }]}>Type: {item.carType || 'Unknown Type'}</Text>
                    {item.status !== 'Completed' && item.status !== 'Cancelled' && item.currentStep !== undefined && (
                        <Text style={styles.progressText}>Current: {['Booked', 'Foaming', 'Vacuuming', 'QC Check', 'Ready'][item.currentStep]}</Text>
                    )}
                    <Text style={[styles.detailText, { color: theme.subText }]}>Booking Time: {dateString}</Text>
                    <View style={styles.priceRow}>
                        <Text style={[styles.priceText, { color: theme.text }]}>Price: RM{item.price}</Text>
                        
                        {(item.beforeImg || item.afterImg) && (
                            <TouchableOpacity
                                style={styles.galleryBtn}
                                onPress={() => {
                                    setSelectedGallery(item);
                                    setIsGalleryVisible(true);
                                }}
                            >
                                <Ionicons name="images-outline" size={16} color="#007AFF" />
                                <Text style={styles.galleryBtnText}>View Photos</Text>
                            </TouchableOpacity>
                        )}

                        {item.status !== 'Completed' && item.status !== 'Cancelled' && (
                            <TouchableOpacity
                                style={[styles.galleryBtn, { marginLeft: 10, borderColor: '#333' }]}
                                onPress={() => setQrValue(item.id)}
                            >
                                <Ionicons name="qr-code-outline" size={16} color="#333" />
                                <Text style={[styles.galleryBtnText, { color: '#333' }]}>Check-in</Text>
                            </TouchableOpacity>
                        )}

                        {(item.status === 'Pending' || item.status === '待进行' || !item.status) && (
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => handleCancel(item.id)}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    const filteredHistory = bookingHistory.filter(item => {
        if (activeTab === 'All') return true;
        const itemStatus = (item.status === '待进行' ? 'Pending'
            : item.status === '已完成' ? 'Completed'
                : item.status === '已取消' ? 'Cancelled'
                    : (item.status || 'Pending')).trim();
        return itemStatus === activeTab;
    });

    if (!currentUid) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }]}>
                <View style={styles.guestIconCircle}>
                    <Ionicons name="receipt-outline" size={60} color="#ddd" />
                </View>
                <Text style={[styles.guestTitle, { color: theme.text }]}>Your History is Empty</Text>
                <Text style={styles.guestSub}>Login to see all your past car wash bookings and photo evidence.</Text>
                <TouchableOpacity 
                    style={styles.guestLoginBtn} 
                    onPress={() => navigation.navigate('Login')}
                >
                    <Text style={styles.guestLoginText}>Login to View</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Booking History</Text>

            <View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabBar, { borderBottomColor: theme.border }]}>
                    {TABS.map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            style={[
                                styles.tabBtn,
                                activeTab === tab && styles.tabBtnActive
                            ]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Text style={[
                                styles.tabText,
                                activeTab === tab && styles.tabTextActive,
                                { color: activeTab === tab ? '#fff' : theme.subText }
                            ]}>
                                {tab}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {filteredHistory.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No {activeTab !== 'All' ? activeTab.toLowerCase() : ''} bookings.</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredHistory}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}

            {/* Before & After Gallery Modal */}
            <Modal visible={isGalleryVisible} animationType="slide" transparent={false}>
                <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
                    <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Service Proof</Text>
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setIsGalleryVisible(false)}>
                            <Ionicons name="close" size={28} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.galleryContent}>
                        <View style={styles.photoSection}>
                            <View style={styles.photoLabelRow}>
                                <View style={[styles.photoLabel, { backgroundColor: '#FF3B3015' }]}>
                                    <Text style={[styles.photoLabelText, { color: '#FF3B30' }]}>BEFORE</Text>
                                </View>
                                <Text style={styles.photoTime}>{selectedGallery?.createdAt?.split('T')[0]}</Text>
                            </View>
                            <View style={[styles.imageWrapper, { backgroundColor: theme.card, shadowOpacity: isDark ? 0 : 0.1 }]}>
                                {selectedGallery?.beforeImg ? (
                                    <Image source={{ uri: selectedGallery.beforeImg }} style={styles.mainImage} resizeMode="cover" />
                                ) : (
                                    <View style={styles.noImageView}>
                                        <Ionicons name="image-outline" size={40} color={theme.subText} />
                                        <Text style={[styles.noImageText, { color: theme.subText }]}>No 'Before' photo available</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        <View style={styles.comparisonArrow}>
                            <Ionicons name="chevron-down" size={24} color="#007AFF" />
                        </View>

                        <View style={styles.photoSection}>
                            <View style={styles.photoLabelRow}>
                                <View style={[styles.photoLabel, { backgroundColor: '#4CD96415' }]}>
                                    <Text style={[styles.photoLabelText, { color: '#4CD964' }]}>AFTER</Text>
                                </View>
                                <Text style={styles.photoTime}>{selectedGallery?.createdAt?.split('T')[0]}</Text>
                            </View>
                            <View style={[styles.imageWrapper, { backgroundColor: theme.card, shadowOpacity: isDark ? 0 : 0.1 }]}>
                                {selectedGallery?.afterImg ? (
                                    <Image source={{ uri: selectedGallery.afterImg }} style={styles.mainImage} resizeMode="cover" />
                                ) : (
                                    <View style={styles.noImageView}>
                                        <Ionicons name="image-outline" size={40} color={theme.subText} />
                                        <Text style={[styles.noImageText, { color: theme.subText }]}>Wait for cleaning to complete</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* QR Code Modal for User */}
            <Modal visible={!!qrValue} transparent={true} animationType="fade">
                <View style={styles.qrOverlay}>
                    <View style={[styles.qrContent, { backgroundColor: theme.card }]}>
                        <Text style={[styles.qrTitle, { color: theme.text }]}>Check-in QR Code</Text>
                        <Text style={[styles.qrSub, { color: theme.subText }]}>Show this to the merchant at the shop</Text>
                        <View style={[styles.qrWrapper, { backgroundColor: '#fff' }]}>
                            {qrValue && <QRCode value={qrValue} size={200} />}
                        </View>
                        <Text style={[styles.qrId, { color: theme.subText }]}>ID: {qrValue?.slice(-8)}</Text>
                        <TouchableOpacity style={styles.qrCloseBtn} onPress={() => setQrValue(null)}>
                            <Text style={styles.qrCloseText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa', padding: 15 },
    headerTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, marginTop: 40 },
    tabContainer: { height: 45, marginBottom: 15 },
    tabScrollContent: { paddingRight: 20, alignItems: 'center' },
    tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e9ecef', marginRight: 10 },
    tabBtnActive: { backgroundColor: '#007AFF' },
    tabText: { color: '#555', fontSize: 14, fontWeight: '600' },
    tabTextActive: { color: '#fff' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: '#888', fontSize: 16 },
    historyCard: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 12,
        marginBottom: 15,
        // 阴影效果
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 10,
        marginBottom: 10
    },
    serviceText: { fontSize: 18, fontWeight: 'bold' },
    bookingIdText: { fontSize: 11, fontWeight: '500', marginTop: 2 },
    statusText: { fontWeight: '600' },
    details: { gap: 5 },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
    priceText: { fontWeight: 'bold', color: '#333' },
    detailText: { color: '#666', fontSize: 13 },
    progressText: { color: '#007AFF', fontSize: 13, fontWeight: '700', marginTop: 2, marginBottom: 2 },
    galleryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f7ff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#d0e8ff' },
    galleryBtnText: { color: '#007AFF', fontSize: 12, fontWeight: '700', marginLeft: 4 },
    cancelBtn: { paddingVertical: 6, paddingHorizontal: 16, backgroundColor: '#ffebee', borderRadius: 6, borderWidth: 1, borderColor: '#ffcdd2' },
    cancelBtnText: { color: '#d32f2f', fontSize: 13, fontWeight: '600' },

    // Modal Styles
    modalContainer: { flex: 1, backgroundColor: '#fff' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#eee' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a' },
    closeBtn: { padding: 4 },
    galleryContent: { padding: 20 },
    photoSection: { marginBottom: 20 },
    photoLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    photoLabel: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    photoLabelText: { fontSize: 12, fontWeight: '800' },
    photoTime: { fontSize: 12, color: '#999' },
    imageWrapper: { width: '100%', height: 250, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f5f5f5', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
    mainImage: { width: '100%', height: '100%' },
    noImageView: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    noImageText: { color: '#ccc', fontSize: 14, marginTop: 10, fontWeight: '600' },
    comparisonArrow: { alignItems: 'center', marginVertical: 10 },
    // QR Modal Styles
    qrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
    qrContent: { backgroundColor: '#fff', padding: 30, borderRadius: 24, alignItems: 'center', width: '80%' },
    qrTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 5 },
    qrSub: { fontSize: 13, color: '#888', marginBottom: 25, textAlign: 'center' },
    qrWrapper: { padding: 15, backgroundColor: '#fff', borderRadius: 12, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    qrId: { marginTop: 15, fontSize: 12, color: '#ccc', letterSpacing: 1 },
    qrCloseBtn: { marginTop: 25, paddingVertical: 12, paddingHorizontal: 40, backgroundColor: '#007AFF', borderRadius: 12 },
    qrCloseText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    // Guest Profile Styles
    guestIconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20
    },
    guestTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10
    },
    guestSub: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        paddingHorizontal: 40,
        lineHeight: 20,
        marginBottom: 30
    },
    guestLoginBtn: {
        backgroundColor: '#007AFF',
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 12,
        elevation: 3,
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4
    },
    guestLoginText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    }
});