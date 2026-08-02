export const INCIDENT_TRANSITIONS:Record<string,string[]> = {
  new:['validated','rejected','cancelled'], validated:['assigned','rejected','cancelled'], assigned:['en_route','cancelled'],
  en_route:['on_scene','cancelled'], on_scene:['patient_loaded','completed','cancelled'], patient_loaded:['to_hospital','completed'],
  to_hospital:['arrived_hospital','cancelled'], arrived_hospital:['completed'], completed:[], rejected:[], cancelled:[]
};

export const INTERVENTION_TRANSITIONS:Record<string,string[]> = {
  assigned:['accepted','cancelled'], accepted:['en_route','cancelled'], en_route:['on_scene','cancelled'],
  on_scene:['patient_loaded','completed','cancelled'], patient_loaded:['hospital_requested','to_hospital','completed'],
  hospital_requested:['to_hospital','cancelled'], to_hospital:['arrived_hospital','cancelled'],
  arrived_hospital:['completed'], completed:[], cancelled:[]
};

export const RIDE_TRANSITIONS:Record<string,string[]> = {
  requested:['accepted','canceled'],
  searching:['offered','expired','canceled'], offered:['accepted','offered','expired','canceled'],
  accepted:['driver_en_route','canceled'], driver_en_route:['driver_arrived','canceled'],
  driver_arrived:['ready_to_start','no_show','canceled'], ready_to_start:['in_progress','canceled'],
  in_progress:['driver_completed','canceled'], driver_completed:['completed','disputed'],
  completed:[], canceled:[], expired:[], no_show:[], disputed:[]
};

export function canTransition(map:Record<string,string[]>, from:string, to:string) {
  return (map[from] || []).includes(to);
}
