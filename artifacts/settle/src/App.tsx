import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Router as WouterRouter } from 'wouter';
import { OpusolApp } from './opusol';

const queryClient = new QueryClient();

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><ErrorBoundary><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><OpusolApp /></WouterRouter></ErrorBoundary><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
