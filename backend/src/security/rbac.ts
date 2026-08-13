export const ROLE_KEYS = ['admin','supervisor','dispatcher','firefighter','ambulance_driver','hospital_manager','hospital_agent','zem_driver','citizen'] as const;
export type RoleKey = typeof ROLE_KEYS[number];

export const ROLE_PERMISSIONS: Record<RoleKey, string[]> = {
  admin: ['*','admin:manage'],
  supervisor: ['incidents:read','incidents:manage','interventions:read','interventions:manage','resources:read','facilities:read','reports:read','zem:approve','medical_access:manage','organization:members'],
  dispatcher: ['incidents:read','incidents:manage','interventions:read','interventions:manage','resources:read','facilities:read'],
  firefighter: ['interventions:assigned','interventions:update','facilities:read'],
  ambulance_driver: ['interventions:assigned','interventions:update','facilities:read'],
  hospital_manager: ['admissions:organization','facilities:manage','organization:members','medical_access:manage'],
  hospital_agent: ['admissions:organization','facilities:read'],
  zem_driver: ['zem:drive'],
  citizen: ['profile:self','incidents:create','zem:ride']
};

export function permissionsFor(roles: string[]) {
  return [...new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role as RoleKey] || []))];
}

export function hasPermission(permissions: string[], required: string) {
  return permissions.includes('*') || permissions.includes(required);
}

export function rolesForOrganization(rows:{role_key:string;organization_id?:string|null}[],organizationId?:string|null) {
  return [...new Set(rows.filter((row)=>!row.organization_id||row.organization_id===organizationId).map((row)=>row.role_key))];
}
