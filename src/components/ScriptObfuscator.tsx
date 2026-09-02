import { FC, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Shield, Loader2, Copy, ClipboardPaste, Trash2, Download, Upload } from 'lucide-react';

type Preset = 'level1' | 'level2' | 'level3' | 'none';
type OutputStyle = 'compact' | 'pretty' | 'singleline';

const ScriptObfuscator: FC = () => {
  const [code, setCode] = useState('');
  const [result, setResult] = useState('');
  const [preset, setPreset] = useState<Preset>('level3');
  const [outputStyle, setOutputStyle] = useState<OutputStyle>('compact');
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ elapsed?: number; seed?: string; warnings?: string[] } | null>(null);

  const doObfuscate = async () => {
    if (!code.trim()) {
      toast({ title: 'Kosong', description: 'Tempel/ketik kode Lua terlebih dahulu', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setResult('');
    setMeta(null);
    try {
      const { data, error } = await supabase.functions.invoke('obfuscate-lua', {
        body: { code, preset, outputStyle },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.error) throw new Error(d.error);
      const out: string = d?.result ?? '';
      if (!out) throw new Error('Tidak ada hasil dari server');
      setResult(out);
      setMeta({ elapsed: d?.elapsed_ms, seed: d?.seed, warnings: d?.warnings });
      toast({ title: 'Berhasil', description: `Obfuscate selesai (${d?.elapsed_ms ?? '?'} ms)` });
    } catch (e) {
      toast({ title: 'Gagal obfuscate', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) throw new Error('Clipboard kosong');
      setCode(t);
      toast({ title: 'Dipaste', description: `${t.length} karakter` });
    } catch (e) {
      toast({ title: 'Gagal paste', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    toast({ title: 'Disalin', description: `${result.length} karakter` });
  };

  const downloadResult = () => {
    if (!result) return;
    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `obfuscated_${Date.now()}.lua`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setCode(text);
    e.target.value = '';
  };

  return (
    <Card className="border-cyan-500/30 bg-black/40 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-cyan-300">
          <Shield className="w-5 h-5" /> Lua Script Obfuscator
        </CardTitle>
        <CardDescription>
          Obfuscate script Lua kamu via luast.clv.cloud. Semua script yang di-upload/paste di{' '}
          <span className="text-cyan-300">Upload Lua Scripts</span> juga otomatis di-obfuscate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Preset</Label>
            <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="level1">Level 1 — Ringan</SelectItem>
                <SelectItem value="level2">Level 2 — Sedang</SelectItem>
                <SelectItem value="level3">Level 3 — Maksimum</SelectItem>
                <SelectItem value="none">None — Baseline</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Output Style</Label>
            <Select value={outputStyle} onValueChange={(v) => setOutputStyle(v as OutputStyle)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="pretty">Pretty</SelectItem>
                <SelectItem value="singleline">Single line</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Upload .lua/.txt</Label>
            <Input type="file" accept=".lua,.txt" onChange={onFileUpload} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Kode Sumber (Lua)</Label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={pasteFromClipboard}>
                <ClipboardPaste className="w-4 h-4 mr-1" /> Paste
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCode('')}>
                <Trash2 className="w-4 h-4 mr-1" /> Clear
              </Button>
            </div>
          </div>
          <Textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="-- tempel kode Lua di sini"
            className="min-h-[220px] font-mono text-xs bg-black/60"
          />
          <div className="text-xs text-muted-foreground">{code.length} karakter</div>
        </div>

        <Button onClick={doObfuscate} disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-500">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
          Obfuscate
        </Button>

        {result && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-cyan-300">Hasil Obfuscated</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyResult}>
                  <Copy className="w-4 h-4 mr-1" /> Copy
                </Button>
                <Button size="sm" variant="outline" onClick={downloadResult}>
                  <Download className="w-4 h-4 mr-1" /> Download
                </Button>
              </div>
            </div>
            <Textarea
              readOnly
              value={result}
              className="min-h-[220px] font-mono text-xs bg-black/60 border-cyan-500/40"
            />
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{result.length} char</Badge>
              {meta?.elapsed !== undefined && <Badge variant="outline">{meta.elapsed} ms</Badge>}
              {meta?.seed && <Badge variant="outline">seed: {meta.seed}</Badge>}
              {meta?.warnings?.length ? (
                <Badge variant="destructive">warnings: {meta.warnings.join(', ')}</Badge>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScriptObfuscator;
