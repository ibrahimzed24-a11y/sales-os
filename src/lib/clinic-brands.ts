/**
 * Valioz Health — Target Clinic Brand Registry (Dual-Brand)
 *
 * Every recipient email has two brand layers:
 *   • Wrapper (header/footer/button/footer) = Valioz Health — always Valioz brand
 *   • Content body (logo/headline/colors) = Target clinic — that clinic's own brand
 *
 * Match keys to contact.clinicId / accountId in Sales OS.
 * Katteb: populate this from your Sales OS /clinics or /accounts data.
 */

export interface ClinicBrand {
  id: string;
  name: string;
  primary: string;      // headline color
  secondary: string;    // secondary accent
  text: string;         // body text color
  accent: string;       // eyebrow / proof-box accent
  logoUrl: string;      // clinic logo (absolute https URL)
  siteUrl: string;      // clinic website
}

export const CLINIC_BRANDS: Record<string, ClinicBrand> = {
  clinic_dental_downtown: {
    id: 'clinic_dental_downtown',
    name: 'Downtown Family Dental',
    primary: '#1B5E20',
    secondary: '#4CAF50',
    text: '#212121',
    accent: '#FFB300',
    logoUrl: 'https://osv.nilesupplies.com/assets/clinics/downtown-dental-logo.png',
    siteUrl: 'https://downtowndental.example.com',
  },
  clinic_smile_bright: {
    id: 'clinic_smile_bright',
    name: 'Smile Bright Dentistry',
    primary: '#7B1FA2',
    secondary: '#CE93D8',
    text: '#1A1A1A',
    accent: '#FF4081',
    logoUrl: 'https://osv.nilesupplies.com/assets/clinics/smile-bright-logo.png',
    siteUrl: 'https://smilebright.example.com',
  },
  clinic_calm_mind: {
    id: 'clinic_calm_mind',
    name: 'Calm Mind Psychology',
    primary: '#0D47A1',
    secondary: '#90CAF9',
    text: '#172C46',
    accent: '#29B6F6',
    logoUrl: 'https://osv.nilesupplies.com/assets/clinics/calm-mind-logo.png',
    siteUrl: 'https://calmmind.example.com',
  },
  clinic_north_medical: {
    id: 'clinic_north_medical',
    name: 'North York Medical Centre',
    primary: '#B71C1C',
    secondary: '#EF9A9A',
    text: '#212121',
    accent: '#FF7043',
    logoUrl: 'https://osv.nilesupplies.com/assets/clinics/north-medical-logo.png',
    siteUrl: 'https://northyorkmed.example.com',
  },
};

/** Resolve a contact to its clinic brand. Falls back to neutral default. */
export function resolveClinicBrand(clinicId?: string): ClinicBrand {
  if (clinicId && CLINIC_BRANDS[clinicId]) return CLINIC_BRANDS[clinicId];
  return {
    id: 'default',
    name: 'Your Practice',
    primary: '#172C46',
    secondary: '#56667A',
    text: '#212121',
    accent: '#00AFA5',
    logoUrl: '',
    siteUrl: 'https://health.valioz.com',
  };
}
