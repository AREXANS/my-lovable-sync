import { AlertTriangle, Wrench } from 'lucide-react';
import GlobalBackground from './GlobalBackground';

const MaintenancePage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <GlobalBackground />
      <div className="relative z-10 text-center max-w-md mx-auto space-y-6">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <Wrench className="w-12 h-12 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
            Sedang Maintenance
          </h1>
          <p className="text-muted-foreground text-base md:text-lg">
            Website sedang dalam perbaikan. Silakan kembali beberapa saat lagi.
          </p>
        </div>

        <div className="pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border text-sm text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            Sedang dalam proses...
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
