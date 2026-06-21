import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { getStoredAccessToken } from '../utils/authFetch';
import Navbar from '../components/Navbar';
import './AuthPages.css';

const SignupPage = () => {
  const navigate = useNavigate();
  const { signup, user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && getStoredAccessToken()) {
      navigate('/user', { replace: true });
    }
  }, [authLoading, user, navigate]);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    nationalId: '',
    username: '',
    gmail: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const validateForm = () => {
    const errors = [];

    if (!formData.firstName || !formData.lastName || !formData.phoneNumber ||
        !formData.nationalId || !formData.username || !formData.gmail || !formData.password) {
      setError('All fields are required');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    const pwd = formData.password;
    const pwdReqs = [];
    if (pwd.length < 8) pwdReqs.push('At least 8 characters');
    if (!/[A-Z]/.test(pwd)) pwdReqs.push('1 uppercase letter');
    if (!/[0-9]/.test(pwd)) pwdReqs.push('1 number');
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) pwdReqs.push('1 special character (e.g. #, !, @, $, %, &, *)');
    if (pwdReqs.length > 0) errors.push(`Password must have: ${pwdReqs.join(', ')}`);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.gmail)) errors.push('Please enter a valid email address');

    const nationalIdDigits = String(formData.nationalId).replace(/\D/g, '');
    if (nationalIdDigits.length !== 14) errors.push('National ID must be exactly 14 digits');

    const phoneDigits = String(formData.phoneNumber).replace(/\D/g, '');
    if (phoneDigits.length !== 11) errors.push('Phone number must be exactly 11 digits');

    if (errors.length > 0) {
      setError(errors.map(e => `• ${e}`).join('\n'));
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    const { confirmPassword, ...rest } = formData;
    const result = await signup({ ...rest, role: 'user' });

    setLoading(false);

    if (result.success) {
      // Redirect to login – user must log in before accessing dashboard
      navigate('/login', { state: { fromSignup: true } });
    } else {
      setError(result.error || 'Signup failed. Please try again.');
    }
  };

  return (
    <div className="auth-page-wrap">
      <Navbar showAuthLinks />
      <div className="auth-container">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="auth-card-logo">
          <img
            src={`${process.env.PUBLIC_URL || ''}/parkgo-logo.png`}
            alt="ParkGO"
            onError={(e) => {
              e.target.style.display = 'none';
              const fb = e.target.nextElementSibling;
              if (fb) fb.style.display = 'block';
            }}
          />
          <span className="auth-card-logo-fallback" style={{ display: 'none' }}>ParkGO</span>
        </div>
        <h2>Create Account</h2>
        <p className="auth-subtitle">Sign up to get started with ParkGo</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name *</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                placeholder="Enter your first name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name *</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                placeholder="Enter your last name"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="phoneNumber">Phone Number *</label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              required
              placeholder="Enter your phone number"
            />
          </div>

          <div className="form-group">
            <label htmlFor="nationalId">National ID *</label>
            <input
              type="text"
              id="nationalId"
              name="nationalId"
              value={formData.nationalId}
              onChange={handleChange}
              required
              placeholder="Enter your national ID"
            />
          </div>

          <div className="form-group">
            <label htmlFor="username">Username *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="Choose a username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="gmail">Email (Gmail) *</label>
            <input
              type="email"
              id="gmail"
              name="gmail"
              value={formData.gmail}
              onChange={handleChange}
              required
              placeholder="Enter your email"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Create a password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder="Confirm password"
              />
            </div>
          </div>

          <button type="submit" className="auth-button" disabled={loading || authLoading}>
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </motion.div>
      </div>
    </div>
  );
};

export default SignupPage;
