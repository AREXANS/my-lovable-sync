import { FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdSlider from './AdSlider';
import GlobalBackground from './GlobalBackground';
import { supabase } from '@/integrations/supabase/client';
import { Link as LinkIcon, Key, Coins, History, Search, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Ad {
  id: string;
  title: string;
  media_url: string;
  media_type: string;
  link?: string | null;
  link_url?: string | null;
}

interface Package {
  id: string;
  name: string;
  display_name: string;
  price_per_day: number;
  description: string | null;
  features: string[] | null;
  is_active: boolean;
}

interface SocialLink {
  id: string;
  name: string;
  icon_type: string;
  url: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  link_location: string;
}

interface PackageSelectionProps {
  onSelect: (pkg: 'NORMAL' | 'VIP' | 'LIFETIME') => void;
  formatRupiah: (n: number) => string;
  prices: { NORMAL: number; VIP: number };
  ads: Ad[];
  packages?: Package[];
}

const getIconForType = (iconType: string) => {
  switch (iconType) {
    case 'whatsapp':
    case 'whatsapp-contact':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      );
    case 'whatsapp-group':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="opacity-50">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      );
    case 'telegram':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="opacity-50">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      );
    case 'instagram':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
        </svg>
      );
    case 'discord':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="opacity-50">
          <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
        </svg>
      );
    default:
      return <LinkIcon className="w-5 h-5 opacity-50" />;
  }
};

const PackageSelection: FC<PackageSelectionProps> = ({ onSelect, formatRupiah, prices, ads, packages }) => {
  const navigate = useNavigate();
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [xcoinsEnabled, setXcoinsEnabled] = useState(false);
  const [xcoinsLogoUrl, setXcoinsLogoUrl] = useState('');
  const [unclaimedCount, setUnclaimedCount] = useState(0);

  useEffect(() => {
    const fetchSocialLinks = async () => {
      const { data } = await supabase
        .from('social_links')
        .select('*')
        .eq('is_active', true)
        .eq('link_location', 'home')
        .order('sort_order');
      if (data) setSocialLinks(data as SocialLink[]);
    };

    const checkXcoinsSettings = async () => {
      const { data } = await supabase.from('app_settings').select('key, value').in('key', ['xcoins_enabled', 'xcoins_logo_url']);
      const map = Object.fromEntries((data || []).map((s: any) => [s.key, s.value]));
      setXcoinsEnabled(map.xcoins_enabled === 'on');
      setXcoinsLogoUrl(map.xcoins_logo_url || '');
    };

    const checkUnclaimed = async () => {
      let deviceId = localStorage.getItem('arexans_device_id');
      if (!deviceId) return;
      const { count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('device_id', deviceId)
        .eq('status', 'claimable') as any;
      setUnclaimedCount(count || 0);
    };

    fetchSocialLinks();
    checkXcoinsSettings();
    checkUnclaimed();
  }, []);

  const normalPkg = packages?.find(p => p.name === 'NORMAL');
  const vipPkg = packages?.find(p => p.name === 'VIP');
  const lifetimePkg = packages?.find(p => p.name === 'LIFETIME');

  const normalPrice = normalPkg?.price_per_day ?? prices.NORMAL;
  const vipPrice = vipPkg?.price_per_day ?? prices.VIP;
  const lifetimePrice = lifetimePkg?.price_per_day ?? 700000;
  const normalFeatures = normalPkg?.features ?? ['Semua fitur dasar', 'Update berkala', 'Support all executor'];
  const vipFeatures = vipPkg?.features ?? ['Semua fitur Normal', 'Premium scripts', 'Priority support', 'Early access features'];
  const lifetimeFeatures = lifetimePkg?.features ?? ['Akses script PERMANEN tanpa jangka waktu', 'Akses langsung loadstring script', 'Tanpa loading screen saat execute', 'Semua fitur unlocked / bebas pakai', 'Role ADMIN eksklusif (Cyan)'];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-3 md:p-4 relative overflow-hidden">
      <GlobalBackground />

      <div className="max-w-4xl w-full relative z-10">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between mb-4 md:mb-6 glass-card rounded-2xl px-3 py-2.5 md:px-5 md:py-3">
          {/* Left: Cek Key */}
          <button
            onClick={() => navigate('/key-system')}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors px-2 py-1.5 rounded-lg hover:bg-primary/10"
          >
            <Search className="w-4 h-4" />
            <span className="text-xs md:text-sm font-medium">Cek Key</span>
          </button>

          {/* Center: Title or XCoins */}
          {xcoinsEnabled ? (
            <button
              onClick={() => navigate('/xcoins')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-primary/10 transition-colors"
            >
              <img src={xcoinsLogoUrl || '/images/xcoins-default-logo.png'} alt="XCoins" className="w-7 h-7 md:w-8 md:h-8 rounded-full object-cover border-2 border-primary/50 shadow-lg" />
              <span className="font-display text-sm md:text-base font-bold gradient-text">XCoins</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <img src="/images/arexans-icon.jpg" alt="Arexans" className="w-7 h-7 md:w-8 md:h-8 rounded-full object-cover border-2 border-primary/50 shadow-lg" />
              <span className="font-display text-sm md:text-base font-bold gradient-text">Arexans Tools</span>
            </div>
          )}

          {/* Right: History / Klaim Key */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-colors ${
                unclaimedCount > 0
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 animate-pulse'
                  : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
              }`}
            >
              {unclaimedCount > 0 ? (
                <>
                  <Key className="w-4 h-4" />
                  <span>Klaim Key</span>
                  <span className="min-w-[20px] h-[20px] flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1">
                    {unclaimedCount}
                  </span>
                </>
              ) : (
                <>
                  <History className="w-4 h-4" />
                  <span className="font-medium">History</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Main Title */}
        <div className="text-center mb-6 md:mb-8">
          <div className="relative inline-block mb-3 md:mb-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-black tracking-wider animate-title-gradient bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent bg-[length:200%_auto]">
              AREXANS TOOLS
            </h1>
            <span className="absolute -top-1 md:-top-2 -right-2 md:-right-8 bg-primary text-primary-foreground text-[8px] md:text-[10px] font-bold px-1.5 md:px-2 py-0.5 md:py-1 transform rotate-12 rounded shadow-lg border border-primary/50 font-display animate-glow">
              OFFICIAL
            </span>
          </div>
          <p className="text-muted-foreground text-sm md:text-lg">
            Roblox script supports all executors
          </p>
        </div>

        {/* Ad Slider */}
        {ads.length > 0 && (
          <div className="mb-6 md:mb-8">
            <AdSlider ads={ads} />
          </div>
        )}

        {/* Package Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
          {/* Normal Package */}
          {normalPkg && normalPkg.is_active && (
          <div
            onClick={() => onSelect('NORMAL')}
            className="role-card role-normal p-5 md:p-8 rounded-2xl cursor-pointer group hover:scale-[1.02] transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <span className="role-text font-display text-base md:text-lg font-bold">
                {normalPkg?.display_name ?? 'NORMAL'}
              </span>
              <span className="role-badge text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 rounded-full">
                BASIC
              </span>
            </div>
            <div className="mb-4 md:mb-6">
              <span className="text-3xl md:text-4xl font-display font-black role-text">
                {formatRupiah(normalPrice)}
              </span>
              <span className="text-muted-foreground text-sm md:text-lg">/hari</span>
            </div>
            <ul className="space-y-2 md:space-y-3 text-muted-foreground text-sm md:text-base">
              {normalFeatures.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2 md:gap-3">
                  <span style={{ color: 'hsl(155 90% 60%)' }}>✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-6 md:mt-8">
              <button className="role-btn w-full py-2.5 md:py-3 font-display font-bold text-sm md:text-base">
                Pilih Normal
              </button>
            </div>
          </div>

          )}

          {/* VIP Package */}
          {vipPkg && vipPkg.is_active && (
          <div
            onClick={() => onSelect('VIP')}
            className="vip-card p-5 md:p-8 rounded-2xl cursor-pointer group hover:scale-[1.02] transition-all duration-300"
          >
            <div className="absolute top-3 left-3 z-20 text-white text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-full font-display shadow-lg" style={{ background: 'var(--gradient-vip)', backgroundSize: '200% 200%', animation: 'gradient 10s linear infinite' }}>
              POPULER
            </div>
            <div className="relative flex items-center justify-between mb-4 md:mb-6 mt-7">
              <span className="text-vip font-display text-base md:text-lg font-bold">
                {vipPkg?.display_name ?? 'VIP'}
              </span>
              <span className="text-white text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 rounded-full" style={{ background: 'hsl(280 90% 60% / 0.25)', border: '1px solid hsl(280 90% 65% / 0.5)' }}>
                PREMIUM
              </span>
            </div>
            <div className="relative mb-4 md:mb-6">
              <span className="text-3xl md:text-4xl font-display font-black text-vip">
                {formatRupiah(vipPrice)}
              </span>
              <span className="text-muted-foreground text-sm md:text-lg">/hari</span>
            </div>
            <ul className="relative space-y-2 md:space-y-3 text-muted-foreground text-sm md:text-base">
              {vipFeatures.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2 md:gap-3">
                  <span style={{ color: 'hsl(280 90% 70%)' }}>✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <div className="relative mt-6 md:mt-8">
              <button className="btn-vip w-full font-display font-bold text-sm md:text-base py-2.5 md:py-3">
                Pilih VIP
              </button>
            </div>
          </div>
          )}
        </div>

        {/* LIFETIME ADMIN Package */}
        {lifetimePkg && lifetimePkg.is_active && (
          <div className="mt-6 md:mt-8">
            <div
              onClick={() => onSelect('LIFETIME')}
              className="role-card role-lifetime p-5 md:p-8 rounded-2xl cursor-pointer group hover:scale-[1.01] transition-all duration-300"
            >
              <div className="absolute top-3 left-3 z-20 role-btn text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-full font-display z-20">
                LIFETIME
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4 md:mb-6 mt-7">
                  <span className="role-text font-display text-base md:text-lg font-bold">
                    {lifetimePkg?.display_name ?? 'LIFETIME ADMIN'}
                  </span>
                  <span className="role-badge text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 rounded-full">
                    ADMIN
                  </span>
                </div>
                
                <div className="mb-4 md:mb-6">
                  <span className="text-3xl md:text-4xl font-display font-black role-text">
                    {formatRupiah(lifetimePrice)}
                  </span>
                  <span className="text-muted-foreground text-sm md:text-lg ml-1">/sekali bayar</span>
                </div>

                <ul className="space-y-2 md:space-y-3 text-muted-foreground text-sm md:text-base mb-4">
                  {lifetimeFeatures.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 md:gap-3">
                      <span style={{ color: 'hsl(190 100% 65%)' }}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Notes */}
                <div className="role-panel mt-4 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="role-text font-semibold text-xs mb-1">⚠️ Ketentuan:</p>
                  <p>• Jangan sharing loadstring & keysistem</p>
                  <p>• Jangan memperjual belikan script</p>
                  <p>• No refund</p>
                  <p className="text-destructive font-semibold mt-1">Melanggar = blacklist seumur hidup</p>
                </div>

                <div className="mt-6 md:mt-8">
                  <button className="role-btn w-full py-2.5 md:py-3 font-display font-bold text-sm md:text-base">
                    Beli LIFETIME ADMIN
                  </button>
                </div>
              </div>
            </div>
          </div>

        )}

        {/* Social Links */}
        {socialLinks.length > 0 && (
          <div className="flex items-center justify-center gap-6 mt-8">
            {socialLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                title={link.label}
              >
                {getIconForType(link.icon_type)}
                <span className="text-[10px]">{link.label}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PackageSelection;
