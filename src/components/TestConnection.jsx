import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const TestConnection = () => {
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsData, usersData, ordersData] = await Promise.all([
        apiService.getProducts(),
        apiService.getUsers(),
        apiService.getOrders()
      ]);
      
      setProducts(productsData);
      setUsers(usersData);
      setOrders(ordersData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading data from backend...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>🔗 Backend Connection Test</h1>
      
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {/* Products Card */}
        <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px', minWidth: '250px' }}>
          <h2>🛍️ Products ({products.length})</h2>
          {products.map(product => (
            <div key={product._id} style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#f5f5f5' }}>
              <strong>{product.name}</strong><br />
              ${product.price} • {product.category}<br />
              Stock: {product.stock}
            </div>
          ))}
        </div>

        {/* Users Card */}
        <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px', minWidth: '250px' }}>
          <h2>👥 Users ({users.length})</h2>
          {users.map(user => (
            <div key={user._id} style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#f5f5f5' }}>
              <strong>{user.name}</strong><br />
              {user.email}<br />
              Role: {user.role}
            </div>
          ))}
        </div>

        {/* Orders Card */}
        <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px', minWidth: '250px' }}>
          <h2>📦 Orders ({orders.length})</h2>
          {orders.map(order => (
            <div key={order._id} style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#f5f5f5' }}>
              <strong>{order.order_number}</strong><br />
              Customer: {order.customer_name}<br />
              Total: ${order.total}<br />
              Status: <span style={{ 
                color: order.status === 'completed' ? 'green' : 'orange',
                fontWeight: 'bold'
              }}>{order.status}</span>
            </div>
          ))}
        </div>
      </div>

      <button 
        onClick={loadData}
        style={{ 
          marginTop: '20px', 
          padding: '10px 20px', 
          backgroundColor: '#007bff', 
          color: 'white', 
          border: 'none', 
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        🔄 Refresh Data
      </button>
    </div>
  );
};

export default TestConnection;