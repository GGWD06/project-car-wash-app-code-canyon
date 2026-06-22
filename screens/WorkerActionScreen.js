import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { db } from '../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const STEPS = [
    { label: 'Booking Confirmed', action: 'Start Wash' },
    { label: 'Foaming in progress', action: 'Finish Foaming' },
    { label: 'Vacuuming in progress', action: 'Finish Vacuuming' },
    { label: 'QC Checking', action: 'Finalize & Ready' },
    { label: 'Ready for Pickup', action: 'Complete Order' },
];

export default function WorkerActionScreen({ route, navigation }) {
    const { theme, isDark } = useTheme();
    const primaryAccent = isDark ? '#FFD60A' : '#FF9500';

    const { bookingId } = route.params;
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'bookings', bookingId), (docSnap) => {
            if (docSnap.exists()) {
                setBooking(docSnap.data());
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [bookingId]);

    const uploadPhoto = async (type) => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission", "Camera permission is required to take service photos.");
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.1, 
            base64: true
        });

        if (!result.canceled) {
            setUploading(true);
            try {
                const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
                const field = type === 'before' ? 'beforeImg' : 'afterImg';
                
                await updateDoc(doc(db, 'bookings', bookingId), { 
                    [field]: base64Img 
                });
                
                setBooking(prev => ({ ...prev, [field]: base64Img }));
            } catch (error) {
                console.error("Upload error:", error);
                Alert.alert("Process Failed", error.message);
            } finally {
                setUploading(false);
            }
        }
    };

    const nextStep = async () => {
        if (!booking) return;

        const currentStep = booking.currentStep || 0;
        
        if (currentStep === 0 && !booking.beforeImg) {
            Alert.alert("Photo Required", "Please take a 'Before' photo before starting the wash.");
            return;
        }
        if (currentStep === 3 && !booking.afterImg) {
            Alert.alert("Photo Required", "Please take an 'After' photo before finalizing the wash.");
            return;
        }

        const next = currentStep + 1;
        const status = next >= 4 ? 'Completed' : 'In Progress';
        
        try {
            await updateDoc(doc(db, 'bookings', bookingId), { 
                currentStep: next,
                status: status
            });
            setBooking(prev => ({ ...prev, currentStep: next, status: status }));
            if (next === 5) navigation.goBack();
        } catch (error) {
            Alert.alert("Update Error", error.message);
        }
    };

    if (loading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator color={primaryAccent} /></View>;

    const currentStep = booking.currentStep || 0;

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <Text style={[styles.plate, { color: theme.text }]}>{booking.carPlate}</Text>
                <Text style={[styles.service, { color: theme.subText }]}>{booking.serviceType}</Text>
            </View>

            {/* Photo Section */}
            <View style={styles.photoRow}>
                <TouchableOpacity style={[styles.photoBox, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => uploadPhoto('before')}>
                    {booking.beforeImg ? (
                        <Image source={{ uri: booking.beforeImg }} style={styles.attachedImg} />
                    ) : (
                        <View style={styles.placeholder}>
                            <Ionicons name="camera" size={30} color={primaryAccent} />
                            <Text style={[styles.photoLabel, { color: theme.subText }]}>Before Photo</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={[styles.photoBox, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => uploadPhoto('after')}>
                    {booking.afterImg ? (
                        <Image source={{ uri: booking.afterImg }} style={styles.attachedImg} />
                    ) : (
                        <View style={styles.placeholder}>
                            <Ionicons name="camera" size={30} color={primaryAccent} />
                            <Text style={[styles.photoLabel, { color: theme.subText }]}>After Photo</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Step Progress UI */}
            <View style={[styles.progressCard, { backgroundColor: theme.card, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 8, elevation: isDark ? 0 : 2 }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Live Tracking Status</Text>
                {STEPS.map((step, index) => (
                    <View key={index} style={styles.stepRow}>
                        <View style={[styles.dot, { backgroundColor: isDark ? '#3A3A3C' : '#e0e0e0' }, currentStep >= index && { backgroundColor: primaryAccent }]}>
                            {currentStep > index && <Ionicons name="checkmark" size={14} color={isDark ? '#fff' : '#fff'} />}
                        </View>
                        <View style={[styles.line, { backgroundColor: isDark ? '#3A3A3C' : '#e0e0e0' }, currentStep > index && { backgroundColor: primaryAccent }, index === STEPS.length - 1 && { opacity: 0 }]} />
                        <Text style={[styles.stepLabel, { color: theme.subText }, currentStep === index && [styles.stepLabelCurrent, { color: theme.text }]]}>
                            {step?.label}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Action Button */}
            {currentStep < 5 && (
                <TouchableOpacity 
                    style={[styles.mainBtn, { backgroundColor: primaryAccent }, uploading && { opacity: 0.5 }]} 
                    onPress={nextStep}
                    disabled={uploading}
                >
                    {uploading ? (
                        <ActivityIndicator color={isDark ? '#000' : '#fff'} />
                    ) : (
                        <Text style={[styles.btnText, { color: isDark ? '#1C1C1E' : '#fff' }]}>{STEPS[currentStep]?.action || 'Finish'}</Text>
                    )}
                </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { marginBottom: 25, marginTop: 20 },
    plate: { fontSize: 32, fontWeight: 'bold' },
    service: { fontSize: 16, marginTop: 4 },

    photoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
    photoBox: { width: '48%', height: 120, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', overflow: 'hidden' },
    attachedImg: { width: '100%', height: '100%' },
    placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    photoLabel: { fontSize: 12, marginTop: 8 },

    progressCard: { borderRadius: 20, padding: 20 },
    cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 20 },
    stepRow: { flexDirection: 'row', height: 50, alignItems: 'flex-start' },
    dot: { width: 22, height: 22, borderRadius: 11, zIndex: 1, justifyContent: 'center', alignItems: 'center' },
    line: { position: 'absolute', left: 10, top: 22, width: 2, height: 30 },
    stepLabel: { marginLeft: 15, fontSize: 15 },
    stepLabelCurrent: { fontWeight: 'bold' },

    mainBtn: { height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 30, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
    btnText: { fontSize: 18, fontWeight: 'bold' }
});
