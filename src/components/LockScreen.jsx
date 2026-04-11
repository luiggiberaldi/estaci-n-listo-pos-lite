import { useState, useEffect, useRef } from 'react';
import { Lock, Shield, AlertCircle } from 'lucide-react';
import {
  hashPinSecure, verifyPinSecure, hasPinV2, hasLegacyPinOnly,
  savePinHash, getPinHash, clearPin
} from '../utils';
import './LockScreen.css';

const PIN_LENGTH = 6;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

export default function LockScreen({ children, lockRef }) {
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [setupPin, setSetupPin] = useState('');
  const [migrating, setMigrating] = useState(false);

  const timeoutRef = useRef(null);

  // Expose lock() to parent via lockRef
  useEffect(() => {
    if (lockRef) {
      lockRef.current = () => {
        setIsLocked(true);
        setPin('');
        setError('');
      };
    }
  }, [lockRef]);

  useEffect(() => {
    if (hasLegacyPinOnly()) {
      // Old SHA-256 hash detected — force PIN re-setup for security upgrade
      setMigrating(true);
      clearPin();
      setIsSetupMode(true);
    } else if (!hasPinV2()) {
      setIsSetupMode(true);
    }
  }, []);

  const resetTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!isLocked) {
      timeoutRef.current = setTimeout(() => {
        setIsLocked(true);
        setPin('');
      }, LOCK_TIMEOUT_MS);
    }
  };

  useEffect(() => {
    resetTimeout();
    window.addEventListener('mousemove', resetTimeout);
    window.addEventListener('keydown', resetTimeout);
    window.addEventListener('click', resetTimeout);
    return () => {
      clearTimeout(timeoutRef.current);
      window.removeEventListener('mousemove', resetTimeout);
      window.removeEventListener('keydown', resetTimeout);
      window.removeEventListener('click', resetTimeout);
    };
  }, [isLocked]);

  const handleKeypad = (num) => {
    setError('');
    if (pin.length < PIN_LENGTH) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === PIN_LENGTH) {
        validatePin(newPin);
      }
    }
  };

  const deleteNumber = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const validatePin = async (inputPin) => {
    if (isSetupMode) {
      if (!setupPin) {
        setSetupPin(inputPin);
        setPin('');
      } else {
        if (inputPin === setupPin) {
          const hashed = await hashPinSecure(inputPin);
          savePinHash(hashed);
          setIsSetupMode(false);
          setMigrating(false);
          setIsLocked(false);
          setPin('');
          setSetupPin('');
        } else {
          setError('El PIN no coincide. Intenta de nuevo.');
          setPin('');
          setSetupPin('');
        }
      }
    } else {
      const stored = getPinHash();
      const valid = stored ? await verifyPinSecure(inputPin, stored) : false;
      if (valid) {
        setIsLocked(false);
        setPin('');
      } else {
        setError('PIN Incorrecto');
        setPin('');
      }
    }
  };

  if (!isLocked && !isSetupMode) {
    return <>{children}</>;
  }

  return (
    <div className="lockscreen-overlay">
      <div className="lockscreen-panel fade-in-up">

        <div className="lock-header">
          <div className={`lock-icon ${error ? 'error-shake' : ''}`}>
            {isSetupMode ? <Shield size={32} /> : <Lock size={32} />}
          </div>
          <h2>
            {isSetupMode
              ? (setupPin ? 'Confirma tu PIN' : (migrating ? 'Actualiza tu PIN de Seguridad' : 'Crea un PIN Maestro'))
              : 'Estación Bloqueada'}
          </h2>
          <p className="subtitle">
            {isSetupMode
              ? (migrating
                  ? 'Tu PIN fue actualizado al sistema de seguridad PBKDF2. Crea uno nuevo.'
                  : 'Este PIN protegerá el acceso a la gestión de licencias.')
              : 'Ingresa tu PIN de 6 dígitos para acceder'}
          </p>
        </div>

        <div className="pin-indicators">
          {Array(PIN_LENGTH).fill(0).map((_, i) => (
            <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''} ${error ? 'error' : ''}`}></div>
          ))}
        </div>

        {error && <div className="error-text"><AlertCircle size={14}/> {error}</div>}

        <div className="keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} onClick={() => handleKeypad(num.toString())} className="key-btn">{num}</button>
          ))}
          <button className="key-btn action-key" style={{ opacity: 0, pointerEvents: 'none' }} aria-hidden="true" tabIndex={-1} />
          <button onClick={() => handleKeypad('0')} className="key-btn">0</button>
          <button onClick={deleteNumber} className="key-btn action-key">⌫</button>
        </div>

      </div>
    </div>
  );
}
