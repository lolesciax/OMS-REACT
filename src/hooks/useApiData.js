import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

export const useApiData = () => {
  const [dashboardData, setDashboardData] = useState({
    products: [],
    users: [],
    orders: [],
    loading: true,
    error: null
  });

  const loadDashboardData = async () => {
    try {
      setDashboardData(prev => ({ ...prev, loading: true, error: null }));
      
      const [products, users, orders] = await Promise.all([
        apiService.getProducts(),
        apiService.getUsers(),
        apiService.getOrders()
      ]);

      setDashboardData({
        products,
        users,
        orders,
        loading: false,
        error: null
      });
    } catch (error) {
      setDashboardData(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load dashboard data'
      }));
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return {
    ...dashboardData,
    refreshData: loadDashboardData
  };
};