import { createClient } from '@supabase/supabase-js';
import { api } from './api';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    console.warn('[Realtime] Supabase init failed:', e);
  }
}

export function subscribeToRealtime({ onIncident, onIntervention, onResource, onAdmission, onError }) {
  let pollingInterval = null;
  let supabaseChannel = null;

  // 1. Supabase Realtime channel if credentials exist
  if (supabase) {
    try {
      supabaseChannel = supabase
        .channel('lotisec-operations')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, (payload) => {
          onIncident?.(payload.new, payload.eventType);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'interventions' }, (payload) => {
          onIntervention?.(payload.new, payload.eventType);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'response_units' }, (payload) => {
          onResource?.(payload.new, payload.eventType);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hospital_admission_requests' }, (payload) => {
          onAdmission?.(payload.new, payload.eventType);
        })
        .subscribe((status) => {
          console.log('[Realtime] Supabase channel status:', status);
        });
    } catch (err) {
      console.warn('[Realtime] Subscription error:', err);
    }
  }

  // 2. Fallback polling for live synchronization every 6 seconds
  const poll = async () => {
    try {
      const [incidentsRes, resourcesRes, facilitiesRes] = await Promise.allSettled([
        api.getIncidents(),
        api.getResources(),
        api.getFacilities(),
      ]);

      if (incidentsRes.status === 'fulfilled' && Array.isArray(incidentsRes.value?.incidents || incidentsRes.value)) {
        const list = incidentsRes.value?.incidents || incidentsRes.value;
        list.forEach((inc) => onIncident?.(inc, 'POLL'));
      }
      if (resourcesRes.status === 'fulfilled' && Array.isArray(resourcesRes.value?.resources || resourcesRes.value)) {
        const list = resourcesRes.value?.resources || resourcesRes.value;
        list.forEach((res) => onResource?.(res, 'POLL'));
      }
      if (facilitiesRes.status === 'fulfilled' && Array.isArray(facilitiesRes.value?.facilities || facilitiesRes.value)) {
        const list = facilitiesRes.value?.facilities || facilitiesRes.value;
        list.forEach((fac) => onAdmission?.(fac, 'POLL_FACILITY'));
      }
    } catch (e) {
      // ignore transient poll error
    }
  };

  // Start polling as reliable continuous heartbeat
  pollingInterval = setInterval(poll, 6000);
  poll(); // immediate initial fetch

  return () => {
    if (pollingInterval) clearInterval(pollingInterval);
    if (supabaseChannel && supabase) {
      supabase.removeChannel(supabaseChannel);
    }
  };
}
