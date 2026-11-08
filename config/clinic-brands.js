/**
 * Valioz Health — Target Clinic Brand Registry
 * Each clinic that receives personalized emails gets its own brand layer.
 * Katteb: populate this from your Sales OS /accounts or /clinics data.
 * The content body of every email uses the clinic's colors + logo.
 * The wrapper (header/footer/button) always uses Valioz Health brand.
 */

const CLINIC_BRANDS = {
  // Example: clinic id -> brand
  // Match these IDs to contact.clinicId or contact.accountId in Sales OS.
  clinic_dental_downtown: {
    name: 'Downtown Family Dental',
    primary: '#1B5E20',      // deep green
    secondary: '#4CAF50',    // light green
    text: '#212121',
    accent: '#FFB300',       // amber
    logoUrl: 'https://osv.nilesupplies.com/assets/clinics/downtown-dental-logo.png',
    siteUrl: 'https://downtowndental.example.com',
  },
  clinic_smile_bright: {
    name: 'Smile Bright Dentistry',
    primary: '#7B1FA2',      // purple
    secondary: '#CE93D8',
    text: '#1A1A1A',
    accent: '#FF4081',       // pink
    logoUrl: 'https://osv.nilesupplies.com/assets/clinics/smile-bright-logo.png',
    siteUrl: 'https://smilebright.example.com',
  },
  clinic_calm_mind: {
    name: 'Calm Mind Psychology',
    primary: '#0D47A1',      // blue
    secondary: '#90CAF9',
    text: '#172C46',
    accent: '#29B6F6',       // light blue
    logoUrl: 'https://osv.nilesupplies.com/assets/clinics/calm-mind-logo.png',
    siteUrl: 'https://calmmind.example.com',
  },
  clinic_north_medical: {
    name: 'North York Medical Centre',
    primary: '#B71C1C',      // red
    secondary: '#EF9A9A',
    text: '#212121',
    accent: '#FF7043',       // orange
    logoUrl: 'https://osv.nilesupplies.com/assets/clinics/north-medical-logo.png',
    siteUrl: 'https://northyorkmed.example.com',
  },
};

/**
 * Resolve a contact to its clinic brand.
 * Falls back to a neutral default if clinic not found.
 */
function resolveClinicBrand(contact) {
  const clinicId = contact.clinicId || contact.accountId || contact.clinic;
  const brand = CLINIC_BRANDS[clinicId];
  if (brand) return brand;

  // Default neutral clinic brand
  return {
    name: contact.company || 'Your Practice',
    primary: '#172C46',
    secondary: '#56667A',
    text: '#212121',
    accent: '#01A19D',
    logoUrl: '',
    siteUrl: 'https://health.valioz.com',
  };
}

module.exports = { CLINIC_BRANDS, resolveClinicBrand };
