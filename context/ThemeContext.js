import React, { createContext, useContext, useState, useEffect } from 'react';
import { Colors } from '../constants/Colors';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [themeName, setThemeName] = useState('light');
  const theme = themeName === 'dark' ? Colors.dark : Colors.light;

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const unsubDoc = onSnapshot(doc(db, 'users', user.uid), (doc) => {
          if (doc.exists()) {
            setThemeName(doc.data().theme || 'light');
          }
        });
        return () => unsubDoc();
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const toggleTheme = async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    // 先在本地改状态，实现“秒开”
    const newTheme = themeName === 'dark' ? 'light' : 'dark';
    setThemeName(newTheme);
    
    // 后台默默同步数据库
    try {
      await updateDoc(doc(db, 'users', user.uid), { theme: newTheme });
    } catch (e) {
      console.log("Theme sync failed", e);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, themeName, toggleTheme, isDark: themeName === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
