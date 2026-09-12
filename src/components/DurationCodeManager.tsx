import { FC, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Gift, Plus, Trash2, Copy, Calendar, Clock, Link, RefreshCw } from 'lucide-react';

interface DurationCode {
  id: string;
  code: string;
  duration_days: number;
  duration_hours?: number;
  duration_minutes?: number;
  expires_at: string;
  max_uses_per_key: number;
  is_active: boolean;
  used_by: { key: string; claimedAt: string }[];
  created_at: string;
}

const formatDuration = (d: number, h: number, m: number): string => {
  const parts: string[] = [];
  if (d > 0) parts.push(`${d} hari`);
  if (h > 0) parts.push(`${h} jam`);
  if (m > 0) parts.push(`${m} menit`);
  return parts.length > 0 ? parts.join(' ') : '0 menit';
};

const toLocalDatetimeString = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const DurationCodeManager: FC = () => {
  const [codes, setCodes] = useState<DurationCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newDays, setNewDays] = useState(3);
  const [newHours, setNewHours] = useState(0);
  const [newMinutes, setNewMinutes] = useState(0);
  const [newExpiry, setNewExpiry] = useState(toLocalDatetimeString(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)));
  const [meta, setMeta] = useState<Record<string, { d: number; h: number; m: number }>>({});
  const [notice, setNotice] = useState<{ text: string; expires_at: string } | null>(null);

  const fetchMeta = async (): Promise<Record<string, { d: number; h: number; m: number }>> => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'duration_code_meta').maybeSingle();
    try { return data?.value ? JSON.parse(data.value) : {}; } catch { return {}; }
  };

  const fetchNotice = async () => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'script_notice').maybeSingle();
    try { setNotice(data?.value ? JSON.parse(data.value) : null); } catch { setNotice(null); }
  };

  const saveMeta = async (m: Record<string, { d: number; h: number; m: number }>) => {
    setMeta(m);
    await supabase.from('app_settings').upsert(
      { key: 'duration_code_meta', value: JSON.stringify(m), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  };

  const clearNotice = async () => {
    await supabase.from('app_settings').upsert(
      { key: 'script_notice', value: JSON.stringify(null), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    setNotice(null);
    toast({ title: 'Dihapus', description: 'Pengumuman di script pengguna dihapus' });
  };

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('duration_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        const metaMap = await fetchMeta();
        setMeta(metaMap);
        setCodes(data.map((d: any) => ({
          ...d,
          duration_hours: metaMap[d.code]?.h ?? 0,
          duration_minutes: metaMap[d.code]?.m ?? 0,
          duration_days: metaMap[d.code]?.d ?? d.duration_days,
          used_by: Array.isArray(d.used_by) ? d.used_by : [],
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCodes(); fetchNotice(); }, []);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'BONUS-';
    for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  };

  const handleCreate = async () => {
    const code = newCode.trim() || generateCode();
    try {
      const d = Math.max(0, newDays || 0);
      const h = Math.max(0, newHours || 0);
      const m = Math.max(0, newMinutes || 0);
      if (d + h + m <= 0) {
        toast({ title: 'Durasi kosong', description: 'Isi minimal salah satu: hari, jam, atau menit', variant: 'destructive' });
        return;
      }

      const { error } = await supabase.from('duration_codes').insert({
        code,
        duration_days: d,
        expires_at: new Date(newExpiry).toISOString(),
        max_uses_per_key: 1,
        is_active: true,
        used_by: [],
      });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        await saveMeta({ ...meta, [code]: { d, h, m } });

        // Pengumuman otomatis ke script pengguna
        const label = formatDuration(d, h, m);
        const noticeText = `Kode bonus baru tersedia! Klaim "${code}" untuk tambahan durasi +${label}.`;
        const payload = { text: noticeText, expires_at: new Date(newExpiry).toISOString() };
        await supabase.from('app_settings').upsert(
          { key: 'script_notice', value: JSON.stringify(payload), updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );
        setNotice(payload);

        toast({ title: 'Berhasil', description: `Kode ${code} (+${label}) dibuat & diumumkan di script` });
        setShowForm(false);
        setNewCode('');
        setNewDays(3);
        setNewHours(0);
        setNewMinutes(0);
        setNewExpiry(toLocalDatetimeString(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)));
        fetchCodes();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('duration_codes').update({ is_active: active }).eq('id', id);
    fetchCodes();
  };

  const deleteCode = async (id: string) => {
    if (!confirm('Hapus kode ini?')) return;
    await supabase.from('duration_codes').delete().eq('id', id);
    fetchCodes();
    toast({ title: 'Dihapus', description: 'Kode berhasil dihapus' });
  };

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/key-system?claim_code=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Disalin!', description: 'Link klaim berhasil disalin' });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Disalin!', description: 'Kode berhasil disalin' });
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <Card className="glass-card border-emerald-500/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-emerald-400">
              <Gift className="w-5 h-5" />
              Kode Klaim Durasi
            </CardTitle>
            <CardDescription>Buat kode bonus untuk menambah durasi key pengguna</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchCodes} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-1" />
              Buat Kode
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Kode (kosongkan = auto)</Label>
                <Input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="kode-bebas-123"
                  className="bg-background/50 font-mono"
                />
              </div>
              <div>
                <Label>Durasi Tambahan</Label>
                <div className="flex items-center gap-1.5">
                  <Input type="number" min={0} value={newDays} onChange={(e) => setNewDays(parseInt(e.target.value) || 0)} className="bg-background/50 w-16 px-2" title="Hari" />
                  <span className="text-xs text-muted-foreground">hari</span>
                  <Input type="number" min={0} max={23} value={newHours} onChange={(e) => setNewHours(parseInt(e.target.value) || 0)} className="bg-background/50 w-16 px-2" title="Jam" />
                  <span className="text-xs text-muted-foreground">jam</span>
                  <Input type="number" min={0} max={59} value={newMinutes} onChange={(e) => setNewMinutes(parseInt(e.target.value) || 0)} className="bg-background/50 w-16 px-2" title="Menit" />
                  <span className="text-xs text-muted-foreground">mnt</span>
                </div>
              </div>
              <div>
                <Label>Kode Expired Pada</Label>
                <Input
                  type="datetime-local"
                  value={newExpiry}
                  onChange={(e) => setNewExpiry(e.target.value)}
                  className="bg-background/50"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} className="bg-emerald-600 hover:bg-emerald-700">Buat</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
            </div>
          </div>
        )}

        {codes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Belum ada kode klaim durasi</p>
        ) : (
          <div className="space-y-2">
            {codes.map((c) => (
              <div key={c.id} className={`p-3 rounded-lg border ${isExpired(c.expires_at) ? 'opacity-50 border-muted' : 'border-emerald-500/20'} bg-muted/20`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="font-mono font-bold text-emerald-400">{c.code}</code>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                      +{c.duration_days} hari
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {isExpired(c.expires_at) ? 'Expired' : `Exp: ${new Date(c.expires_at).toLocaleDateString('id-ID')}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Dipakai: {c.used_by.length}x
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={c.is_active}
                      onCheckedChange={(v) => toggleActive(c.id, v)}
                    />
                    <Button variant="ghost" size="sm" onClick={() => copyCode(c.code)} title="Salin kode">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => copyLink(c.code)} title="Salin link klaim">
                      <Link className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteCode(c.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                {c.used_by.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Digunakan oleh: {c.used_by.map(u => u.key).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DurationCodeManager;
