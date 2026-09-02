import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Monitor, Smartphone, Trash2, CheckCircle2, Clock, Shield } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface DeviceSession {
  id: string;
  device_id: string;
  device_name: string | null;
  device_info: Json | null;
  is_approved: boolean;
  is_current: boolean;
  login_time: string;
}

interface DeviceManagementProps {
  sessions: DeviceSession[];
  currentDeviceId: string;
  onApprove: (sessionId: string) => Promise<boolean>;
  onRemove: (sessionId: string) => Promise<boolean>;
  onRefresh: () => void;
}

// Helper to safely get device info properties
const getDeviceInfoProp = (info: Json | null, prop: string): string => {
  if (!info || typeof info !== 'object' || Array.isArray(info)) return '';
  return String((info as Record<string, Json>)[prop] || '');
};

const DeviceManagement = ({ sessions, currentDeviceId, onApprove, onRemove, onRefresh }: DeviceManagementProps) => {
  useEffect(() => {
    onRefresh();
  }, []);

  const handleApprove = async (sessionId: string, deviceName: string) => {
    const success = await onApprove(sessionId);
    if (success) {
      toast({ title: "Berhasil", description: `Perangkat "${deviceName}" telah disetujui` });
    } else {
      toast({ title: "Error", description: "Gagal menyetujui perangkat", variant: "destructive" });
    }
  };

  const handleRemove = async (sessionId: string, deviceName: string) => {
    const success = await onRemove(sessionId);
    if (success) {
      toast({ title: "Berhasil", description: `Perangkat "${deviceName}" telah dihapus` });
    } else {
      toast({ title: "Error", description: "Gagal menghapus perangkat", variant: "destructive" });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const pendingSessions = sessions.filter(s => !s.is_approved);
  const approvedSessions = sessions.filter(s => s.is_approved);

  return (
    <div className="space-y-6">
      {/* Pending Devices */}
      {pendingSessions.length > 0 && (
        <Card className="glass-card border-yellow-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-500">
              <Clock className="w-5 h-5" />
              Perangkat Menunggu Persetujuan ({pendingSessions.length})
            </CardTitle>
            <CardDescription>Perangkat-perangkat ini menunggu untuk disetujui</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingSessions.map(session => (
              <div key={session.id} className="flex items-center justify-between p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{session.device_name}</p>
                      <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                        Pending
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{session.device_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {getDeviceInfoProp(session.device_info, 'screenResolution')} • {formatDate(session.login_time)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => handleApprove(session.id, session.device_name || 'Unknown')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Setujui
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => handleRemove(session.id, session.device_name || 'Unknown')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Approved Devices */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Perangkat Terdaftar ({approvedSessions.length})
          </CardTitle>
          <CardDescription>Perangkat yang sudah disetujui untuk mengakses admin</CardDescription>
        </CardHeader>
        <CardContent>
          {approvedSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Belum ada perangkat yang terdaftar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {approvedSessions.map(session => (
                <div key={session.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Monitor className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{session.device_name}</p>
                        {session.device_id === currentDeviceId && (
                          <Badge className="bg-primary">Perangkat Ini</Badge>
                        )}
                        <Badge variant="outline" className="text-green-500 border-green-500">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Approved
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{session.device_id}</p>
                      <p className="text-xs text-muted-foreground">
                        {getDeviceInfoProp(session.device_info, 'browser')} • {getDeviceInfoProp(session.device_info, 'os')} • {formatDate(session.login_time)}
                      </p>
                    </div>
                  </div>
                  {session.device_id !== currentDeviceId && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemove(session.id, session.device_name || 'Unknown')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeviceManagement;
