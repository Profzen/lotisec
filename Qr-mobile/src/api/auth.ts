import { api } from './config';

export const registerUser = async (
  phone: string,
  password: string,
  accountType: 'citizen' | 'zem_driver' = 'citizen',
  zemApplication?: { identityDocument: string; licenseNumber: string; motorcycleMake: string; motorcycleModel?: string; plate: string; workZone: string }
) => {
  return await api('/auth/register', 'POST', {
    phone, password, account_type: accountType,
    ...(zemApplication ? { zem_application: {
      identity_document: zemApplication.identityDocument,
      license_number: zemApplication.licenseNumber,
      motorcycle_make: zemApplication.motorcycleMake,
      motorcycle_model: zemApplication.motorcycleModel,
      plate: zemApplication.plate,
      work_zone: zemApplication.workZone
    }} : {})
  });
};

export const loginUser = async (phone: string, password: string) => {
  // Le login se fait maintenant aussi via le téléphone
  return await api('/auth/login', 'POST', { phone, password });
};

export const getMe = async (token: string) => {
  return await api('/auth/me', 'GET', undefined, token);
};
