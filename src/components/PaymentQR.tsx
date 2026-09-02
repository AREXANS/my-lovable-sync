import { FC, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, MessageCircle, AlertCircle, RefreshCw } from 'lucide-react';
import GlobalBackground from './GlobalBackground';
import { supabase } from '@/integrations/supabase/client';

interface SocialLink {
  id: string;
  name: string;
  icon_type: string;
  url: string;
  label: string;
  is_active: boolean;
}

interface PaymentQRProps {
  paymentData: {
    transactionId: string;
    qr_string: string;
    qris_url: string;
    totalAmount: number;
    expiresAt: string;
  };
  statusMsg: string;
  errorMsg: string;
  onCancel: () => void;
  onCopy: (text: string) => void;
  onRecheck?: () => void;
  formatRupiah: (n: number) => string;
  packageName?: 'NORMAL' | 'VIP' | 'LIFETIME' | null;
}

const PaymentQR: FC<PaymentQRProps> = ({
  paymentData,
  statusMsg,
  errorMsg,
  onCancel,
  onCopy,
  onRecheck,
  formatRupiah,
  packageName
}) => {
  const roleClass = packageName === 'LIFETIME' ? 'role-lifetime' : packageName === 'VIP' ? 'role-vip' : 'role-normal';
  const [showContactHint, setShowContactHint] = useState(false);
  const [contactLink, setContactLink] = useState<SocialLink | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const [recheckMsg, setRecheckMsg] = useState('');

  const handleRecheck = async () => {
    if (!onRecheck || rechecking) return;
    setRechecking(true);
    setRecheckMsg('');
    try {
      await onRecheck();
      setRecheckMsg('Status diperbarui. Jika sudah bayar, halaman akan otomatis berpindah.');
    } finally {
      setTimeout(() => setRechecking(false), 1500);
      setTimeout(() => setRecheckMsg(''), 5000);
    }
  };



  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContactHint(true);
    }, 30000);

    const fetchContactLink = async () => {
      const { data } = await supabase
        .from('social_links')
        .select('*')
        .eq('is_active', true)
        .or('icon_type.eq.whatsapp-contact,icon_type.eq.whatsapp')
        .order('sort_order')
        .limit(1);

      if (data && data.length > 0) {
        setContactLink(data[0] as SocialLink);
      }
    };

    fetchContactLink();

    return () => clearTimeout(timer);
  }, []);

  const qrColor = packageName === 'LIFETIME' ? '22D3EE' : packageName === 'VIP' ? 'A855F7' : '10B981';

  const qrUrl = paymentData.qr_string
    ? `https://larabert-qrgen.hf.space/v1/create-qr-code?size=500x500&style=2&color=${qrColor}&data=${encodeURIComponent(paymentData.qr_string)}`
    : paymentData.qris_url;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <GlobalBackground />

      <div className={`role-card ${roleClass} p-8 rounded-2xl max-w-md w-full text-center z-10 relative animate-scale-in`}>
        <h2 className="text-2xl font-display font-bold mb-2 role-text">
          Scan untuk Membayar
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          QRIS mendukung Dana, OVO, GoPay, ShopeePay, dll
        </p>

        {errorMsg && (
          <div className="bg-destructive/10 border border-destructive/50 text-destructive p-4 rounded-xl mb-6 text-sm">
            {errorMsg}
          </div>
        )}

        {/* QR Code */}
        <div
          className="p-4 rounded-2xl mb-6 inline-block role-ring animate-float-slow"
          style={{
            background: 'hsl(0 0% 100%)',
            border: '2px solid hsl(var(--r1) / 0.55)',
          }}
        >
          <img
            src={qrUrl}
            alt="QRIS Code"
            className="w-64 h-64 rounded-lg"
            crossOrigin="anonymous"
          />
        </div>

        {/* Amount */}
        <div className="role-panel p-4 mb-6">
          <p className="text-muted-foreground text-sm mb-1">Total Pembayaran</p>
          <p className="text-3xl font-display font-bold role-text">
            {formatRupiah(paymentData.totalAmount)}
          </p>
        </div>

        {/* Status */}
        {statusMsg && (
          <div className="flex items-center justify-center gap-3 mb-4 text-warning">
            <div className="w-3 h-3 bg-warning rounded-full animate-pulse" />
            <span className="font-medium">{statusMsg}</span>
          </div>
        )}

        {/* Manual recheck button */}
        {onRecheck && (
          <div className="mb-6">
            <Button
              type="button"
              onClick={handleRecheck}
              disabled={rechecking}
              className="w-full role-btn-outline"
              variant="outline"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${rechecking ? 'animate-spin' : ''}`} />
              {rechecking ? 'Mengecek pembayaran...' : 'Saya Sudah Bayar, Cek Sekarang'}
            </Button>
            {recheckMsg && (
              <p className="text-xs text-success mt-2">{recheckMsg}</p>
            )}
          </div>
        )}


        {/* Contact Hint */}
        {showContactHint && contactLink && (
          <div className="bg-primary/10 border border-primary/30 p-4 rounded-xl mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-sm text-foreground font-medium mb-2">
                  Sudah bayar tapi status belum berubah?
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Jika pembayaran sudah dilakukan namun status belum berubah, silakan hubungi admin untuk verifikasi manual.
                </p>
                <a
                  href={contactLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-success/20 hover:bg-success/30 text-success px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Hubungi Admin
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Transaction ID */}
        <div className="bg-muted/30 p-3 rounded-lg mb-6">
          <p className="text-xs text-muted-foreground mb-1">ID Transaksi</p>
          <div className="flex items-center justify-center gap-2">
            <code className="text-xs text-foreground font-mono">
              {paymentData.transactionId}
            </code>
            <button
              onClick={() => onCopy(paymentData.transactionId)}
              className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all duration-200"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={onCancel}
          className="w-full border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
        >
          Batalkan Pesanan
        </Button>
      </div>
    </div>
  );
};

export default PaymentQR;
