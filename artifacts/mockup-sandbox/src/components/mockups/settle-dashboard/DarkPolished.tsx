import { useEffect } from 'react';
import './_group.css';
import './_polished.css';
import { Dashboard } from './_shared/Dashboard';

export function DarkPolished() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => document.documentElement.classList.remove('dark');
  }, []);

  return <Dashboard polished />;
}
