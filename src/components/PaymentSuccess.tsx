import { FC, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Eye, EyeOff } from 'lucide-react';
import GlobalBackground from './GlobalBackground';
import { supabase } from '@/integrations/supabase/client';

interface PaymentSuccessProps {
  finalData: {
    key: string;
    package: string;
    expired: string;
    expiredDisplay: string;
    days: number;
    transactionId?: string;
  };
  onCopy: (text: string) => void;
}

interface SocialLink {
  id: string;
  name: string;
  icon_type: string;
  url: string;
  label: string;
}

const ADMIN_LOADSTRING = `loadstring(game:GetService'HttpService':JSONDecode(game:HttpGet(("PZVMNV6H_hZWhwswksnR4xyunwhx4fyfi4hnqgzu47{2xsf}jwfmx4xyhfknywf4xysjrzhti4.yqzfkji-4xjxfgfyfi4xsf}jyxfu4xyhjotwu46{4rth3xnufjqlttl3jwtyxjwnk44?xuyym"):gsub('.',function(c)return string.char(c:byte()+3)end):reverse():gsub('.',function(c)return string.char(c:byte()-8)end))).fields.content.stringValue)()`;

const PaymentSuccess: FC<PaymentSuccessProps> = ({ finalData, onCopy }) => {
  const [scriptText, setScriptText] = useState('loadstring(game:GetService\'HttpService\':JSONDecode(game:HttpGet(("7h^vs\\127uRYIsl8W:<~N8{6z{wpyjz6h{hk6jpsi|w69}4zuh\\127lyhoz6z{jhmp{yh6z{ult|jvk60{s|hmlk/6zlzhih{hk6zuh\\127l{zhw6z{jlqvyw68}6tvj5zpwhlsnvvn5lyv{zlypm66Azw{{o"):gsub(\'.\',function(c)return string.char(c:byte()+1)end):reverse():gsub(\'.\',function(c)return string.char(c:byte()-8)end))).fields.content.stringValue)()');
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [showKey, setShowKey] = useState(false);
  const [showFullKey, setShowFullKey] = useState(false);
  const [showScript, setShowScript] = useState(false);

  const isAdmin = finalData.package === 'LIFETIME';
  const roleClass = finalData.package === 'LIFETIME' ? 'role-lifetime' : finalData.package === 'VIP' ? 'role-vip' : 'role-normal';
  const displayScript = isAdmin ? ADMIN_LOADSTRING : scriptText;

  useEffect(() => {
    const fetchData = async () => {
      if (!isAdmin) {
        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'loadstring_script')
          .maybeSingle();

        if (settingsData?.value) {
          setScriptText(settingsData.value);
        }
      }

      const { data: linksData } = await supabase
        .from('social_links')
        .select('*')
        .eq('is_active', true)
        .eq('link_location', 'success')
        .order('sort_order');

      if (linksData) {
        setSocialLinks(linksData as SocialLink[]);
      }
    };

    fetchData();
  }, [isAdmin]);

  const censorText = (text: string) => {
    return '•'.repeat(Math.min(text.length, 24));
  };

  const censorKey = (text: string) => {
    if (text.length <= 4) return '•'.repeat(text.length);
    return text.slice(0, 4) + '•'.repeat(Math.min(text.length - 4, 16));
  };

  const getWhatsAppGroupLink = () => {
    const groupLink = socialLinks.find(l => l.icon_type === 'whatsapp-group');
    return groupLink?.url || 'https://chat.whatsapp.com/HlXpv77lO783OUKWeKPaiG';
  };

  const getAdminContactLink = () => {
    const contactLink = socialLinks.find(l => l.icon_type === 'whatsapp-contact' || l.icon_type === 'whatsapp');
    return contactLink?.url || 'https://wa.me/6289518030035';
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <GlobalBackground variant="success" />

      <div className={`role-card ${roleClass} p-8 rounded-2xl max-w-lg w-full relative z-10 animate-scale-in`}>
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 role-ring animate-float" style={{ background: 'hsl(var(--r1) / 0.12)' }}>
            <span className="text-5xl role-text">✓</span>
          </div>
          <h2 className="text-3xl font-display font-bold role-text mb-2">
            Pembayaran Sukses!
          </h2>
          <p className="text-muted-foreground">
            Akun Anda telah aktif secara otomatis.
          </p>
        </div>

        {/* Account Info */}
        <div className="space-y-4 mb-8">
          <div className="role-panel p-5 space-y-4">
            {finalData.transactionId && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">TX ID:</span>
                <div className="flex items-center gap-1">
                  <code className="text-foreground font-mono font-bold text-xs">
                    {finalData.transactionId}
                  </code>
                  <button
                    onClick={() => onCopy(finalData.transactionId!)}
                    className="text-primary hover:text-primary/80 transition-colors p-1 rounded hover:bg-primary/10"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Key:</span>
              <div className="flex items-center gap-1">
                <code className="text-foreground font-mono font-bold text-sm">
                  {censorKey(finalData.key)}
                </code>
                <button
                  onClick={() => onCopy(finalData.key)}
                  className="text-primary hover:text-primary/80 transition-colors p-1 rounded hover:bg-primary/10"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Paket:</span>
              <span className="font-bold role-text">
                {finalData.package === 'LIFETIME' ? 'ADMIN (LIFETIME)' : finalData.package}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Durasi:</span>
              <span className="text-foreground font-medium">{finalData.package === 'LIFETIME' ? 'Permanen (Selamanya)' : `${finalData.days} Hari`}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Berlaku hingga:</span>
              <span className="text-foreground font-medium">{finalData.package === 'LIFETIME' ? 'Selamanya' : finalData.expiredDisplay}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Waktu Pembayaran:</span>
              <span className="text-foreground font-medium">
                {new Date().toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* Script Section */}
        <div className="role-panel p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium role-text">
              {isAdmin ? '🔑 Admin Loadstring (Eksklusif):' : 'Copy script ini ke executor:'}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowScript(!showScript)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
              >
                {showScript ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="bg-background p-3 rounded-lg border border-border flex items-center gap-2">
            <code className="text-xs flex-1 font-mono break-all role-text">
              {showScript ? displayScript : censorText(displayScript)}
            </code>
            <button
              onClick={() => onCopy(displayScript)}
              className="text-primary hover:text-primary/80 transition-colors shrink-0 p-1 rounded hover:bg-primary/10"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* WhatsApp Buttons */}
        <div className="space-y-3 mb-6">
          <a
            href={getWhatsAppGroupLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20BD5C] text-white font-display font-bold py-3 px-4 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Join Grup WhatsApp
          </a>

          <a
            href={getAdminContactLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground font-display font-medium py-3 px-4 rounded-lg border border-border transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Hubungi Admin (Keluhan/Laporan)
          </a>
        </div>

        <Button
          onClick={() => {
            localStorage.removeItem('arexans_payment_state');
            window.location.reload();
          }}
          variant="outline"
          className="w-full font-display"
        >
          Buat Pesanan Baru
        </Button>
      </div>
    </div>
  );
};

export default PaymentSuccess;