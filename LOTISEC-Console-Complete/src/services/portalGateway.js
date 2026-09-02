export const HEALTH_EVENTS={
  capacityUpdate:'hospital:capacity:update',
  admissionDecision:'hospital:admission:decision',
  expectedArrival:'mission:arrival:expected',
  handoverUpdate:'mission:handover:update',
}

export const NATIONAL_EVENTS={
  indicatorUpdate:'national:indicator:update',
  dataQualityAlert:'national:data-quality:alert',
  reportGenerated:'national:report:generated',
}

export function getPortalGatewayConfig(){
  return {
    apiUrl:String(import.meta.env.VITE_API_URL||''),
    socketUrl:String(import.meta.env.VITE_SOCKET_URL||''),
    socketPath:String(import.meta.env.VITE_SOCKET_PATH||'/socket.io'),
    operationNamespace:String(import.meta.env.VITE_MOBILE_NAMESPACE||'/operations'),
    healthNamespace:String(import.meta.env.VITE_HEALTH_NAMESPACE||'/health-network'),
    nationalNamespace:String(import.meta.env.VITE_NATIONAL_NAMESPACE||'/national-pilotage'),
    tenantId:String(import.meta.env.VITE_MOBILE_TENANT_ID||'lotisec-togo'),
    operatorClientId:String(import.meta.env.VITE_KEYCLOAK_CLIENT_ID||'lotisec-operator-web'),
    healthClientId:String(import.meta.env.VITE_KEYCLOAK_HEALTH_CLIENT_ID||'lotisec-health-web'),
    nationalClientId:String(import.meta.env.VITE_KEYCLOAK_NATIONAL_CLIENT_ID||'lotisec-national-web'),
    healthRole:String(import.meta.env.VITE_KEYCLOAK_HEALTH_ROLE||'health_professional'),
    nationalRole:String(import.meta.env.VITE_KEYCLOAK_NATIONAL_ROLE||'national_analyst'),
  }
}
