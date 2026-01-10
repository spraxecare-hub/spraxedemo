export const DIVISIONS = [
  'Dhaka',
  'Chattogram',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Sylhet',
  'Rangpur',
  'Mymensingh',
] as const;

export const DISTRICTS: Record<string, string[]> = {
  Dhaka: ['Dhaka', 'Gazipur', 'Narayanganj', 'Tangail', 'Manikganj', 'Munshiganj', 'Narsingdi', 'Faridpur'],
  Chattogram: ['Chattogram', "Cox's Bazar", 'Comilla', 'Brahmanbaria', 'Noakhali', 'Feni', 'Lakshmipur'],
  Rajshahi: ['Rajshahi', 'Bogra', 'Pabna', 'Sirajganj', 'Natore', 'Naogaon', 'Chapainawabganj'],
  Khulna: ['Khulna', 'Jessore', 'Satkhira', 'Bagerhat', 'Narail', 'Kushtia', 'Meherpur'],
  Barishal: ['Barishal', 'Bhola', 'Patuakhali', 'Pirojpur', 'Jhalokati', 'Barguna'],
  Sylhet: ['Sylhet', 'Moulvibazar', 'Habiganj', 'Sunamganj'],
  Rangpur: ['Rangpur', 'Dinajpur', 'Kurigram', 'Nilphamari', 'Gaibandha', 'Thakurgaon', 'Panchagarh', 'Lalmonirhat'],
  Mymensingh: ['Mymensingh', 'Jamalpur', 'Netrokona', 'Sherpur'],
};

export const formatPrice = (price: number | null, priceType: string): string => {
  if (priceType === 'free') return 'Free';
  if (price === null) return 'Contact for price';
  
  const formatted = new Intl.NumberFormat('en-BD').format(price);
  return `৳${formatted}${priceType === 'negotiable' ? ' (Negotiable)' : ''}`;
};

export const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};
