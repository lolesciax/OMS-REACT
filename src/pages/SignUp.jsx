import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import '../components/Footer.css';
import Footer from '../components/Footer';
import Captcha from '../components/Captcha';
import { authAPI } from '../services/api';
import {
  validateUsername,
  validateEmail,
  validatePassword,
  validateConfirmPassword
} from '../utils/validation';
import '../styles/SignUp.css';
import paymaya from '../assets/paymaya.png';
import gcash from '../assets/gcash.png';
import facebook from '../assets/facebook.png';
import instagram from '../assets/instagram.png';
import tiktok from '../assets/tiktok.png';

const SignUp = () => {
  const navigate = useNavigate();
  
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    captcha: ''
  });

  // Error state
  const [errors, setErrors] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    captcha: '',
    submit: ''
  });

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentCaptcha, setCurrentCaptcha] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [emailAvailable, setEmailAvailable] = useState(null);

  // Handle input changes
  const handleInputChange = async (field, value) => {
    // Apply character limit for username
    if (field === 'username' && value.length > 16) {
      return; // Don't update if exceeds limit
    }
    
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    
    // Clear submit errors when user starts typing
    if (errors.submit) {
      setErrors(prev => ({ ...prev, submit: '' }));
    }
    
    // Validate field
    await validateField(field, value, newFormData);
  };

  // Validate individual field
  const validateField = async (field, value, formData) => {
    let error = '';

    switch (field) {
      case 'username':
        error = validateUsername(value);
        if (!error && value.length >= 3) {
          // Check username availability
          await checkUsernameAvailability(value);
        } else {
          setUsernameAvailable(null);
        }
        break;
      case 'email':
        error = validateEmail(value);
        if (!error && value) {
          // Check email availability
          await checkEmailAvailability(value);
        } else {
          setEmailAvailable(null);
        }
        break;
      case 'password':
        error = validatePassword(value);
        break;
      case 'confirmPassword':
        error = validateConfirmPassword(formData.password, value);
        break;
      case 'captcha':
        if (value !== currentCaptcha) {
          error = "Captcha incorrect! Please try again.";
        }
        break;
      default:
        break;
    }

    setErrors(prev => ({ ...prev, [field]: error }));
    checkFormValidity({ ...formData, [field]: value });
  };

  // Check username availability
  const checkUsernameAvailability = async (username) => {
    if (username.length < 3) return;
    
    setIsCheckingUsername(true);
    try {
      const result = await authAPI.checkUsername(username);
      setUsernameAvailable(result.available);
      
      if (!result.available) {
        setErrors(prev => ({ 
          ...prev, 
          username: 'Username already taken. Please choose another one.' 
        }));
      }
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameAvailable(null);
    } finally {
      setIsCheckingUsername(false);
    }
  };

  // Check email availability
  const checkEmailAvailability = async (email) => {
    if (!email) return;
    
    setIsCheckingEmail(true);
    try {
      const result = await authAPI.checkEmail(email);
      setEmailAvailable(result.available);
      
      if (!result.available) {
        setErrors(prev => ({ 
          ...prev, 
          email: 'Email already registered. Please use a different email or login.' 
        }));
      }
    } catch (error) {
      console.error('Error checking email:', error);
      setEmailAvailable(null);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // Check if entire form is valid
  const checkFormValidity = (formData) => {
    const isUsernameValid = !validateUsername(formData.username) && usernameAvailable;
    const isEmailValid = !validateEmail(formData.email) && emailAvailable;
    const isPasswordValid = !validatePassword(formData.password);
    const isConfirmValid = !validateConfirmPassword(formData.password, formData.confirmPassword);
    const isCaptchaValid = formData.captcha === currentCaptcha;

    const isValid = isUsernameValid && isEmailValid && isPasswordValid && 
                   isConfirmValid && isCaptchaValid;
    
    setIsFormValid(isValid);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isFormValid || isLoading) {
      alert('Please fix all form errors before submitting.');
      return;
    }

    setIsLoading(true);

    try {
      // Prepare data for backend
      const signupData = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password
      };
      
      const result = await authAPI.signUp(signupData);
      
      alert('Sign Up Successful! You can now login.');
      
      // Reset form
      setFormData({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        captcha: ''
      });
      setCurrentCaptcha(''); // This will trigger Captcha to regenerate
      setIsFormValid(false);
      setUsernameAvailable(null);
      setEmailAvailable(null);
      
      // Redirect to login page
      navigate('/login');
      
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        submit: error.message || 'Signup failed. Please try again.'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = (field) => {
    if (field === 'password') {
      setShowPassword(!showPassword);
    } else {
      setShowConfirmPassword(!showConfirmPassword);
    }
  };

  // Refresh CAPTCHA
  const refreshCaptcha = () => {
    setCurrentCaptcha(''); // This will trigger the Captcha component to regenerate
    setFormData(prev => ({ ...prev, captcha: '' }));
    setErrors(prev => ({ ...prev, captcha: '' }));
  };

  // Get validation class for input fields
  const getValidationClass = (field, value) => {
    if (errors[field]) return 'invalid';
    
    if (!value) return '';
    
    switch (field) {
      case 'username':
        if (isCheckingUsername) return 'checking';
        if (usernameAvailable === true) return 'valid';
        if (usernameAvailable === false) return 'invalid';
        return !validateUsername(value) ? 'valid' : '';
      case 'email':
        if (isCheckingEmail) return 'checking';
        if (emailAvailable === true) return 'valid';
        if (emailAvailable === false) return 'invalid';
        return !validateEmail(value) ? 'valid' : '';
      case 'password':
        return !validatePassword(value) ? 'valid' : '';
      case 'confirmPassword':
        return value === formData.password && !validateConfirmPassword(formData.password, value) ? 'valid' : '';
      case 'captcha':
        return value === currentCaptcha ? 'valid' : '';
      default:
        return '';
    }
  };

  // Get username status message
  const getUsernameStatus = () => {
    if (isCheckingUsername) return 'Checking username availability...';
    if (usernameAvailable === true) return '✓ Username available';
    if (usernameAvailable === false) return '✗ Username already taken';
    return '';
  };

  // Get email status message
  const getEmailStatus = () => {
    if (isCheckingEmail) return 'Checking email availability...';
    if (emailAvailable === true) return '✓ Email available';
    if (emailAvailable === false) return '✗ Email already registered';
    return '';
  };

  return (
    <div className="signup-page">
      <Header title="Sign Up" />
     
      <main className="main-container">
        <section className="promo-section">
          <h1>The Best Finds of the Year</h1>
          <p>Bermonths of Unique Deals.</p>
          <p><strong>'Ber' Ready to Save.</strong></p>
        </section>

        <section className="form-container">
          <h2>Sign Up</h2>
          
          {errors.submit && (
            <div className="error-message submit-error">
              ❌ {errors.submit}
            </div>
          )}
          
          <form id="signup-form" onSubmit={handleSubmit}>
            {/* Username */}
            <div className="username-container">
              <input
                type="text"
                id="username"
                placeholder="Username (3-16 characters)"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className={getValidationClass('username', formData.username)}
                disabled={isLoading}
                maxLength={16}
              />
              {formData.username && !errors.username && (
                <div className={`username-status ${usernameAvailable === true ? 'available' : 'taken'}`}>
                  {getUsernameStatus()}
                </div>
              )}
            </div>
            {errors.username && (
              <div id="username-error" className="error-message">
                {errors.username}
              </div>
            )}

            {/* Email */}
            <div className="email-container">
              <input
                type="email"
                id="email"
                placeholder="Email (example@gmail.com)"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={getValidationClass('email', formData.email)}
                disabled={isLoading}
              />
              {formData.email && !errors.email && (
                <div className={`email-status ${emailAvailable === true ? 'available' : 'taken'}`}>
                  {getEmailStatus()}
                </div>
              )}
            </div>
            {errors.email && (
              <div id="email-error" className="error-message">
                {errors.email}
              </div>
            )}

            {/* Password */}
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={getValidationClass('password', formData.password)}
                disabled={isLoading}
              />
              <img
                src={showPassword ? "eye-open.png" : "eye-close.png"}
                alt="Show Password"
                className="toggle-password"
                onClick={() => togglePasswordVisibility('password')}
              />
            </div>
            {errors.password && (
              <div id="password-error" className="error-message">
                {errors.password}
              </div>
            )}

            {/* Confirm Password */}
            <div className="password-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirm-password"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                className={getValidationClass('confirmPassword', formData.confirmPassword)}
                disabled={isLoading}
              />
              <img
                src={showConfirmPassword ? "eye-open.png" : "eye-close.png"}
                alt="Show Password"
                className="toggle-password"
                onClick={() => togglePasswordVisibility('confirmPassword')}
              />
            </div>
            {errors.confirmPassword && (
              <div id="confirm-error" className="error-message">
                {errors.confirmPassword}
              </div>
            )}

            {/* CAPTCHA */}
            <div className="captcha-container">
              <Captcha onCaptchaChange={setCurrentCaptcha} />
            </div>
            
            <input
              type="text"
              id="captcha-input"
              className={`captcha-input ${getValidationClass('captcha', formData.captcha)}`}
              placeholder="Enter CAPTCHA"
              value={formData.captcha}
              onChange={(e) => handleInputChange('captcha', e.target.value)}
              disabled={isLoading}
            />
            {errors.captcha && (
              <div id="captcha-error" className="error-message">
                {errors.captcha}
              </div>
            )}

            <button 
              type="submit" 
              id="signup-btn" 
              className="btn-signup" 
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? 'SIGNING UP...' : 'SIGN UP'}
            </button>
          </form>

          <p className="login-text">
            Already have an account?{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>
              Log In
            </a>
          </p>
        </section>
        
      </main>
      <Footer />
    </div>
  );
};

export default SignUp;