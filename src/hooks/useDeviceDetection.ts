import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface DeviceInfo {
  browser: string;
  os: string;
  platform: string;
  userAgent: string;
  screenResolution: string;
  language: string;
  timezone: string;
}

interface DeviceSession {
  id: string;
  device_id: string;
  device_name: string | null;
  device_info: Json | null;
  is_approved: boolean;
  is_current: boolean;
  login_time: string;
}

// Generate a unique device fingerprint
const generateDeviceId = (): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('device-fingerprint', 2, 2);
  }
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.platform,
    canvas.toDataURL()
  ].join('|');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return 'DEV-' + Math.abs(hash).toString(36).toUpperCase();
};

// Get device info for display
const getDeviceInfo = (): DeviceInfo => {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let os = 'Unknown';
  
  // Detect browser
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';
  
  // Detect OS
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  
  return {
    browser,
    os,
    platform: navigator.platform,
    userAgent: ua,
    screenResolution: `${screen.width}x${screen.height}`,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
};

// Generate device name
const getDeviceName = (): string => {
  const info = getDeviceInfo();
  return `${info.browser} on ${info.os}`;
};

export const useDeviceDetection = () => {
  const [deviceId] = useState(() => {
    // Try to get existing device ID from localStorage
    let id = localStorage.getItem('admin_device_id');
    if (!id) {
      id = generateDeviceId();
      localStorage.setItem('admin_device_id', id);
    }
    return id;
  });
  
  // Check for persistent admin session
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('admin_logged_in') === 'true';
  });
  
  const [deviceStatus, setDeviceStatus] = useState<'loading' | 'approved' | 'pending' | 'new'>('loading');
  const [currentSession, setCurrentSession] = useState<DeviceSession | null>(null);
  const [allSessions, setAllSessions] = useState<DeviceSession[]>([]);
  const [isChecking, setIsChecking] = useState(true);
  
  const persistLogin = () => {
    localStorage.setItem('admin_logged_in', 'true');
    setIsLoggedIn(true);
  };
  
  const clearLogin = () => {
    localStorage.removeItem('admin_logged_in');
    setIsLoggedIn(false);
  };

  const deviceInfo = getDeviceInfo();
  const deviceName = getDeviceName();

  const checkDeviceStatus = useCallback(async () => {
    setIsChecking(true);
    
    // Check if this device exists in admin_sessions
    const { data: sessions, error } = await supabase
      .from('admin_sessions')
      .select('*')
      .eq('device_id', deviceId);
    
    if (error) {
      console.error('Error checking device status:', error);
      setIsChecking(false);
      return;
    }
    
    if (sessions && sessions.length > 0) {
      const session = sessions[0] as unknown as DeviceSession;
      setCurrentSession(session);
      
      if (session.is_approved) {
        setDeviceStatus('approved');
      } else {
        setDeviceStatus('pending');
      }
    } else {
      setDeviceStatus('new');
    }
    
    setIsChecking(false);
  }, [deviceId]);

  const registerDevice = async () => {
    // Check if there are any existing approved devices
    const { data: existingSessions } = await supabase
      .from('admin_sessions')
      .select('id')
      .eq('is_approved', true);
    
    // If no approved devices exist, auto-approve the first one
    const isFirstDevice = !existingSessions || existingSessions.length === 0;
    
    const deviceInfoJson: Json = {
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      platform: deviceInfo.platform,
      userAgent: deviceInfo.userAgent,
      screenResolution: deviceInfo.screenResolution,
      language: deviceInfo.language,
      timezone: deviceInfo.timezone
    };
    
    const { data, error } = await supabase
      .from('admin_sessions')
      .insert([{
        device_id: deviceId,
        device_name: deviceName,
        device_info: deviceInfoJson,
        is_approved: isFirstDevice, // Auto-approve first device
        is_current: true
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error registering device:', error);
      return false;
    }
    
    setCurrentSession(data as DeviceSession);
    
    if (isFirstDevice) {
      setDeviceStatus('approved');
    } else {
      setDeviceStatus('pending');
    }
    
    return true;
  };

  const loadAllSessions = async () => {
    const { data, error } = await supabase
      .from('admin_sessions')
      .select('*')
      .order('login_time', { ascending: false });
    
    if (error) {
      console.error('Error loading sessions:', error);
      return;
    }
    
    setAllSessions((data || []) as unknown as DeviceSession[]);
  };

  const approveDevice = async (sessionId: string) => {
    const { error } = await supabase
      .from('admin_sessions')
      .update({ is_approved: true })
      .eq('id', sessionId);
    
    if (error) {
      console.error('Error approving device:', error);
      return false;
    }
    
    await loadAllSessions();
    return true;
  };

  const removeDevice = async (sessionId: string) => {
    const { error } = await supabase
      .from('admin_sessions')
      .delete()
      .eq('id', sessionId);
    
    if (error) {
      console.error('Error removing device:', error);
      return false;
    }
    
    await loadAllSessions();
    return true;
  };

  // Poll for approval status when pending
  useEffect(() => {
    if (deviceStatus !== 'pending') return;
    
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('admin_sessions')
        .select('is_approved')
        .eq('device_id', deviceId)
        .single();
      
      if (data?.is_approved) {
        setDeviceStatus('approved');
        clearInterval(interval);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [deviceStatus, deviceId]);

  useEffect(() => {
    checkDeviceStatus();
  }, [checkDeviceStatus]);

  return {
    deviceId,
    deviceName,
    deviceInfo,
    deviceStatus,
    currentSession,
    allSessions,
    isChecking,
    isLoggedIn,
    registerDevice,
    loadAllSessions,
    approveDevice,
    removeDevice,
    checkDeviceStatus,
    persistLogin,
    clearLogin
  };
};
