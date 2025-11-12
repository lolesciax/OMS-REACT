import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import "../styles/Login.css";
import '../components/Footer.css';
import Footer from '../components/Footer';
import paymaya from '../assets/paymaya.png';
import gcash from '../assets/gcash.png';
import facebook from '../assets/facebook.png';
import instagram from '../assets/instagram.png';
import tiktok from '../assets/tiktok.png';
import Header from '../components/Header';
// Import from assets folder

function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    
    // Form state
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });

    // UI state
    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [errors, setErrors] = useState({
        username: '',
        password: '',
        submit: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [forgotPasswordData, setForgotPasswordData] = useState({
        username: '',
        email: '',
        new_password: '',
        confirm_password: ''
    });
    const [forgotPasswordErrors, setForgotPasswordErrors] = useState({});
    const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState('');

    // Handle input changes
    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
        
        // Clear errors when user starts typing
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }
        if (errors.submit) {
            setErrors(prev => ({
                ...prev,
                submit: ''
            }));
        }
    };

    // Handle forgot password input changes
    const handleForgotPasswordChange = (field, value) => {
        setForgotPasswordData(prev => ({
            ...prev,
            [field]: value
        }));
        
        // Clear errors when user starts typing
        if (forgotPasswordErrors[field]) {
            setForgotPasswordErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }
        if (forgotPasswordSuccess) {
            setForgotPasswordSuccess('');
        }
    };

    // Validate form
    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.username.trim()) {
            newErrors.username = "Username is required";
        }
        
        if (!formData.password) {
            newErrors.password = "Password is required";
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Validate forgot password form
    const validateForgotPasswordForm = () => {
        const newErrors = {};
        
        if (!forgotPasswordData.username.trim()) {
            newErrors.username = "Username is required";
        }
        
        if (!forgotPasswordData.email.trim()) {
            newErrors.email = "Email is required";
        } else if (!/\S+@\S+\.\S+/.test(forgotPasswordData.email)) {
            newErrors.email = "Email is invalid";
        }
        
        if (!forgotPasswordData.new_password) {
            newErrors.new_password = "New password is required";
        } else if (forgotPasswordData.new_password.length < 6) {
            newErrors.new_password = "Password must be at least 6 characters";
        }
        
        if (!forgotPasswordData.confirm_password) {
            newErrors.confirm_password = "Please confirm your password";
        } else if (forgotPasswordData.new_password !== forgotPasswordData.confirm_password) {
            newErrors.confirm_password = "Passwords do not match";
        }
        
        setForgotPasswordErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle login submission - UPDATED WITH AUTH CONTEXT
    const handleLogin = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        setIsLoading(true);

        try {
            console.log('🔐 Starting login process...');
            console.log('👤 Username:', formData.username);
            
            const credentials = {
                username: formData.username.trim(),
                password: formData.password
            };
            
            console.log('🚀 Sending login request...');
            const data = await authAPI.login(credentials);

            console.log('✅ Login successful!');
            console.log('👤 Full user data:', data.user);
            console.log('👑 Admin status:', data.user.isAdmin);

            // Use the auth context login function
            login(data.user);

            // Show success message
            alert(`Welcome back, ${data.user.username}!`);
            
            // Redirect based on user role
            if (data.user.isAdmin === true) {
                console.log('🎯 ADMIN DETECTED: Redirecting to admin dashboard...');
                window.location.href = '/admin/dashboard';
            } else {
                console.log('🎯 CUSTOMER DETECTED: Redirecting to shopping...');
                window.location.href = '/shopping';
            }
            
        } catch (error) {
            console.error('❌ Login error:', error);
            setErrors(prev => ({
                ...prev,
                submit: error.message || 'Login failed. Please check your username and password.'
            }));
        } finally {
            setIsLoading(false);
        }
    };

    // Handle forgot password submission
    const handleForgotPassword = async (e) => {
        e.preventDefault();
        
        if (!validateForgotPasswordForm()) {
            return;
        }

        setIsLoading(true);

        try {
            console.log('🔑 Starting password reset process...');
            
            const resetData = {
                username: forgotPasswordData.username.trim(),
                email: forgotPasswordData.email.trim(),
                new_password: forgotPasswordData.new_password
            };
            
            console.log('🚀 Sending password reset request...');
            const data = await authAPI.forgotPassword(resetData);

            console.log('✅ Password reset successful!');
            setForgotPasswordSuccess(data.message || 'Password reset successfully!');
            
            // Reset form
            setForgotPasswordData({
                username: '',
                email: '',
                new_password: '',
                confirm_password: ''
            });
            
            // Auto-close modal after success
            setTimeout(() => {
                setShowForgotPassword(false);
                setForgotPasswordSuccess('');
            }, 3000);
            
        } catch (error) {
            console.error('❌ Password reset error:', error);
            setForgotPasswordErrors(prev => ({
                ...prev,
                submit: error.message || 'Password reset failed. Please try again.'
            }));
        } finally {
            setIsLoading(false);
        }
    };

    // Toggle password visibility for login form
    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    // Toggle password visibility for forgot password form
    const toggleNewPasswordVisibility = () => {
        setShowNewPassword(!showNewPassword);
    };

    const toggleConfirmPasswordVisibility = () => {
        setShowConfirmPassword(!showConfirmPassword);
    };

    // Toggle forgot password modal
    const toggleForgotPassword = () => {
        setShowForgotPassword(!showForgotPassword);
        setForgotPasswordData({
            username: '',
            email: '',
            new_password: '',
            confirm_password: ''
        });
        setForgotPasswordErrors({});
        setForgotPasswordSuccess('');
        setShowNewPassword(false);
        setShowConfirmPassword(false);
    };

    // Toggle help modal
    const toggleHelpModal = () => {
        setShowHelpModal(!showHelpModal);
    };

    return (
        <>
            {/* HEADER */}
            <Header title="Login"/>

            {/* MAIN CONTENT */}
            <main className="main-container">
                <section className="banner">
                    <div className="banner-content">
                        <h1>The Best Finds of the Year</h1>
                        <p>Bermonths of Unique Deals.</p>
                        <p>
                            <strong>'Ber' Ready to Save.</strong>
                        </p>
                    </div>
                </section>

                <section className="login-box">
                    <h3>Log In</h3>
                    
                    {/* Error message */}
                    {errors.submit && (
                        <div className="error-message submit-error">
                            {errors.submit}
                        </div>
                    )}
                    
                    <form onSubmit={handleLogin}>
                        {/* Username Input */}
                        <input 
                            type="text" 
                            placeholder="Username" 
                            value={formData.username}
                            onChange={(e) => handleInputChange('username', e.target.value)}
                            className={errors.username ? 'invalid' : ''}
                            disabled={isLoading}
                        />
                        {errors.username && (
                            <div className="error-message">{errors.username}</div>
                        )}

                        {/* Password Input with Toggle */}
                        <div className="password-wrapper">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                placeholder="Password" 
                                value={formData.password}
                                onChange={(e) => handleInputChange('password', e.target.value)}
                                className={errors.password ? 'invalid' : ''}
                                disabled={isLoading}
                            />
                            <img
                                src={showPassword ? "eye-open.png" : "eye-close.png"}
                                alt={showPassword ? "Hide Password" : "Show Password"}
                                className="toggle-password"
                                onClick={togglePasswordVisibility}
                            />
                        </div>
                        {errors.password && (
                            <div className="error-message">{errors.password}</div>
                        )}

                        <button 
                            type="submit" 
                            className="login-btn" 
                            disabled={isLoading}
                        >
                            {isLoading ? 'LOGGING IN...' : 'LOG IN'}
                        </button>
                    </form>

                    {/* Forgot Password Link */}
                    <div className="forgot-password-link">
                        <button 
                            type="button" 
                            className="forgot-password-btn"
                            onClick={toggleForgotPassword}
                        >
                            Forgot Password?
                        </button>
                    </div>

                    <div className="or-line">
                        <span>OR</span>
                    </div>

                    <p className="signup-text">
                        New to Old Goods? <Link to="/signup">Sign Up</Link>
                    </p>
                </section>
            </main>

            {/* FORGOT PASSWORD MODAL */}
            {showForgotPassword && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Reset Your Password</h3>
                            <button 
                                className="close-modal-btn"
                                onClick={toggleForgotPassword}
                            >
                                ×
                            </button>
                        </div>
                        
                        <div className="modal-body">
                            {forgotPasswordSuccess && (
                                <div className="success-message">
                                    ✅ {forgotPasswordSuccess}
                                </div>
                            )}
                            
                            {forgotPasswordErrors.submit && (
                                <div className="error-message">
                                    ❌ {forgotPasswordErrors.submit}
                                </div>
                            )}
                            
                            <form onSubmit={handleForgotPassword}>
                                <div className="form-group">
                                    <label>Username *</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter your username" 
                                        value={forgotPasswordData.username}
                                        onChange={(e) => handleForgotPasswordChange('username', e.target.value)}
                                        className={forgotPasswordErrors.username ? 'invalid' : ''}
                                        disabled={isLoading}
                                    />
                                    {forgotPasswordErrors.username && (
                                        <div className="error-message">{forgotPasswordErrors.username}</div>
                                    )}
                                </div>
                                
                                <div className="form-group">
                                    <label>Email *</label>
                                    <input 
                                        type="email" 
                                        placeholder="Enter your email" 
                                        value={forgotPasswordData.email}
                                        onChange={(e) => handleForgotPasswordChange('email', e.target.value)}
                                        className={forgotPasswordErrors.email ? 'invalid' : ''}
                                        disabled={isLoading}
                                    />
                                    {forgotPasswordErrors.email && (
                                        <div className="error-message">{forgotPasswordErrors.email}</div>
                                    )}
                                </div>
                                
                                <div className="form-group">
                                    <label>New Password *</label>
                                    <div className="password-wrapper">
                                        <input 
                                            type={showNewPassword ? "text" : "password"} 
                                            placeholder="Enter new password" 
                                            value={forgotPasswordData.new_password}
                                            onChange={(e) => handleForgotPasswordChange('new_password', e.target.value)}
                                            className={forgotPasswordErrors.new_password ? 'invalid' : ''}
                                            disabled={isLoading}
                                        />
                                        <img
                                            src={showNewPassword ? "eye-open.png" : "eye-close.png"}
                                            alt={showNewPassword ? "Hide Password" : "Show Password"}
                                            className="toggle-password"
                                            onClick={toggleNewPasswordVisibility}
                                        />
                                    </div>
                                    {forgotPasswordErrors.new_password && (
                                        <div className="error-message">{forgotPasswordErrors.new_password}</div>
                                    )}
                                </div>
                                
                                <div className="form-group">
                                    <label>Confirm New Password *</label>
                                    <div className="password-wrapper">
                                        <input 
                                            type={showConfirmPassword ? "text" : "password"} 
                                            placeholder="Confirm new password" 
                                            value={forgotPasswordData.confirm_password}
                                            onChange={(e) => handleForgotPasswordChange('confirm_password', e.target.value)}
                                            className={forgotPasswordErrors.confirm_password ? 'invalid' : ''}
                                            disabled={isLoading}
                                        />
                                        <img
                                            src={showConfirmPassword ? "eye-open.png" : "eye-close.png"}
                                            alt={showConfirmPassword ? "Hide Password" : "Show Password"}
                                            className="toggle-password"
                                            onClick={toggleConfirmPasswordVisibility}
                                        />
                                    </div>
                                    {forgotPasswordErrors.confirm_password && (
                                        <div className="error-message">{forgotPasswordErrors.confirm_password}</div>
                                    )}
                                </div>
                                
                                <div className="modal-actions">
                                    <button 
                                        type="button" 
                                        className="cancel-btn"
                                        onClick={toggleForgotPassword}
                                        disabled={isLoading}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="reset-btn"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? 'RESETTING...' : 'RESET PASSWORD'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

<Footer/>
        </>
    );
}

export default Login;