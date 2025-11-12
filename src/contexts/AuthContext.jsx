import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = () => {
        try {
            const userData = localStorage.getItem('user');
            const loginStatus = localStorage.getItem('isLoggedIn');
            
            if (userData && loginStatus === 'true') {
                const user = JSON.parse(userData);
                setUser(user);
                setIsLoggedIn(true);
                console.log('✅ User authenticated:', user.username);
            }
        } catch (error) {
            console.error('Auth check error:', error);
            logout();
        } finally {
            setLoading(false);
        }
    };

    const login = (userData) => {
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('loginTime', new Date().toISOString());
        setUser(userData);
        setIsLoggedIn(true);
    };

    const logout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('loginTime');
        localStorage.removeItem('checkoutData');
        setUser(null);
        setIsLoggedIn(false);
    };

    const value = {
        isLoggedIn,
        user,
        loading,
        login,
        logout,
        checkAuthStatus
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};