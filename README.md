# 🚗 Ultrama Car Wash Mobile App

Ultrama is a premium, full-stack car wash management and booking platform built with **React Native (Expo)** and **Firebase**. It provides a seamless experience for both car owners (Customers) and shop owners (Merchants), featuring real-time tracking, localized data, and a robust multi-shop infrastructure.

## 🛠️ Advanced Tech Stack

*   **Framework**: [React Native](https://reactnative.dev/) with **Expo SDK 51+**
*   **Navigation**: [React Navigation 7](https://reactnavigation.org/) (Role-based Stack & Bottom Tabs)
*   **Backend & Real-time DB**: [Firebase](https://firebase.google.com/)
    *   **Firestore**: Real-time synchronization of bookings, shop settings, and user roles.
    *   **Auth**: Secure email/password authentication with **Verification Gatekeeper** logic.
    *   **Storage**: Cloud storage for vehicle and profile imagery.
*   **Location Services**: `expo-location` & `react-native-maps` for geofencing and distance calculation.
*   **Device Integration**: `expo-camera` for integrated QR code scanning.
*   **External APIs**: 
    *   **OpenWeatherMap**: Live weather and 3-day rain forecasts.
    *   **Data.gov.my**: Real-time Malaysian fuel prices (RON95, RON97, Diesel).

---

## ✨ Key Features & New Updates

### 🏠 For Customers (Car Owners)
*   **Personalized Dashboard**: Real-time weather integration and live fuel price tracking (Peninsular vs. East Malaysia).
*   **Smart Multi-Shop Selection**: Automatically finds shops within a 60km radius using the Haversine formula. View shop facilities (WiFi, Cafe, etc.) and real-time open/closed status.
*   **Advanced Booking Engine**:
    *   **Rain Warnings**: Real-time alerts if rain is forecast for your selected booking slot.
    *   **Dynamic Pricing**: Prices automatically adjust based on vehicle type (SUV, Sedan, etc.) and shop-specific rates.
    *   **Live Order Tracking**: Interactive progress bar (Booked → Foaming → Vacuuming → QC → Ready).
*   **My Garage**: Save multiple vehicles for 1-tap bookings.

### 🏢 For Merchants (Shop Owners)
*   **Merchant Hub**: A dedicated real-time dashboard to manage incoming orders.
*   **QR Code Verification**: Integrated scanner to quickly check-in customers and verify booking details.
*   **Order Management**: Categorized views (New, Active, Done, Cancelled) with long-press deletion and manual status updates.
*   **Shop Customization**: Update shop location, name, and toggle available services or prices directly from the app.
*   **Role-Based Security**: Seamless switching between 'Customer' and 'Merchant' modes with isolated data views.

---

## 📂 Project Architecture

```text
car-wash-app/
├── App.js                # Entry point with Role-Based Navigation logic
├── firebaseConfig.js     # Global Firebase initialization
├── context/
│   └── ThemeContext.js   # Global Dark/Light mode state
├── screens/
│   ├── HomeScreen.js     # Home dashboard (Weather & Fuel APIs)
│   ├── MerchantDashboard.js # [NEW] Real-time order hub for shops
│   ├── BookingScreen.js  # [UPDATED] Geofencing & multi-shop booking
│   ├── WorkerActionScreen.js # [NEW] Step-by-step wash status updates
│   ├── OTPScreen.js      # [NEW] Secondary security layer
│   └── ...               # Profile, History, Security, etc.
└── utils/
    ├── weatherService.js # Weather & Forecast API logic
    └── ...
```

---

## 🚀 Setup & Installation

1.  **Clone & Install**:
    ```bash
    git clone [repository-url]
    cd car-wash-app
    npm install
    ```
2.  **Environment Config**:
    Create `.env.local` in the root:
    ```env
    EXPO_PUBLIC_FIREBASE_API_KEY=Your_Key
    EXPO_PUBLIC_WEATHER_API_KEY=Your_Key
    ```
3.  **Run**:
    ```bash
    npx expo start
    ```

---

## 📈 Core Logic & Innovations

*   **Geofencing Logic**: The app calculates the distance between the user and the car wash using the Haversine formula to ensure bookings are only made at valid nearby locations.
*   **Gatekeeper Auth**: Implements a verification flow where users must click an email link before the Firestore security rules grant access to main app features.
*   **Persistence Layer**: Uses `AsyncStorage` to maintain session data and theme preferences across app restarts.

---
*Developed as a comprehensive SaaS solution for the modern car care industry.*
