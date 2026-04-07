import { useState, useEffect, useRef } from 'react';
import { Fingerprint, Lock, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import './LockScreen.css';

const PIN_LENGTH = 6;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos de inactividad

export default function LockScreen({ children }) {
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [setupPin, setSetupPin] = useState('');
  
  // Referencia para el timeout de inactividad
  const timeoutRef = useRef(null);

  // Inicializar y chequear si hay PIN guardado
  useEffect(() => {
    const savedPin = localStorage.getItem('abasto_station_pin');
    if (!savedPin) {
      setIsSetupMode(true);
    }
  }, []);

  // Lógica de inactividad
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

  // Manejo del teclado númerico para PIN
  const handleKeypad = (num) => {
    setError('');
    if (pin.length < PIN_LENGTH) {
      const newPin = pin + num;
      setPin(newPin);

      // Si alcanzó la longitud máxima, validar
      if (newPin.length === PIN_LENGTH) {
        validatePin(newPin);
      }
    }
  };

  const deleteNumber = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const validatePin = (inputPin) => {
    if (isSetupMode) {
      if (!setupPin) {
        // Primera pasada del setup
        setSetupPin(inputPin);
        setPin('');
      } else {
        // Segunda pasada (Confirmación)
        if (inputPin === setupPin) {
          localStorage.setItem('abasto_station_pin', inputPin);
          setIsSetupMode(false);
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
      // Modo Desbloqueo normal
      const savedPin = localStorage.getItem('abasto_station_pin');
      if (inputPin === savedPin) {
        setIsLocked(false);
        setPin('');
      } else {
        setError('PIN Incorrecto');
        setPin('');
      }
    }
  };

  // Autenticación Biométrica (WebAuthn simulado/nativo)
  const handleBiometric = async () => {
    if (!window.PublicKeyCredential) {
      setError('Biometría no soportada en este dispositivo.');
      return;
    }
    
    // Aquí implementaremos el llamado a WebAuthn. 
    // Por simplicidad en la demo, mostraremos un prompt del navegador si es posible.
    try {
      // Simulación de check biométrico del dispositivo
      // En un entorno de producción, aquí se usa navigator.credentials.get({ publicKey: ... })
      setTimeout(() => {
         setError('Integración FaceID/TouchID pendiente de certificados SSL/WebAuthn en tu dominio final.');
      }, 1000);
    } catch (err) {
      console.error(err);
      setError('Fallo biométrico');
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
          <h2>{isSetupMode ? (setupPin ? 'Confirma tu PIN' : 'Crea un PIN Maestro') : 'Estación Bloqueada'}</h2>
          <p className="subtitle">
            {isSetupMode 
              ? 'Este PIN protegerá el acceso a la gestión de licencias.' 
              : 'Ingresa tu PIN de 6 dígitos para acceder'}
          </p>
        </div>

        {/* Indicadores de 6 dígitos */}
        <div className="pin-indicators">
          {Array(PIN_LENGTH).fill(0).map((_, i) => (
            <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''} ${error ? 'error' : ''}`}></div>
          ))}
        </div>
        
        {error && <div className="error-text"><AlertCircle size={14}/> {error}</div>}

        {/* Teclado Numérico */}
        <div className="keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} onClick={() => handleKeypad(num.toString())} className="key-btn">{num}</button>
          ))}
          <button onClick={handleBiometric} className="key-btn action-key" title="Usar Huella/FaceID">
            <Fingerprint size={24} />
          </button>
          <button onClick={() => handleKeypad('0')} className="key-btn">0</button>
          <button onClick={deleteNumber} className="key-btn action-key">⌫</button>
        </div>

      </div>
    </div>
  );
}
