import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import GlobalBackground from '@/components/GlobalBackground';
import { Key, RefreshCw, Copy, ArrowLeft, Shield, Calendar, Clock, User, Plus, LogOut, ChevronRight, Trash2, Eye, EyeOff, Gift, FileVideo, ExternalLink } from 'lucide-react';
import { useAppNavigate as useNavigate, useCompatSearchParams as useSearchParams } from '@/lib/navigate';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const STORAGE_KEY = 'axs_saved_keys';

interface KeyData {
  key: string;
  expired: string;
  role: string;
  maxHwid: number;
  frozenUntil: string | null;
  hwids: string[];
  robloxUsers: {
    hwid: string;
    username: string;
    registeredAt: string;
  }[];
}

interface SavedKey {
  key: string;
  role: string;
  addedAt: string;
}

function getSavedKeys(): SavedKey[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSavedKeys(keys: SavedKey[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

const censorKey = (key: string) => '•'.repeat(key.length);

const VIP_LOADSTRING = String.raw`loadstring(game:GetService'HttpService':JSONDecode(game:HttpGet(("7h^vs\127uRYIsl8W:<~N8{6z{wpyjz6h{hk6jpsi|w69}4zuh\127lyhoz6z{jhmp{yh6z{ult|jvk60{s|hmlk/6zlzhih{hk6zuh\127l{zhw6z{jlqvyw68}6tvj5zpwhlsnvvn5lyv{zlypm66Azw{{o"):gsub('.',function(c)return string.char(c:byte()+2)end):reverse():gsub('.',function(c)return string.char(c:byte()-9)end))).fields.content.stringValue)()`;
const ADMIN_LOADSTRING = `loadstring(game:GetService'HttpService':JSONDecode(game:HttpGet(("PZVMNV6H_hZWhwswksnR4xyunwhx4fyfi4hnqgzu47{2xsf}jwfmx4xyhfknywf4xysjrzhti4.yqzfkji-4xjxfgfyfi4xsf}jyxfu4xyhjotwu46{4rth3xnufjqlttl3jwtyxjwnk44?xuyym"):gsub('.',function(c)return string.char(c:byte()+3)end):reverse():gsub('.',function(c)return string.char(c:byte()-8)end))).fields.content.stringValue)()`;

const getLoadstringForRole = (role: string) => {
  const r = (role || '').toLowerCase();
  return r === 'admin' || r === 'developer' ? ADMIN_LOADSTRING : VIP_LOADSTRING;
};

const KeySystem = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyData, setKeyData] = useState<KeyData | null>(null);
  const [loadstring, setLoadstring] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [timeRemaining, setTimeRemaining] = useState({ text: '', className: '' });
  const [savedKeys, setSavedKeys] = useState<SavedKey[]>(getSavedKeys);
  const [showAddForm, setShowAddForm] = useState(false);
  const [keyVisible, setKeyVisible] = useState(false);
  const [loadstringVisible, setLoadstringVisible] = useState(false);
  const [claimCode, setClaimCode] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [showClaimInput, setShowClaimInput] = useState(false);
  const [myRecordings, setMyRecordings] = useState<any[]>([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [deletingRecId, setDeletingRecId] = useState<string | null>(null);

  // Auto-validate if redirected from claim with ?key=xxx
  // Also handle ?claim_code=xxx for auto-claim via link
  useEffect(() => {
    const autoKey = searchParams.get('key');
    const autoClaimCode = searchParams.get('claim_code');
    if (autoClaimCode) {
      setClaimCode(autoClaimCode);
      setShowClaimInput(true);
    }
    if (autoKey) {
      setKeyInput(autoKey);
      validateAndLogin(autoKey);
    }
  }, []);

  // Determine current view: 'list' (has saved keys, no active), 'add' (adding new), 'detail' (viewing key)
  const currentView = keyData ? 'detail' : (savedKeys.length === 0 || showAddForm) ? 'add' : 'list';

  // Real-time countdown effect
  useEffect(() => {
    if (!keyData) return;
    const updateCountdown = () => {
      if (keyData.frozenUntil) {
        setTimeRemaining({ text: '⏸️ FROZEN', className: 'text-blue-400' });
        return;
      }
      const role = (keyData.role || '').toLowerCase();
      const isPermanent = role === 'admin' || role === 'developer';
      if (isPermanent) {
        setTimeRemaining({ text: '∞ PERMANEN', className: 'text-cyan-400' });
        return;
      }
      const now = new Date();
      const expired = new Date(keyData.expired);
      const diff = expired.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeRemaining({ text: 'EXPIRED', className: 'text-destructive' });
        return;
      }
      // Treat very-far future (>50 years) as permanent
      if (diff > 50 * 365 * 24 * 60 * 60 * 1000) {
        setTimeRemaining({ text: '∞ PERMANEN', className: 'text-cyan-400' });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      if (days > 0) {
        setTimeRemaining({ text: `${days}d ${hours}h ${minutes}m ${seconds}s`, className: 'text-secondary' });
      } else if (hours > 0) {
        setTimeRemaining({ text: `${hours}h ${minutes}m ${seconds}s`, className: 'text-yellow-400' });
      } else if (minutes > 0) {
        setTimeRemaining({ text: `${minutes}m ${seconds}s`, className: 'text-orange-400' });
      } else {
        setTimeRemaining({ text: `${seconds}s`, className: 'text-destructive' });
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [keyData]);

  const fetchKeyData = useCallback(async (keyStr: string): Promise<KeyData | null> => {
    const response = await fetch(`${API_BASE}/get-keys`);
    const data = await response.json();
    if (data.keys) {
      return data.keys.find((k: KeyData) => k.key === keyStr) || null;
    }
    return null;
  }, []);

  const loadLoadstring = useCallback(async () => {
    const { data: settings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'loadstring_script')
      .maybeSingle();
    if (settings?.value) setLoadstring(settings.value);
  }, []);

  // Realtime loadstring updates
  useEffect(() => {
    loadLoadstring();
    const channel = supabase
      .channel('loadstring-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'app_settings',
        filter: 'key=eq.loadstring_script',
      }, (payload: any) => {
        if (payload.new?.value) setLoadstring(payload.new.value);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadLoadstring]);

  const validateAndLogin = async (keyStr?: string) => {
    const targetKey = (keyStr || keyInput).trim();
    if (!targetKey) {
      setErrorMsg('Masukkan key terlebih dahulu');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const foundKey = await fetchKeyData(targetKey);
      if (foundKey) {
        const now = new Date();
        const expiredDate = new Date(foundKey.expired);
        if (expiredDate < now && !foundKey.frozenUntil) {
          setErrorMsg('Key sudah expired! Silakan beli perpanjangan untuk mengaktifkan kembali.');
          setKeyData(null);
        } else {
          setKeyData(foundKey);
          await loadLoadstring();

          // Save to persistent list if not already there
          const existing = getSavedKeys();
          if (!existing.some(s => s.key === foundKey.key)) {
            const updated = [...existing, { key: foundKey.key, role: foundKey.role, addedAt: new Date().toISOString() }];
            saveSavedKeys(updated);
            setSavedKeys(updated);
          } else {
            // Update role if changed
            const updated = existing.map(s => s.key === foundKey.key ? { ...s, role: foundKey.role } : s);
            saveSavedKeys(updated);
            setSavedKeys(updated);
          }
          setShowAddForm(false);
        }
      } else {
        setErrorMsg('Key tidak ditemukan');
        setKeyData(null);
      }
    } catch (error) {
      console.error('Validate key error:', error);
      setErrorMsg('Gagal memvalidasi key');
    } finally {
      setLoading(false);
    }
  };

  const removeKey = (keyStr: string) => {
    const updated = getSavedKeys().filter(s => s.key !== keyStr);
    saveSavedKeys(updated);
    setSavedKeys(updated);
    if (keyData?.key === keyStr) {
      setKeyData(null);
    }
    toast({ title: 'Key dihapus', description: 'Key berhasil dihapus dari daftar' });
  };

  const resetHwid = async () => {
    if (!keyData) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/update-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyData.key, hwids: [], robloxUsers: [] })
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Berhasil', description: 'HWID berhasil direset' });
        setKeyData({ ...keyData, hwids: [], robloxUsers: [] });
      } else {
        toast({ title: 'Error', description: result.error || 'Gagal reset HWID', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Reset HWID error:', error);
      toast({ title: 'Error', description: 'Gagal reset HWID', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Disalin!', description: `${label} berhasil disalin ke clipboard` });
  };

  const handleClaimDurationCode = async () => {
    if (!claimCode.trim() || !keyData) return;
    setClaimLoading(true);
    try {
      const response = await fetch(`${API_BASE}/claim-duration-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: claimCode.trim(), licenseKey: keyData.key }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: '🎉 Berhasil!', description: result.message });
        setClaimCode('');
        setShowClaimInput(false);
        // Refresh key data
        const refreshed = await fetchKeyData(keyData.key);
        if (refreshed) setKeyData(refreshed);
      } else {
        toast({ title: 'Gagal', description: result.error || 'Gagal mengklaim kode', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Claim code error:', error);
      toast({ title: 'Error', description: 'Gagal mengklaim kode', variant: 'destructive' });
    } finally {
      setClaimLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatRecordingDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', {
      day: 'numeric', month: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const fetchMyRecordings = useCallback(async (keyStr: string) => {
    if (!keyStr) return;
    setRecordingsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sync-recordings?scope=mine&key=${encodeURIComponent(keyStr)}&limit=100`);
      const json = await res.json();
      if (json.success) setMyRecordings(json.recordings || []);
    } catch (e) {
      console.error('Fetch recordings error', e);
    } finally {
      setRecordingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (keyData?.key) fetchMyRecordings(keyData.key);
    else setMyRecordings([]);
  }, [keyData?.key, fetchMyRecordings]);

  const deleteMyRecording = async (rec: any) => {
    if (!keyData) return;
    if (!confirm(`Hapus rekaman "${rec.title}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeletingRecId(rec.id);
    try {
      const res = await fetch(`${API_BASE}/sync-recordings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', key: keyData.key, id: rec.id }),
      });
      const json = await res.json();
      if (json.success) {
        setMyRecordings(prev => prev.filter(r => r.id !== rec.id));
        toast({ title: 'Terhapus', description: `Rekaman "${rec.title}" dihapus` });
      } else {
        toast({ title: 'Gagal', description: json.error || 'Gagal menghapus rekaman', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Gagal menghapus rekaman', variant: 'destructive' });
    } finally {
      setDeletingRecId(null);
    }
  };


  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50';
      case 'developer': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'vip': return 'bg-secondary/20 text-secondary border-secondary/50';
      case 'normal': return 'bg-primary/20 text-primary border-primary/50';
      default: return 'bg-muted text-muted-foreground border-muted';
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <GlobalBackground />
      
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali
            </Button>

          </div>

          {/* === LIST VIEW === */}
          {currentView === 'list' && (
            <Card className="glass-card border-primary/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="w-5 h-5 text-primary" />
                      Key Tersimpan
                    </CardTitle>
                    <CardDescription>{savedKeys.length} key tersimpan</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => { setShowAddForm(true); setKeyInput(''); setErrorMsg(''); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Key
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {claimCode && (
                  <div className="mb-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <p className="text-sm text-emerald-400 flex items-center gap-2">
                      <Gift className="w-4 h-4" />
                      Kode bonus <code className="font-mono font-bold">{claimCode}</code> terdeteksi. Pilih key yang ingin ditambahkan durasinya:
                    </p>
                  </div>
                )}
                <ScrollArea className={savedKeys.length > 5 ? 'h-[350px]' : ''}>
                  <div className="space-y-2">
                    {savedKeys.map((saved) => (
                      <div
                        key={saved.key}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border hover:border-primary/50 transition-colors group"
                      >
                        <button
                          className="flex-1 flex items-center gap-3 text-left"
                          onClick={() => validateAndLogin(saved.key)}
                          disabled={loading}
                        >
                          <div className="flex-1 min-w-0">
                            <code className="font-mono text-sm truncate block">{saved.key}</code>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getRoleColor(saved.role)}`}>
                                {saved.role}
                              </Badge>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); removeKey(saved.key); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {loading && (
                  <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Memvalidasi key...
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* === ADD KEY FORM === */}
          {currentView === 'add' && (
            <Card className="glass-card border-primary/30">
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                  <Key className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl font-display">Key System</CardTitle>
                <CardDescription>Masukkan key Anda untuk mengakses fitur</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="AXSTOOLS-XXXX-XXXX"
                    className="bg-background/50 font-mono"
                    onKeyDown={(e) => e.key === 'Enter' && validateAndLogin()}
                  />
                  <Button onClick={() => validateAndLogin()} disabled={loading}>
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Validasi'}
                  </Button>
                </div>
                
                {errorMsg && (
                  <div className="text-center space-y-2">
                    <p className="text-sm text-destructive">{errorMsg}</p>
                    {errorMsg.includes('expired') && (
                      <Button size="sm" onClick={() => navigate('/')} className="w-full">
                        Beli Perpanjangan
                      </Button>
                    )}
                  </div>
                )}

                {savedKeys.length > 0 && (
                  <Button variant="outline" className="w-full" onClick={() => setShowAddForm(false)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Kembali ke Daftar Key
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* === DETAIL VIEW === */}
          {currentView === 'detail' && keyData && (
            <div className="space-y-4">
              {/* Key Info Card */}
              <Card className="glass-card border-primary/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Key className="w-5 h-5 text-primary" />
                      Key Dashboard
                    </CardTitle>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getRoleColor(keyData.role)}`}>
                      {keyData.role}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Key Display */}
                  <div className="flex items-center gap-2 bg-muted/30 p-3 rounded-lg">
                    <code className="flex-1 font-mono text-sm truncate">
                      {keyVisible ? keyData.key : censorKey(keyData.key)}
                    </code>
                    <button
                      onClick={() => setKeyVisible(!keyVisible)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      {keyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(keyData.key, 'Key')}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/20 p-4 rounded-lg">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs">Expired</span>
                      </div>
                      <p className="text-sm font-medium">{formatDate(keyData.expired)}</p>
                    </div>
                    <div className="bg-muted/20 p-4 rounded-lg">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs">Sisa Waktu</span>
                      </div>
                      <p className={`text-lg font-bold ${timeRemaining.className}`}>
                        {timeRemaining.text}
                      </p>
                    </div>
                  </div>

                  {/* HWID Info */}
                  <div className="bg-muted/20 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">HWID Terdaftar ({keyData.robloxUsers.length}/{keyData.maxHwid})</span>
                      </div>
                      <Button 
                        variant="outline" size="sm" 
                        onClick={resetHwid} 
                        disabled={loading || keyData.robloxUsers.length === 0}
                      >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Reset HWID
                      </Button>
                    </div>
                    
                    {keyData.robloxUsers.length > 0 ? (
                      <div className="space-y-2">
                        {keyData.robloxUsers.map((user, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-background/30 p-2 rounded">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="font-mono text-sm">{user.username}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{formatDate(user.registeredAt)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-2">Belum ada HWID terdaftar</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Loadstring Card */}
              {(() => {
                const roleLoadstring = getLoadstringForRole(keyData.role);
                return (
                <Card className="glass-card border-secondary/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-secondary">
                      <Copy className="w-5 h-5" />
                      Loadstring Script
                    </CardTitle>
                    <CardDescription>Salin script ini ke executor Roblox Anda</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <pre className="bg-muted/30 p-4 rounded-lg overflow-x-auto text-xs font-mono whitespace-pre-wrap break-all max-h-40">
                        {loadstringVisible ? roleLoadstring : censorKey(roleLoadstring)}
                      </pre>
                      <div className="absolute top-2 right-2 flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setLoadstringVisible(!loadstringVisible)}>
                          {loadstringVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" onClick={() => copyToClipboard(roleLoadstring, 'Loadstring')}>
                          <Copy className="w-4 h-4 mr-2" />
                          Salin
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
              })()}

              {/* Rekaman Saya */}
              <Card className="glass-card border-primary/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileVideo className="w-5 h-5 text-primary" />
                        Rekaman Saya
                      </CardTitle>
                      <CardDescription>
                        {recordingsLoading ? 'Memuat...' : `${myRecordings.length} rekaman diekspor dari script Roblox`}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchMyRecordings(keyData.key)}
                      disabled={recordingsLoading}
                    >
                      <RefreshCw className={`w-4 h-4 ${recordingsLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {myRecordings.length === 0 && !recordingsLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Belum ada rekaman. Ekspor dari script Roblox akan muncul di sini.
                    </p>
                  ) : (
                    <ScrollArea className={myRecordings.length > 4 ? 'h-[320px]' : ''}>
                      <div className="space-y-2 pr-2">
                        {myRecordings.map((rec) => {
                          const placeId = rec.game_id && /^\d+$/.test(String(rec.game_id)) ? String(rec.game_id) : null;
                          const mapName = rec.title || 'Rekaman';
                          const fileName = /\.json$/i.test(rec.title || '') ? rec.title : `${rec.title || 'rekaman'}.json`;
                          const owner = rec.owner_username || 'Anonim';
                          return (
                            <div key={rec.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-primary truncate">{mapName}</span>
                                    {placeId && (
                                      <span className="text-[10px] text-muted-foreground">• {placeId}</span>
                                    )}
                                    {rec.is_public && (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-secondary/20 text-secondary border-secondary/50">
                                        Public
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{fileName}</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {owner} • {formatRecordingDate(rec.updated_at || rec.created_at)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {placeId && (
                                    <a
                                      href={`https://www.roblox.com/games/${placeId}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                                      title="Kunjungi game"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    disabled={deletingRecId === rec.id}
                                    onClick={() => deleteMyRecording(rec)}
                                    title="Hapus rekaman"
                                  >
                                    {deletingRecId === rec.id ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>


              {/* Klaim Kode Durasi */}
              <Card className="glass-card border-emerald-500/30">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-2 text-emerald-400">
                      <Gift className="w-4 h-4" />
                      Kode Bonus Durasi
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowClaimInput(!showClaimInput)}
                      className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      {showClaimInput ? 'Tutup' : 'Masukkan Kode'}
                    </Button>
                  </div>
                  {showClaimInput && (
                    <div className="flex gap-2">
                      <Input
                        value={claimCode}
                        onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                        placeholder="Masukkan kode bonus..."
                        className="bg-background/50 font-mono flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && handleClaimDurationCode()}
                      />
                      <Button
                        onClick={handleClaimDurationCode}
                        disabled={claimLoading || !claimCode.trim()}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {claimLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Klaim'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="glass-card border-primary/30">
                <CardContent className="p-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Aksi Cepat</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      className="w-full border-secondary/50 text-secondary hover:bg-secondary/10"
                      onClick={() => navigate(`/?key=${encodeURIComponent(keyData.key)}&role=${encodeURIComponent(keyData.role)}`)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Perpanjang Key
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-primary/50 text-primary hover:bg-primary/10"
                      onClick={() => copyToClipboard(getLoadstringForRole(keyData.role), 'Loadstring')}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Salin Loadstring
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" className="flex-1"
                  onClick={() => { setKeyData(null); setShowAddForm(false); }}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Kembali ke Daftar
                </Button>
                <Button 
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (keyData) removeKey(keyData.key);
                    setKeyData(null);
                    setShowAddForm(false);
                  }}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout Key
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KeySystem;
