import { writeFile } from 'node:fs/promises';

const apiUrl = process.env.VITE_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://lotisec-backend.vercel.app';
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const citizenUrl = process.env.VITE_CITIZEN_URL || 'https://lotisec-frontend.vercel.app';
await writeFile(new URL('../public/config.js', import.meta.url), `window.LOTISEC_API_URL=${JSON.stringify(apiUrl)};\nwindow.LOTISEC_SUPABASE_URL=${JSON.stringify(supabaseUrl)};\nwindow.LOTISEC_SUPABASE_ANON_KEY=${JSON.stringify(supabaseAnonKey)};\nwindow.LOTISEC_CITIZEN_URL=${JSON.stringify(citizenUrl)};\n`, 'utf8');
