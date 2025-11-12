// src/services/api.js
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const authAPI = {
  healthCheck: async () => {
    try {
      console.log('🔍 Checking backend health...');
      console.log('🌐 API Base URL:', API_BASE_URL);
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      console.log('✅ Backend health:', data);
      return data;
    } catch (error) {
      console.error('❌ Backend health check failed:', error);
      throw new Error(`Cannot connect to backend: ${error.message}`);
    }
  },

  checkUsername: async (username) => {
    console.log('🔍 Checking username:', username);
    const response = await fetch(`${API_BASE_URL}/auth/check-username`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
    });
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    const data = await response.json();
    console.log('🔍 Username check result:', data);
    return data;
  },

  // ... rest of your existing code remains the same
  checkEmail: async (email) => {
    console.log('🔍 Checking email:', email);
    const response = await fetch(`${API_BASE_URL}/auth/check-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    const data = await response.json();
    console.log('🔍 Email check result:', data);
    return data;
  },

  signUp: async (userData) => {
    console.log('📝 Sending signup request:', userData);
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    const data = await response.json();
    console.log('📝 Signup response:', data);
    
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Signup failed');
    }
    
    return data;
  },

  login: async (credentials) => {
    console.log('🔐 Sending login request:', credentials);
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Login failed');
    }
    
    return data;
  },

  forgotPassword: async (resetData) => {
    console.log('🔑 Sending forgot password request:', resetData);
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resetData),
    });
    
    const data = await response.json();
    console.log('🔑 Forgot password response:', data);
    
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Password reset failed');
    }
    
    return data;
  },
};