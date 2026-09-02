import { useState, useEffect } from 'react';
import { useAppNavigate as useNavigate } from '@/lib/navigate';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  Settings, Package, Image, List, CreditCard, LogOut, Save, 
  Plus, Trash2, Edit2, Eye, EyeOff, RefreshCw, MessageSquare, Shield, ShieldX, ShieldOff, Key, FileText, FileCode, Upload, Tag, CheckCircle, Copy, Database, MapPin, Coins, Users
} from 'lucide-react';
import GlobalBackground from '@/components/GlobalBackground';
import DeviceApprovalScreen from '@/components/DeviceApprovalScreen';
import DeviceManagement from '@/components/DeviceManagement';
import KeyManagement from '@/components/KeyManagement';
import ApiDocumentation from '@/components/ApiDocumentation';
import ScriptManagement from '@/components/ScriptManagement';
import LuaUploadManager from '@/components/LuaUploadManager';
import ScriptObfuscator from '@/components/ScriptObfuscator';
import DiscountManagement from '@/components/DiscountManagement';
import BackupRestore from '@/components/BackupRestore';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';
import CasakuMonitor from '@/components/CasakuMonitor';
import { useBackground } from '@/contexts/BackgroundContext';

const MEDIA_BASE = 'https://tools.arexans.my.id/media';

interface SiteSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

interface PackageItem {
  id: string;
  name: string;
  display_name: string;
  price_per_day: number;
  description: string | null;
  features: string[] | null;
  is_active: boolean;
  sort_order: number;
}

interface AdItem {
  id: string;
  title: string;
  media_url: string;
  media_type: string;
  link_url: string | null;
  is_active: boolean;
  sort_order: number;
}

interface BackgroundItem {
  id: string;
  title: string;
  background_url: string;
  background_type: string;
  is_muted: boolean;
  is_active: boolean;
  sort_order: number;
}

interface TransactionItem {
  id: string;
  transaction_id: string;
  customer_name: string;
  customer_whatsapp: string | null;
  package_name: string;
  package_duration: number;
  original_amount: number;
  total_amount: number;
  status: string;
  license_key: string | null;
  created_at: string;
  paid_at: string | null;
  ip_address: string | null;
}

interface SocialLink {
  id: string;
  name: string;
  icon_type: string;
  url: string;
  label: string;
  link_location: string;
  is_active: boolean;
  sort_order: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const { showBackground, refetch: refetchBackgrounds } = useBackground();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Device detection hook
  const {
    deviceId,
    deviceName,
    deviceStatus,
    allSessions,
    isChecking,
    isLoggedIn,
    registerDevice,
    loadAllSessions,
    approveDevice,
    removeDevice,
    persistLogin,
    clearLogin
  } = useDeviceDetection();
  
  // Use persistent login state
  const [authenticated, setAuthenticated] = useState(isLoggedIn);

  // Settings state
  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  
  // Packages state
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [editingPackage, setEditingPackage] = useState<PackageItem | null>(null);
  
  // Ads state
  const [ads, setAds] = useState<AdItem[]>([]);
  const [editingAd, setEditingAd] = useState<AdItem | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  
  // Backgrounds state
  const [backgrounds, setBackgrounds] = useState<BackgroundItem[]>([]);
  const [editingBackground, setEditingBackground] = useState<BackgroundItem | null>(null);
  
   // Transactions state
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [txTab, setTxTab] = useState<'keysystem' | 'xcoins'>('keysystem');
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [txSearch, setTxSearch] = useState('');

  // Social Links state
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [editingSocialLink, setEditingSocialLink] = useState<SocialLink | null>(null);

  // Blocked IPs state
  const [blockedIps, setBlockedIps] = useState<{id: string; ip_address: string; reason: string | null; blocked_by: string | null; created_at: string}[]>([]);
  const [newBlockIp, setNewBlockIp] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');

  // XCoins users state
  const [xcoinsUsers, setXcoinsUsers] = useState<{id: string; phone: string; display_name: string | null; balance: number; is_active: boolean; created_at: string}[]>([]);
  const [keysSubTab, setKeysSubTab] = useState<'keysystem' | 'xcoins'>('keysystem');
  const [xcoinsSearch, setXcoinsSearch] = useState('');
  const [editingXcoinsUser, setEditingXcoinsUser] = useState<{id: string; phone: string; display_name: string | null; balance: number; is_active: boolean} | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('');

  const adjustXcoinsBalance = async (user: {id: string; balance: number; display_name: string | null}, delta: number) => {
    const newBalance = Math.max(0, user.balance + delta);
    const { error } = await supabase.from('xcoins_balances').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('id', user.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    await supabase.from('xcoins_transactions').insert({
      user_id: user.id,
      type: delta >= 0 ? 'admin_credit' : 'admin_debit',
      amount: delta,
      balance_after: newBalance,
      description: `Admin ${delta >= 0 ? 'menambah' : 'mengurangi'} saldo (${Math.abs(delta)} XCoins)`,
    });
    toast({ title: 'Berhasil', description: `Saldo ${user.display_name || 'user'} sekarang ${newBalance}` });
    loadAllData();
  };

  const saveXcoinsUser = async () => {
    if (!editingXcoinsUser) return;
    const { error } = await supabase.from('xcoins_balances').update({
      display_name: editingXcoinsUser.display_name,
      phone: editingXcoinsUser.phone,
      balance: editingXcoinsUser.balance,
      is_active: editingXcoinsUser.is_active,
      updated_at: new Date().toISOString(),
    }).eq('id', editingXcoinsUser.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Berhasil', description: 'Data pengguna diupdate' });
    setEditingXcoinsUser(null);
    loadAllData();
  };

  const toggleBlockXcoinsUser = async (user: {id: string; phone: string; is_active: boolean}) => {
    const { error } = await supabase.from('xcoins_balances').update({ is_active: !user.is_active, updated_at: new Date().toISOString() }).eq('id', user.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Berhasil', description: `Pengguna ${user.phone} ${!user.is_active ? 'diaktifkan' : 'diblokir'}` });
    loadAllData();
  };

  const deleteXcoinsUser = async (id: string, phone: string) => {
    if (!confirm(`Yakin hapus pengguna XCoins ${phone}? Aksi ini tidak bisa dibatalkan.`)) return;
    await supabase.from('xcoins_transactions').delete().eq('user_id', id);
    const { error } = await supabase.from('xcoins_balances').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Berhasil', description: `Pengguna ${phone} dihapus` });
    loadAllData();
  };

  const filteredXcoinsUsers = xcoinsUsers.filter(u => {
    if (!xcoinsSearch.trim()) return true;
    const q = xcoinsSearch.toLowerCase();
    return u.phone.toLowerCase().includes(q) || (u.display_name || '').toLowerCase().includes(q);
  });

  // IP Geolocation state
  const [geoIp, setGeoIp] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // Transaction editing state
  const [editingTransaction, setEditingTransaction] = useState<TransactionItem | null>(null);

  const keySystemTx = transactions.filter(tx => tx.package_name !== 'XCOINS_TOPUP');
  const xcoinsTx = transactions.filter(tx => tx.package_name === 'XCOINS_TOPUP');
  const filteredTxList = (txTab === 'xcoins' ? xcoinsTx : keySystemTx).filter(tx => {
    if (!txSearch.trim()) return true;
    const q = txSearch.toLowerCase();
    return tx.transaction_id.toLowerCase().includes(q) || 
           tx.customer_name.toLowerCase().includes(q) || 
           (tx.customer_whatsapp || '').toLowerCase().includes(q) || 
           (tx.license_key || '').toLowerCase().includes(q) || 
           tx.package_name.toLowerCase().includes(q) ||
           tx.status.toLowerCase().includes(q);
  });
  const currentTxList = filteredTxList;

  const toggleSelectTx = (id: string) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTxIds.size === currentTxList.length) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(currentTxList.map(tx => tx.id)));
    }
  };

  const deleteSelectedTransactions = async () => {
    if (selectedTxIds.size === 0) return;
    if (!confirm(`Yakin hapus ${selectedTxIds.size} transaksi?`)) return;
    const ids = Array.from(selectedTxIds);
    const { error } = await supabase.from('transactions').delete().in('id', ids);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: `${ids.length} transaksi dihapus` });
      setSelectedTxIds(new Set());
      loadAllData();
    }
  };

  const saveTransaction = async (tx: TransactionItem) => {
    const { error } = await supabase.from('transactions').update({
      customer_name: tx.customer_name,
      customer_whatsapp: tx.customer_whatsapp,
      package_name: tx.package_name,
      package_duration: tx.package_duration,
      original_amount: tx.original_amount,
      total_amount: tx.total_amount,
      status: tx.status,
      license_key: tx.license_key,
    }).eq('id', tx.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Transaksi berhasil diupdate" });
      setEditingTransaction(null);
      loadAllData();
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!confirm('Yakin hapus transaksi ini?')) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Transaksi berhasil dihapus" });
      loadAllData();
    }
  };

  const blockIp = async (ip: string) => {
    if (!confirm(`Yakin blokir IP ${ip}? User dengan IP ini tidak bisa mengakses website lagi.`)) return;
    const reason = prompt('Alasan blokir (opsional):') || 'Diblokir oleh admin';
    const { error } = await supabase.from('blocked_ips').insert({ ip_address: ip, reason });
    if (error) {
      if (error.code === '23505') {
        toast({ title: "Info", description: "IP ini sudah diblokir sebelumnya" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Berhasil", description: `IP ${ip} berhasil diblokir` });
    }
  };

  const setTransactionPaid = async (id: string) => {
    // Get the transaction first to check if it's XCOINS_TOPUP
    const tx = transactions.find(t => t.id === id);
    
    const { error } = await supabase.from('transactions').update({
      status: 'claimable',
      paid_at: new Date().toISOString()
    }).eq('id', id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    
    // If it's an XCoins topup, auto-credit the user's balance
    if (tx && tx.package_name === 'XCOINS_TOPUP' && tx.license_key) {
      try {
        const userId = tx.license_key; // license_key stores user ID for XCoins topups
        const amount = tx.total_amount;
        
        // Get current balance
        const { data: userData } = await supabase
          .from('xcoins_balances')
          .select('balance, display_name')
          .eq('id', userId)
          .single();
        
        if (userData) {
          const newBalance = userData.balance + amount;
          
          // Update balance
          await supabase.from('xcoins_balances')
            .update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq('id', userId);
          
          // Record transaction
          await supabase.from('xcoins_transactions').insert({
            user_id: userId,
            type: 'deposit',
            amount: amount,
            balance_after: newBalance,
            description: `Deposit ${amount} XCoins (manual approve)`,
            reference_id: tx.transaction_id
          });
          
          // Update transaction status to claimed
          await supabase.from('transactions').update({ status: 'claimed' }).eq('id', id);
          
          toast({ title: "Berhasil", description: `Transaksi diset paid & saldo ${userData.display_name || 'user'} ditambah ${amount} XCoins` });
        } else {
          toast({ title: "Berhasil", description: "Transaksi diset paid (user XCoins tidak ditemukan)" });
        }
      } catch (e) {
        console.error('XCoins credit error:', e);
        toast({ title: "Berhasil", description: "Transaksi diset paid (gagal kredit XCoins)" });
      }
    } else {
      toast({ title: "Berhasil", description: "Transaksi berhasil diset paid (claimable)" });
    }
    loadAllData();
  };

  // Effect to load data on mount if already logged in
  useEffect(() => {
    if (isLoggedIn) {
      setAuthenticated(true);
      loadAllData();
    }
  }, [isLoggedIn]);

  // Developer presence heartbeat — Qris 1 (Casaku) marked offline only when admin device benar-benar
  // kehilangan koneksi (baterai habis / tanpa wifi/internet). Selama perangkat masih online, ping tetap jalan.
  useEffect(() => {
    if (!authenticated) return;
    const ping = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return; // jangan ping saat offline
      try {
        await supabase.from('app_settings').upsert(
          { key: 'developer_last_seen', value: String(Date.now()), description: 'Developer device heartbeat (ms epoch)' },
          { onConflict: 'key' }
        );
      } catch (e) { /* ignore */ }
    };
    ping();
    const iv = setInterval(ping, 20000);
    const onOnline = () => ping();
    window.addEventListener('online', onOnline);
    return () => { clearInterval(iv); window.removeEventListener('online', onOnline); };
  }, [authenticated]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'admin_key')
      .maybeSingle();
    
    if (data && data.value === password) {
      setAuthenticated(true);
      try { sessionStorage.setItem('admin_pwd_cache', password); } catch {}
      persistLogin();
      loadAllData();
    } else {
      toast({ title: "Error", description: "Password salah!", variant: "destructive" });
    }
    setLoading(false);
  };
  
  const handleLogout = () => {
    setAuthenticated(false);
    clearLogin();
  };

  const loadAllData = async () => {
    const [settingsRes, packagesRes, adsRes, backgroundsRes, transactionsRes, socialLinksRes, blockedIpsRes, xcoinsUsersRes] = await Promise.all([
      supabase.from('app_settings').select('*').order('key'),
      supabase.from('packages').select('*').order('sort_order'),
      supabase.from('ads').select('*').order('sort_order'),
      supabase.from('backgrounds').select('*').order('sort_order'),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }),
      supabase.from('social_links').select('*').order('sort_order'),
      supabase.from('blocked_ips').select('*').order('created_at', { ascending: false }),
      supabase.from('xcoins_balances').select('*').order('created_at', { ascending: false })
    ]);
    
    if (settingsRes.data) setSettings(settingsRes.data);
    if (packagesRes.data) setPackages(packagesRes.data);
    if (adsRes.data) setAds(adsRes.data);
    if (backgroundsRes.data) setBackgrounds(backgroundsRes.data);
    if (transactionsRes.data) setTransactions(transactionsRes.data);
    if (socialLinksRes.data) setSocialLinks(socialLinksRes.data);
    if (blockedIpsRes.data) setBlockedIps(blockedIpsRes.data);
    if (xcoinsUsersRes.data) setXcoinsUsers(xcoinsUsersRes.data);
  };

  const addBlockedIp = async () => {
    if (!newBlockIp.trim()) return;
    const { error } = await supabase.from('blocked_ips').insert({ ip_address: newBlockIp.trim(), reason: newBlockReason.trim() || 'Diblokir oleh admin' });
    if (error) {
      if (error.code === '23505') {
        toast({ title: "Info", description: "IP ini sudah diblokir sebelumnya" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Berhasil", description: `IP ${newBlockIp} berhasil diblokir` });
      setNewBlockIp('');
      setNewBlockReason('');
      loadAllData();
    }
  };

  const unblockIp = async (id: string, ip: string) => {
    if (!confirm(`Yakin unblock IP ${ip}?`)) return;
    const { error } = await supabase.from('blocked_ips').delete().eq('id', id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: `IP ${ip} berhasil di-unblock` });
      loadAllData();
    }
  };

  const lookupIpGeolocation = async (ip: string) => {
    setGeoIp(ip);
    setGeoData(null);
    setGeoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ip-geolocation', { body: { ip } });
      if (error) throw error;
      setGeoData(data);
    } catch {
      toast({ title: "Error", description: "Gagal mendapatkan lokasi IP", variant: "destructive" });
    } finally {
      setGeoLoading(false);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from('app_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);
    
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: `Setting ${key} berhasil diupdate` });
      setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
    }
  };

  const savePackage = async (pkg: PackageItem) => {
    const { error } = await supabase
      .from('packages')
      .upsert(pkg);
    
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Package berhasil disimpan" });
      loadAllData();
      setEditingPackage(null);
    }
  };

  const deletePackage = async (id: string) => {
    const { error } = await supabase.from('packages').delete().eq('id', id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Package berhasil dihapus" });
      loadAllData();
    }
  };

  const uploadMedia = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('media').upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) {
      toast({ title: 'Upload gagal', description: error.message, variant: 'destructive' });
      return null;
    }
    // Serve via our own domain instead of exposing the backend storage URL
    return `${MEDIA_BASE}/${path}`;
  };

  const handleMediaFile = async (
    file: File | undefined,
    onDone: (url: string, type: 'image' | 'video') => void
  ) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: 'File terlalu besar', description: 'Maksimal 50MB', variant: 'destructive' });
      return;
    }
    setUploadingMedia(true);
    const url = await uploadMedia(file);
    setUploadingMedia(false);
    if (url) {
      onDone(url, file.type.startsWith('video') ? 'video' : 'image');
      toast({ title: 'Berhasil', description: 'File berhasil diupload' });
    }
  };

  const saveAd = async (ad: AdItem) => {

    const { error } = await supabase.from('ads').upsert(ad);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Ad berhasil disimpan" });
      loadAllData();
      setEditingAd(null);
    }
  };

  const deleteAd = async (id: string) => {
    const { error } = await supabase.from('ads').delete().eq('id', id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Ad berhasil dihapus" });
      loadAllData();
    }
  };

  const saveBackground = async (bg: BackgroundItem) => {
    const { error } = await supabase.from('backgrounds').upsert(bg);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      if (bg.is_active) showBackground(bg);
      await refetchBackgrounds();
      toast({ title: "Berhasil", description: "Background berhasil disimpan" });
      loadAllData();
      setEditingBackground(null);
    }
  };

  const deleteBackground = async (id: string) => {
    const { error } = await supabase.from('backgrounds').delete().eq('id', id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Background berhasil dihapus" });
      loadAllData();
    }
  };

  const saveSocialLink = async (link: SocialLink) => {
    const { error } = await supabase.from('social_links').upsert(link);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Social link berhasil disimpan" });
      loadAllData();
      setEditingSocialLink(null);
    }
  };

  const deleteSocialLink = async (id: string) => {
    const { error } = await supabase.from('social_links').delete().eq('id', id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Social link berhasil dihapus" });
      loadAllData();
    }
  };

  const formatRupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  const paymentKeys = ['payment_gateway', 'pakasir_slug', 'pakasir_api_key', 'pakasir_mode', 'cashify_license_key', 'cashify_qris_id', 'cashify_webhook_key', 'payment_simulation', 'discord_webhook_url', 'fonnte_token', 'xcoins_enabled', 'xcoins_only', 'xcoins_logo_url'];

  // Show device approval screen if device is not approved
  if (deviceStatus === 'loading' || deviceStatus === 'new' || deviceStatus === 'pending') {
    return (
      <DeviceApprovalScreen
        deviceId={deviceId}
        deviceName={deviceName}
        onRegister={registerDevice}
        status={isChecking ? 'loading' : deviceStatus}
      />
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
        <GlobalBackground />
        <Card className="w-full max-w-md z-10 glass-card">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl text-primary">Developer Login</CardTitle>
            <CardDescription>Masukkan password admin untuk melanjutkan</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password admin"
                  className="bg-background/50"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Loading...' : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <GlobalBackground />
      
      <div className="relative z-10 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-primary">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Kelola toko AREXANS TOOLS</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                Ke Toko
              </Button>
              <Button variant="destructive" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>

          <Tabs defaultValue="settings" className="space-y-6">
            <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
              <TabsList className="inline-flex w-max min-w-full md:w-auto bg-muted/50 gap-1">
                <TabsTrigger value="settings" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <Settings className="w-4 h-4" />
                  <span className="hidden xs:inline">Settings</span>
                </TabsTrigger>
                <TabsTrigger value="packages" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <Package className="w-4 h-4" />
                  <span className="hidden xs:inline">Packages</span>
                </TabsTrigger>
                <TabsTrigger value="transactions" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <CreditCard className="w-4 h-4" />
                  <span className="hidden xs:inline">Trans</span>
                </TabsTrigger>
                <TabsTrigger value="keys" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <Key className="w-4 h-4" />
                  <span className="hidden xs:inline">Keys</span>
                </TabsTrigger>
                <TabsTrigger value="docs" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <FileText className="w-4 h-4" />
                  <span className="hidden xs:inline">API</span>
                </TabsTrigger>
                <TabsTrigger value="scripts" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <FileCode className="w-4 h-4" />
                  <span className="hidden xs:inline">Scripts</span>
                </TabsTrigger>
                <TabsTrigger value="upload" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <Upload className="w-4 h-4" />
                  <span className="hidden xs:inline">Upload</span>
                </TabsTrigger>
                <TabsTrigger value="obfuscate" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <Shield className="w-4 h-4" />
                  <span className="hidden xs:inline">Obfuscate</span>
                </TabsTrigger>
                <TabsTrigger value="ads" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <Image className="w-4 h-4" />
                  <span className="hidden xs:inline">Ads</span>
                </TabsTrigger>
                <TabsTrigger value="backgrounds" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <Image className="w-4 h-4" />
                  <span className="hidden xs:inline">BG</span>
                </TabsTrigger>
                <TabsTrigger value="social" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden xs:inline">Social</span>
                </TabsTrigger>
                <TabsTrigger value="devices" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <Shield className="w-4 h-4" />
                  <span className="hidden xs:inline">Devices</span>
                </TabsTrigger>
                <TabsTrigger value="backup" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <Database className="w-4 h-4" />
                  <span className="hidden xs:inline">Backup</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <CasakuMonitor />
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Payment Gateway
                  </CardTitle>
                  <CardDescription>Pilih dan konfigurasi gateway pembayaran (Cashify / Pakasir)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {settings.filter(s => paymentKeys.includes(s.key)).map(setting => (
                    <div key={setting.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={setting.key} className="capitalize">
                          {setting.key.replace(/_/g, ' ')}
                        </Label>
                        {setting.key !== 'payment_mode' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowSecrets(prev => ({ ...prev, [setting.key]: !prev[setting.key] }))}
                          >
                            {showSecrets[setting.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        )}
                      </div>
                      {setting.description && (
                        <p className="text-xs text-muted-foreground">{setting.description}</p>
                      )}
                      {setting.key === 'payment_gateway' ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant={setting.value === 'cashify' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateSetting(setting.key, 'cashify')}
                          >
                            Casaku QRIS
                          </Button>
                          <Button
                            variant={setting.value === 'pakasir' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateSetting(setting.key, 'pakasir')}
                          >
                            Pakasir
                          </Button>
                          <Button
                            variant={setting.value === 'both' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateSetting(setting.key, 'both')}
                          >
                            Keduanya (Pilih saat Checkout)
                          </Button>
                        </div>
                      ) : setting.key === 'pakasir_mode' ? (
                        <div className="flex items-center gap-4">
                          <Button
                            variant={setting.value === 'demo' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateSetting(setting.key, 'demo')}
                          >
                            Demo Mode
                          </Button>
                          <Button
                            variant={setting.value === 'live' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateSetting(setting.key, 'live')}
                          >
                            Live Mode
                          </Button>
                        </div>
                      ) : setting.key === 'payment_simulation' ? (
                        <div className="flex items-center gap-4">
                          <Switch
                            checked={setting.value === 'on'}
                            onCheckedChange={(checked) => updateSetting(setting.key, checked ? 'on' : 'off')}
                          />
                          <span className={`text-sm font-medium ${setting.value === 'on' ? 'text-secondary' : 'text-muted-foreground'}`}>
                            {setting.value === 'on' ? 'Simulasi AKTIF - Pembayaran otomatis sukses' : 'Simulasi OFF - Pembayaran normal'}
                          </span>
                        </div>
                      ) : setting.key === 'xcoins_enabled' || setting.key === 'xcoins_only' ? (
                        <div className="flex items-center gap-4">
                          <Switch
                            checked={setting.value === 'on'}
                            onCheckedChange={(checked) => updateSetting(setting.key, checked ? 'on' : 'off')}
                          />
                          <span className={`text-sm font-medium ${setting.value === 'on' ? 'text-primary' : 'text-muted-foreground'}`}>
                            {setting.key === 'xcoins_enabled' 
                              ? (setting.value === 'on' ? 'XCoins AKTIF' : 'XCoins Nonaktif')
                              : (setting.value === 'on' ? 'HANYA XCoins (QRIS dimatikan)' : 'XCoins + QRIS')}
                          </span>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            id={setting.key}
                            type={showSecrets[setting.key] ? 'text' : 'password'}
                            value={setting.value}
                            onChange={(e) => setSettings(prev => 
                              prev.map(s => s.key === setting.key ? { ...s, value: e.target.value } : s)
                            )}
                            placeholder={`Masukkan ${setting.key.replace(/_/g, ' ')}`}
                            className="bg-background/50"
                          />
                          <Button onClick={() => updateSetting(setting.key, setting.value)}>
                            <Save className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    General Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {settings.filter(s => !paymentKeys.includes(s.key) && !/^(cashify_tx_|cashify_topup_tx_|casaku_tx_|pakasir_tx_)/.test(s.key)).map(setting => (
                    <div key={setting.id} className="space-y-2">
                      <Label htmlFor={setting.key} className="capitalize">
                        {setting.key.replace(/_/g, ' ')}
                      </Label>
                      {setting.description && (
                        <p className="text-xs text-muted-foreground">{setting.description}</p>
                      )}
                      {setting.key === 'maintenance_mode' ? (
                        <div className="flex items-center gap-4">
                          <Switch
                            checked={setting.value === 'true'}
                            onCheckedChange={(checked) => updateSetting(setting.key, checked ? 'true' : 'false')}
                          />
                          <span className={`text-sm font-medium ${setting.value === 'true' ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {setting.value === 'true' ? '🔴 Maintenance AKTIF - Website tidak bisa diakses' : '🟢 Website Normal'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            id={setting.key}
                            type={setting.key.includes('key') || setting.key.includes('password') ? 'password' : 'text'}
                            value={setting.value}
                            onChange={(e) => setSettings(prev => 
                              prev.map(s => s.key === setting.key ? { ...s, value: e.target.value } : s)
                            )}
                            className="bg-background/50"
                          />
                          <Button onClick={() => updateSetting(setting.key, setting.value)}>
                            <Save className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Packages Tab */}
            <TabsContent value="packages" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-display font-semibold">Manage Packages</h2>
                <Button onClick={() => setEditingPackage({
                  id: crypto.randomUUID(),
                  name: '',
                  display_name: '',
                  price_per_day: 2000,
                  description: '',
                  features: [],
                  is_active: true,
                  sort_order: packages.length
                })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Package
                </Button>
              </div>

              {editingPackage && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>{editingPackage.name ? 'Edit' : 'New'} Package</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Name (ID)</Label>
                        <select
                          value={editingPackage.name}
                          onChange={e => setEditingPackage({ ...editingPackage, name: e.target.value })}
                          className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm"
                        >
                          <option value="">-- Pilih Paket --</option>
                          <option value="NORMAL">NORMAL</option>
                          <option value="VIP">VIP</option>
                          <option value="LIFETIME">LIFETIME</option>
                        </select>
                      </div>
                      <div>
                        <Label>Display Name</Label>
                        <Input
                          value={editingPackage.display_name}
                          onChange={e => setEditingPackage({ ...editingPackage, display_name: e.target.value })}
                          placeholder="Normal Script"
                          className="bg-background/50"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Price per Day (IDR)</Label>
                        <Input
                          type="number"
                          value={editingPackage.price_per_day}
                          onChange={e => setEditingPackage({ ...editingPackage, price_per_day: parseInt(e.target.value) })}
                          className="bg-background/50"
                        />
                      </div>
                      <div>
                        <Label>Sort Order</Label>
                        <Input
                          type="number"
                          value={editingPackage.sort_order}
                          onChange={e => setEditingPackage({ ...editingPackage, sort_order: parseInt(e.target.value) })}
                          className="bg-background/50"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={editingPackage.description || ''}
                        onChange={e => setEditingPackage({ ...editingPackage, description: e.target.value })}
                        className="bg-background/50"
                      />
                    </div>
                    <div>
                      <Label>Features (one per line)</Label>
                      <Textarea
                        value={(editingPackage.features || []).join('\n')}
                        onChange={e => setEditingPackage({ ...editingPackage, features: e.target.value.split('\n').filter(f => f.trim()) })}
                        className="bg-background/50"
                        rows={4}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingPackage.is_active}
                        onCheckedChange={checked => setEditingPackage({ ...editingPackage, is_active: checked })}
                      />
                      <Label>Active</Label>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => savePackage(editingPackage)}>
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => setEditingPackage(null)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4">
                {packages.map(pkg => (
                  <Card key={pkg.id} className="glass-card">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={pkg.is_active}
                          onCheckedChange={async (checked) => {
                            await savePackage({ ...pkg, is_active: checked });
                          }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${pkg.name === 'LIFETIME' ? 'text-cyan-400' : pkg.name === 'VIP' ? 'text-secondary' : 'text-green-400'}`}>{pkg.display_name}</span>
                            <span className="text-xs text-muted-foreground">({pkg.name})</span>
                            {!pkg.is_active && <span className="text-xs text-destructive">[Hidden]</span>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {pkg.name === 'LIFETIME' ? formatRupiah(pkg.price_per_day) + ' (sekali bayar)' : formatRupiah(pkg.price_per_day) + '/hari'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingPackage(pkg)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deletePackage(pkg.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Discount & Promo Section (merged into Packages) */}
              <div className="border-t border-border pt-6 mt-6">
                <DiscountManagement />
              </div>
            </TabsContent>

            {/* Keys Tab */}
            <TabsContent value="keys" className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={keysSubTab === 'keysystem' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setKeysSubTab('keysystem')}
                  className="gap-1.5"
                >
                  <Key className="w-4 h-4" />
                  Key System
                </Button>
                <Button
                  variant={keysSubTab === 'xcoins' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setKeysSubTab('xcoins')}
                  className="gap-1.5"
                >
                  <Coins className="w-4 h-4" />
                  XCoins ({xcoinsUsers.length})
                </Button>
              </div>

              {keysSubTab === 'keysystem' && <KeyManagement />}

              {keysSubTab === 'xcoins' && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Coins className="w-5 h-5 text-primary" />
                      Manajemen Pengguna XCoins
                      <span className="text-sm font-normal text-muted-foreground">({filteredXcoinsUsers.length}/{xcoinsUsers.length})</span>
                    </CardTitle>
                    <CardDescription>Tambah/kurangi/edit saldo, blokir & hapus pengguna XCoins</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      placeholder="Cari nomor / nama..."
                      value={xcoinsSearch}
                      onChange={(e) => setXcoinsSearch(e.target.value)}
                    />

                    {filteredXcoinsUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Belum ada pengguna XCoins</p>
                    ) : (
                      <div className="space-y-2">
                        {filteredXcoinsUsers.map(user => {
                          const userTx = transactions.find(tx => tx.customer_whatsapp === user.phone || tx.customer_whatsapp === user.phone.replace(/^62/, '0'));
                          const lastIp = userTx?.ip_address;
                          return (
                            <div key={user.id} className="p-3 rounded-lg border border-border bg-muted/10 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium flex items-center gap-2 flex-wrap">
                                    {user.display_name || '-'}
                                    <span className={`px-2 py-0.5 rounded text-[10px] ${user.is_active ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'}`}>
                                      {user.is_active ? 'Aktif' : 'Diblokir'}
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground font-mono">{user.phone}</div>
                                  {lastIp && (
                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                      IP: <span className="font-mono">{lastIp}</span>
                                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => lookupIpGeolocation(lastIp)}>
                                        <MapPin className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-muted-foreground">Saldo</div>
                                  <div className="font-mono font-bold text-primary">{new Intl.NumberFormat('id-ID').format(user.balance)}</div>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1.5">
                                <Button size="sm" variant="outline" onClick={() => adjustXcoinsBalance(user, 1000)}>+1k</Button>
                                <Button size="sm" variant="outline" onClick={() => adjustXcoinsBalance(user, 5000)}>+5k</Button>
                                <Button size="sm" variant="outline" onClick={() => adjustXcoinsBalance(user, 10000)}>+10k</Button>
                                <Button size="sm" variant="outline" onClick={() => {
                                  const v = prompt('Jumlah penambahan (XCoins):', '0');
                                  const n = Number(v);
                                  if (Number.isFinite(n) && n > 0) adjustXcoinsBalance(user, n);
                                }}>+ Custom</Button>
                                <Button size="sm" variant="outline" onClick={() => {
                                  const v = prompt('Jumlah pengurangan (XCoins):', '0');
                                  const n = Number(v);
                                  if (Number.isFinite(n) && n > 0) adjustXcoinsBalance(user, -n);
                                }}>- Kurang</Button>
                                <Button size="sm" variant="secondary" onClick={() => setEditingXcoinsUser({ id: user.id, phone: user.phone, display_name: user.display_name, balance: user.balance, is_active: user.is_active })}>
                                  <Edit2 className="w-3 h-3 mr-1" /> Edit
                                </Button>
                                <Button size="sm" variant={user.is_active ? 'destructive' : 'default'} onClick={() => toggleBlockXcoinsUser(user)}>
                                  {user.is_active ? <><ShieldX className="w-3 h-3 mr-1" />Blokir</> : <><Shield className="w-3 h-3 mr-1" />Unblok</>}
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => deleteXcoinsUser(user.id, user.phone)}>
                                  <Trash2 className="w-3 h-3 mr-1" /> Hapus
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Edit XCoins user modal */}
              {editingXcoinsUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingXcoinsUser(null)}>
                  <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                    <div className="p-6 space-y-4">
                      <h3 className="text-lg font-display font-bold">Edit Pengguna XCoins</h3>
                      <div className="space-y-2">
                        <Label>Nama Tampilan</Label>
                        <Input value={editingXcoinsUser.display_name || ''} onChange={(e) => setEditingXcoinsUser({ ...editingXcoinsUser, display_name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>No. WhatsApp</Label>
                        <Input value={editingXcoinsUser.phone} onChange={(e) => setEditingXcoinsUser({ ...editingXcoinsUser, phone: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Saldo (XCoins)</Label>
                        <Input type="number" value={editingXcoinsUser.balance} onChange={(e) => setEditingXcoinsUser({ ...editingXcoinsUser, balance: Number(e.target.value) || 0 })} />
                      </div>
                      <div className="flex items-center justify-between p-2 border border-border rounded-lg">
                        <Label>Aktif</Label>
                        <Switch checked={editingXcoinsUser.is_active} onCheckedChange={(c) => setEditingXcoinsUser({ ...editingXcoinsUser, is_active: c })} />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setEditingXcoinsUser(null)}>Batal</Button>
                        <Button onClick={saveXcoinsUser}><Save className="w-4 h-4 mr-1" />Simpan</Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* API Documentation Tab */}
            <TabsContent value="docs" className="space-y-4">
              <ApiDocumentation />
            </TabsContent>

            {/* Scripts Tab */}
            <TabsContent value="scripts" className="space-y-4">
              <ScriptManagement />
            </TabsContent>




            {/* Upload Tab */}
            <TabsContent value="upload" className="space-y-4">
              <LuaUploadManager />
            </TabsContent>

            <TabsContent value="obfuscate" className="space-y-4">
              <ScriptObfuscator />
            </TabsContent>

            {/* Ads Tab */}
            <TabsContent value="ads" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-display font-semibold">Manage Ads</h2>
                <Button onClick={() => setEditingAd({
                  id: crypto.randomUUID(),
                  title: '',
                  media_url: '',
                  media_type: 'image',
                  link_url: '',
                  is_active: true,
                  sort_order: ads.length
                })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Ad
                </Button>
              </div>

              {editingAd && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>{editingAd.title ? 'Edit' : 'New'} Ad</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={editingAd.title}
                        onChange={e => setEditingAd({ ...editingAd, title: e.target.value })}
                        className="bg-background/50"
                      />
                    </div>
                    <div>
                      <Label>Media URL</Label>
                      <Input
                        value={editingAd.media_url}
                        onChange={e => setEditingAd({ ...editingAd, media_url: e.target.value })}
                        placeholder="https://... atau upload file"
                        className="bg-background/50"
                      />
                      <div className="mt-2">
                        <input
                          id="ad-file-input"
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            handleMediaFile(f, (url, type) =>
                              setEditingAd(prev => prev ? { ...prev, media_url: url, media_type: type } : prev)
                            );
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingMedia}
                          onClick={() => document.getElementById('ad-file-input')?.click()}
                        >
                          <Upload className={`w-4 h-4 mr-2 ${uploadingMedia ? 'animate-spin' : ''}`} />
                          {uploadingMedia ? 'Mengupload...' : 'Upload Gambar/Video'}
                        </Button>
                        {editingAd.media_url && (
                          <div className="mt-3 aspect-video w-full max-w-xs rounded-lg overflow-hidden bg-muted">
                            {editingAd.media_type === 'video' ? (
                              <video src={editingAd.media_url} className="w-full h-full object-cover" muted />
                            ) : (
                              <img src={editingAd.media_url} alt="preview" className="w-full h-full object-cover" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Media Type</Label>
                        <select
                          value={editingAd.media_type}
                          onChange={e => setEditingAd({ ...editingAd, media_type: e.target.value })}
                          className="w-full p-2 rounded-md bg-background/50 border border-border"
                        >
                          <option value="image">Image</option>
                          <option value="video">Video</option>
                        </select>
                      </div>
                      <div>
                        <Label>Sort Order</Label>
                        <Input
                          type="number"
                          value={editingAd.sort_order}
                          onChange={e => setEditingAd({ ...editingAd, sort_order: parseInt(e.target.value) })}
                          className="bg-background/50"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Link URL (optional)</Label>
                      <Input
                        value={editingAd.link_url || ''}
                        onChange={e => setEditingAd({ ...editingAd, link_url: e.target.value })}
                        placeholder="https://..."
                        className="bg-background/50"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingAd.is_active}
                        onCheckedChange={checked => setEditingAd({ ...editingAd, is_active: checked })}
                      />
                      <Label>Active</Label>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => saveAd(editingAd)}>
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => setEditingAd(null)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {ads.map(ad => (
                  <Card key={ad.id} className="glass-card overflow-hidden">
                    <div className="aspect-video bg-muted">
                      {ad.media_type === 'video' ? (
                        <video src={ad.media_url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={ad.media_url} alt={ad.title} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <span className="font-semibold">{ad.title}</span>
                        {!ad.is_active && <span className="text-xs text-destructive ml-2">[Inactive]</span>}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingAd(ad)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteAd(ad.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Backgrounds Tab */}
            <TabsContent value="backgrounds" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-display font-semibold">Manage Backgrounds</h2>
                <Button onClick={() => setEditingBackground({
                  id: crypto.randomUUID(),
                  title: '',
                  background_url: '',
                  background_type: 'image',
                  is_muted: true,
                  is_active: true,
                  sort_order: backgrounds.length
                })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Background
                </Button>
              </div>

              {editingBackground && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>{editingBackground.title ? 'Edit' : 'New'} Background</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={editingBackground.title}
                        onChange={e => setEditingBackground({ ...editingBackground, title: e.target.value })}
                        className="bg-background/50"
                      />
                    </div>
                    <div>
                      <Label>Background URL</Label>
                      <Input
                        value={editingBackground.background_url}
                        onChange={e => setEditingBackground({ ...editingBackground, background_url: e.target.value })}
                        placeholder="https://... atau upload file"
                        className="bg-background/50"
                      />
                      <div className="mt-2">
                        <input
                          id="bg-file-input"
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            handleMediaFile(f, (url, type) => {
                              const base = editingBackground;
                              const next = {
                                ...base,
                                title: base.title || (f?.name ?? 'Background'),
                                background_url: url,
                                background_type: type,
                                is_active: true,
                              };
                              setEditingBackground(next);
                              // Langsung simpan & aktifkan agar background tampil tanpa klik Save
                              saveBackground(next);
                            });
                          }}

                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingMedia}
                          onClick={() => document.getElementById('bg-file-input')?.click()}
                        >
                          <Upload className={`w-4 h-4 mr-2 ${uploadingMedia ? 'animate-spin' : ''}`} />
                          {uploadingMedia ? 'Mengupload...' : 'Upload Gambar/Video'}
                        </Button>
                        {editingBackground.background_url && (
                          <div className="mt-3 aspect-video w-full max-w-xs rounded-lg overflow-hidden bg-muted">
                            {editingBackground.background_type === 'video' ? (
                              <video src={editingBackground.background_url} className="w-full h-full object-cover" muted />
                            ) : (
                              <img src={editingBackground.background_url} alt="preview" className="w-full h-full object-cover" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Type</Label>
                        <select
                          value={editingBackground.background_type}
                          onChange={e => setEditingBackground({ ...editingBackground, background_type: e.target.value })}
                          className="w-full p-2 rounded-md bg-background/50 border border-border"
                        >
                          <option value="image">Image</option>
                          <option value="video">Video</option>
                        </select>
                      </div>
                      <div>
                        <Label>Sort Order</Label>
                        <Input
                          type="number"
                          value={editingBackground.sort_order}
                          onChange={e => setEditingBackground({ ...editingBackground, sort_order: parseInt(e.target.value) })}
                          className="bg-background/50"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editingBackground.is_muted}
                          onCheckedChange={checked => setEditingBackground({ ...editingBackground, is_muted: checked })}
                        />
                        <Label>Muted (for video)</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editingBackground.is_active}
                          onCheckedChange={checked => setEditingBackground({ ...editingBackground, is_active: checked })}
                        />
                        <Label>Active</Label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => saveBackground(editingBackground)}>
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => setEditingBackground(null)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {backgrounds.map(bg => (
                  <Card key={bg.id} className="glass-card overflow-hidden">
                    <div className="aspect-video bg-muted">
                      {bg.background_type === 'video' ? (
                        <video src={bg.background_url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={bg.background_url} alt={bg.title} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <span className="font-semibold">{bg.title}</span>
                        {!bg.is_active && <span className="text-xs text-destructive ml-2">[Inactive]</span>}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingBackground(bg)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteBackground(bg.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Transactions Tab */}
            <TabsContent value="transactions" className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-xl font-display font-semibold">Transactions</h2>
                <div className="flex gap-2">
                  {selectedTxIds.size > 0 && (
                    <Button variant="destructive" size="sm" onClick={deleteSelectedTransactions}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Hapus ({selectedTxIds.size})
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => { loadAllData(); setSelectedTxIds(new Set()); }}>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Auto-cleanup settings - only transactions */}
              <Card className="glass-card">
                <CardContent className="pt-4 pb-4 space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2"><Trash2 className="w-4 h-4 text-muted-foreground" /> Auto-Cleanup Transaksi</p>
                  <div className="space-y-1">
                    <Label className="text-xs">Hapus transaksi lebih dari (hari)</Label>
                    <div className="flex gap-2 items-center">
                      <Switch
                        checked={settings.find(s => s.key === 'auto_delete_transactions_enabled')?.value === 'on'}
                        onCheckedChange={checked => {
                          const key = 'auto_delete_transactions_enabled';
                          const val = checked ? 'on' : 'off';
                          const exists = settings.find(s => s.key === key);
                          if (exists) { updateSetting(key, val); }
                          else { supabase.from('app_settings').insert({ key, value: val, description: 'Auto delete old transactions' }).then(() => loadAllData()); }
                        }}
                      />
                      <Input
                        type="number"
                        className="w-20 bg-background/50"
                        value={settings.find(s => s.key === 'auto_delete_transactions_days')?.value || '30'}
                        onChange={e => {
                          const key = 'auto_delete_transactions_days';
                          const val = e.target.value;
                          const exists = settings.find(s => s.key === key);
                          if (exists) { updateSetting(key, val); }
                          else { supabase.from('app_settings').insert({ key, value: val, description: 'Days before auto-deleting transactions' }).then(() => loadAllData()); }
                        }}
                      />
                      <span className="text-xs text-muted-foreground">hari</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sub-tabs + Search */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex gap-2">
                  <Button variant={txTab === 'keysystem' ? 'default' : 'outline'} size="sm" onClick={() => { setTxTab('keysystem'); setSelectedTxIds(new Set()); }}>
                    KeySystem ({keySystemTx.length})
                  </Button>
                  <Button variant={txTab === 'xcoins' ? 'default' : 'outline'} size="sm" onClick={() => { setTxTab('xcoins'); setSelectedTxIds(new Set()); }}>
                    XCoins ({xcoinsTx.length})
                  </Button>
                </div>
                <Input 
                  placeholder="Cari transaksi (ID, customer, key, status...)" 
                  value={txSearch} 
                  onChange={e => setTxSearch(e.target.value)} 
                  className="bg-background/50 sm:max-w-xs"
                />
              </div>

              {editingTransaction && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Edit Transaksi: {editingTransaction.transaction_id}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Customer Name</Label>
                        <Input value={editingTransaction.customer_name} onChange={e => setEditingTransaction({...editingTransaction, customer_name: e.target.value})} className="bg-background/50" />
                      </div>
                      <div>
                        <Label>WhatsApp</Label>
                        <Input value={editingTransaction.customer_whatsapp || ''} onChange={e => setEditingTransaction({...editingTransaction, customer_whatsapp: e.target.value || null})} className="bg-background/50" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Package</Label>
                        <Input value={editingTransaction.package_name} onChange={e => setEditingTransaction({...editingTransaction, package_name: e.target.value})} className="bg-background/50" />
                      </div>
                      <div>
                        <Label>Duration (hari)</Label>
                        <Input type="number" value={editingTransaction.package_duration} onChange={e => setEditingTransaction({...editingTransaction, package_duration: parseInt(e.target.value) || 0})} className="bg-background/50" />
                      </div>
                      <div>
                        <Label>Status</Label>
                        <select value={editingTransaction.status} onChange={e => setEditingTransaction({...editingTransaction, status: e.target.value})} className="w-full p-2 rounded-md bg-background/50 border border-border">
                          <option value="pending">pending</option>
                          <option value="paid">paid</option>
                          <option value="claimed">claimed</option>
                          <option value="expired">expired</option>
                          <option value="cancelled">cancelled</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Original Amount</Label>
                        <Input type="number" value={editingTransaction.original_amount} onChange={e => setEditingTransaction({...editingTransaction, original_amount: parseInt(e.target.value) || 0})} className="bg-background/50" />
                      </div>
                      <div>
                        <Label>Total Amount</Label>
                        <Input type="number" value={editingTransaction.total_amount} onChange={e => setEditingTransaction({...editingTransaction, total_amount: parseInt(e.target.value) || 0})} className="bg-background/50" />
                      </div>
                    </div>
                    <div>
                      <Label>License Key</Label>
                      <Input value={editingTransaction.license_key || ''} onChange={e => setEditingTransaction({...editingTransaction, license_key: e.target.value || null})} className="bg-background/50" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => saveTransaction(editingTransaction)}><Save className="w-4 h-4 mr-2" />Save</Button>
                      <Button variant="outline" onClick={() => setEditingTransaction(null)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="p-3 w-10">
                        <input type="checkbox" checked={selectedTxIds.size === currentTxList.length && currentTxList.length > 0} onChange={toggleSelectAll} className="rounded" />
                      </th>
                      <th className="text-left p-3">ID</th>
                      <th className="text-left p-3">Customer</th>
                      <th className="text-left p-3">{txTab === 'xcoins' ? 'Amount' : 'Package'}</th>
                      <th className="text-left p-3">Total</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">IP Address</th>
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentTxList.map(tx => (
                      <tr key={tx.id} className={`border-b border-border/50 hover:bg-muted/20 ${selectedTxIds.has(tx.id) ? 'bg-primary/5' : ''}`}>
                        <td className="p-3">
                          <input type="checkbox" checked={selectedTxIds.has(tx.id)} onChange={() => toggleSelectTx(tx.id)} className="rounded" />
                        </td>
                        <td className="p-3">
                          <button onClick={() => { navigator.clipboard.writeText(tx.transaction_id); toast({ title: 'Copied!', description: 'Transaction ID disalin' }); }} className="font-mono text-xs hover:text-primary cursor-pointer underline decoration-dotted" title="Klik untuk salin">
                            {tx.transaction_id.slice(-12)}
                          </button>
                        </td>
                        <td className="p-3">
                          <div>{tx.customer_name}</div>
                          {tx.customer_whatsapp && (
                            <button onClick={() => { navigator.clipboard.writeText(tx.customer_whatsapp!); toast({ title: 'Copied!', description: 'No. WhatsApp disalin' }); }} className="text-xs text-muted-foreground hover:text-primary cursor-pointer underline decoration-dotted" title="Klik untuk salin">
                              {tx.customer_whatsapp}
                            </button>
                          )}
                        </td>
                        <td className="p-3">
                          {txTab === 'xcoins' ? (
                            <div>{formatRupiah(tx.original_amount)}</div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1">
                                <span>{tx.package_name}</span>
                                {tx.license_key && (
                                  <button onClick={() => { navigator.clipboard.writeText(tx.license_key!); toast({ title: 'Copied!', description: 'Key disalin' }); }} title={tx.license_key} className="text-primary hover:text-primary/80 p-0.5 rounded hover:bg-primary/10">
                                    <Copy className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{tx.package_duration} hari</div>
                            </>
                          )}
                        </td>
                        <td className="p-3">{formatRupiah(tx.total_amount)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            tx.status === 'paid' || tx.status === 'claimed' ? 'bg-green-500/20 text-green-400' :
                            tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-destructive/20 text-destructive'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="p-3">
                          {tx.ip_address ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => { navigator.clipboard.writeText(tx.ip_address!); toast({ title: 'Copied!', description: 'IP Address disalin' }); }} className="font-mono text-xs hover:text-primary cursor-pointer underline decoration-dotted" title={`Klik untuk salin: ${tx.ip_address}`}>
                                {tx.ip_address}
                              </button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" title="Blokir IP ini" onClick={() => blockIp(tx.ip_address!)}>
                                <Shield className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3 text-xs">{new Date(tx.created_at).toLocaleString('id-ID')}</td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {tx.status !== 'paid' && tx.status !== 'claimed' && (
                              <Button variant="ghost" size="sm" onClick={() => setTransactionPaid(tx.id)} title="Set Paid" className="text-green-400 hover:text-green-300 hover:bg-green-500/10">
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setEditingTransaction(tx)} title="Edit">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteTransaction(tx.id)} title="Delete" className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {currentTxList.length === 0 && (
                      <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Tidak ada transaksi</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Social Links Tab */}
            <TabsContent value="social" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-display font-semibold">Social Links</h2>
                <Button onClick={() => setEditingSocialLink({
                  id: crypto.randomUUID(),
                  name: '',
                  icon_type: 'link',
                  url: '',
                  label: '',
                  link_location: 'home',
                  is_active: true,
                  sort_order: socialLinks.length
                })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Link
                </Button>
              </div>

              {editingSocialLink && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>{editingSocialLink.name ? 'Edit' : 'New'} Social Link</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Name</Label>
                        <Input
                          value={editingSocialLink.name}
                          onChange={e => setEditingSocialLink({ ...editingSocialLink, name: e.target.value })}
                          className="bg-background/50"
                        />
                      </div>
                      <div>
                        <Label>Label</Label>
                        <Input
                          value={editingSocialLink.label}
                          onChange={e => setEditingSocialLink({ ...editingSocialLink, label: e.target.value })}
                          className="bg-background/50"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>URL</Label>
                      <Input
                        value={editingSocialLink.url}
                        onChange={e => setEditingSocialLink({ ...editingSocialLink, url: e.target.value })}
                        placeholder="https://..."
                        className="bg-background/50"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Icon Type</Label>
                        <select
                          value={editingSocialLink.icon_type}
                          onChange={e => setEditingSocialLink({ ...editingSocialLink, icon_type: e.target.value })}
                          className="w-full p-2 rounded-md bg-background/50 border border-border"
                        >
                          <option value="link">Link</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="whatsapp-contact">WhatsApp Contact</option>
                          <option value="telegram">Telegram</option>
                          <option value="discord">Discord</option>
                          <option value="youtube">YouTube</option>
                          <option value="tiktok">TikTok</option>
                          <option value="instagram">Instagram</option>
                        </select>
                      </div>
                      <div>
                        <Label>Location</Label>
                        <select
                          value={editingSocialLink.link_location}
                          onChange={e => setEditingSocialLink({ ...editingSocialLink, link_location: e.target.value })}
                          className="w-full p-2 rounded-md bg-background/50 border border-border"
                        >
                          <option value="home">Home</option>
                          <option value="footer">Footer</option>
                          <option value="both">Both</option>
                        </select>
                      </div>
                      <div>
                        <Label>Sort Order</Label>
                        <Input
                          type="number"
                          value={editingSocialLink.sort_order}
                          onChange={e => setEditingSocialLink({ ...editingSocialLink, sort_order: parseInt(e.target.value) })}
                          className="bg-background/50"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingSocialLink.is_active}
                        onCheckedChange={checked => setEditingSocialLink({ ...editingSocialLink, is_active: checked })}
                      />
                      <Label>Active</Label>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => saveSocialLink(editingSocialLink)}>
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => setEditingSocialLink(null)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4">
                {socialLinks.map(link => (
                  <Card key={link.id} className="glass-card">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{link.name}</span>
                          <span className="text-xs text-muted-foreground">({link.icon_type})</span>
                          {!link.is_active && <span className="text-xs text-destructive">[Inactive]</span>}
                        </div>
                        <p className="text-sm text-muted-foreground truncate max-w-md">{link.url}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingSocialLink(link)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteSocialLink(link.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Promo tab removed - merged into Packages */}

            {/* Devices + IP Block Tab (merged) */}
            <TabsContent value="devices" className="space-y-6">
              <DeviceManagement
                sessions={allSessions}
                currentDeviceId={deviceId}
                onApprove={approveDevice}
                onRemove={removeDevice}
                onRefresh={loadAllSessions}
              />

              {/* IP Blocking Section */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldX className="w-5 h-5 text-destructive" />
                    IP Address Blocking
                    {blockedIps.length > 0 && (
                      <span className="min-w-[20px] h-[20px] flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1">
                        {blockedIps.length}
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>Blokir IP address agar tidak bisa mengakses website</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="Masukkan IP address (contoh: 192.168.1.1)"
                      value={newBlockIp}
                      onChange={(e) => setNewBlockIp(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Alasan blokir (opsional)"
                      value={newBlockReason}
                      onChange={(e) => setNewBlockReason(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={addBlockedIp} variant="destructive" className="gap-1.5">
                      <ShieldX className="w-4 h-4" />
                      Blokir
                    </Button>
                  </div>

                  {blockedIps.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Belum ada IP yang diblokir</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left p-3 font-medium">IP Address</th>
                            <th className="text-left p-3 font-medium">Alasan</th>
                            <th className="text-left p-3 font-medium hidden sm:table-cell">Tanggal Blokir</th>
                            <th className="text-right p-3 font-medium">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {blockedIps.map((ip) => (
                            <tr key={ip.id} className="border-t">
                              <td className="p-3">
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-xs">{ip.ip_address}</span>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Lacak lokasi" onClick={() => lookupIpGeolocation(ip.ip_address)}>
                                    <MapPin className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                              <td className="p-3 text-muted-foreground">{ip.reason || '-'}</td>
                              <td className="p-3 text-muted-foreground hidden sm:table-cell">
                                {new Date(ip.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="p-3 text-right">
                                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => unblockIp(ip.id, ip.ip_address)}>
                                  <ShieldOff className="w-3 h-3" />
                                  Unblock
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Backup Tab */}
            <TabsContent value="backup" className="space-y-4">
              <BackupRestore />
            </TabsContent>
          </Tabs>

          {/* IP Geolocation Modal */}
          {geoIp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setGeoIp(null)}>
              <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-display font-bold flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-primary" />
                      Lokasi IP: {geoIp}
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => setGeoIp(null)}>✕</Button>
                  </div>

                  {geoLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                      <span className="ml-2 text-muted-foreground">Melacak lokasi...</span>
                    </div>
                  ) : geoData?.status === 'success' ? (
                    <div className="space-y-4">
                      {/* Map */}
                      <div className="rounded-lg overflow-hidden border border-border">
                        <iframe
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${geoData.lon - 0.05},${geoData.lat - 0.03},${geoData.lon + 0.05},${geoData.lat + 0.03}&layer=mapnik&marker=${geoData.lat},${geoData.lon}`}
                          className="w-full h-64"
                          style={{ border: 0 }}
                          title="IP Location Map"
                        />
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-muted-foreground text-xs">Negara</p>
                          <p className="font-medium">{geoData.country} ({geoData.countryCode})</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-muted-foreground text-xs">Provinsi/Region</p>
                          <p className="font-medium">{geoData.regionName}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-muted-foreground text-xs">Kota</p>
                          <p className="font-medium">{geoData.city}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-muted-foreground text-xs">Kode Pos</p>
                          <p className="font-medium">{geoData.zip || '-'}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-muted-foreground text-xs">Latitude</p>
                          <p className="font-mono font-medium">{geoData.lat}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-muted-foreground text-xs">Longitude</p>
                          <p className="font-mono font-medium">{geoData.lon}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-muted-foreground text-xs">Timezone</p>
                          <p className="font-medium">{geoData.timezone}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-muted-foreground text-xs">ISP</p>
                          <p className="font-medium">{geoData.isp}</p>
                        </div>
                        <div className="col-span-2 bg-muted/50 rounded-lg p-3">
                          <p className="text-muted-foreground text-xs">Organisasi / AS</p>
                          <p className="font-medium">{geoData.org} — {geoData.as}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => window.open(`https://www.google.com/maps?q=${geoData.lat},${geoData.lon}`, '_blank')}>
                          <MapPin className="w-4 h-4 mr-1" />
                          Buka di Google Maps
                        </Button>
                        <Button variant="destructive" size="sm" className="flex-1" onClick={() => { blockIp(geoIp!); setGeoIp(null); }}>
                          <ShieldX className="w-4 h-4 mr-1" />
                          Blokir IP Ini
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Gagal mendapatkan lokasi untuk IP ini.</p>
                      <p className="text-xs mt-1">{geoData?.message || 'IP mungkin bersifat privat atau tidak terdaftar.'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
