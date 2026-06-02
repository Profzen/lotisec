import crypto from 'crypto';

const PWD_HASH = crypto.createHash('sha256').update('safelife2024').digest('hex');

export const PRO_USERS: Record<string, { nom: string; role: string; unite: string; passwordHash: string }> = {
  'SAMU-CHU-0812': { nom: 'Dr. Ama Koffi', role: 'SAMU', unite: 'CHU Sylvanus Olympio', passwordHash: PWD_HASH },
  'POMPIERS-LME-118': { nom: 'Chef Kokou Doe', role: 'Pompiers', unite: 'Caserne de Lome', passwordHash: PWD_HASH },
  'POLICE-LME-4471': { nom: 'Insp. Mensah', role: 'Police', unite: 'Commissariat Lome', passwordHash: PWD_HASH },
  'AMBU-BE-0021': { nom: 'Ambu Togbe', role: 'Ambulance', unite: 'Hopital de Be', passwordHash: PWD_HASH },
  'GEND-KPM-1133': { nom: 'Adj. Agbeko', role: 'Gendarmerie', unite: 'Brigade Kpalime', passwordHash: PWD_HASH }
};
