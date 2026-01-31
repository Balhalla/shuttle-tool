import { useState, useEffect, useRef } from 'react';

// Convert country code to flag emoji
const getFlagEmoji = (countryCode: string): string => {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// All country codes sorted alphabetically, with Belgium first as default
const COUNTRY_CODES = [
  { code: '+32', country: 'Belgium', iso: 'BE' },
  { code: '+93', country: 'Afghanistan', iso: 'AF' },
  { code: '+355', country: 'Albania', iso: 'AL' },
  { code: '+213', country: 'Algeria', iso: 'DZ' },
  { code: '+1684', country: 'American Samoa', iso: 'AS' },
  { code: '+376', country: 'Andorra', iso: 'AD' },
  { code: '+244', country: 'Angola', iso: 'AO' },
  { code: '+1264', country: 'Anguilla', iso: 'AI' },
  { code: '+1268', country: 'Antigua and Barbuda', iso: 'AG' },
  { code: '+54', country: 'Argentina', iso: 'AR' },
  { code: '+374', country: 'Armenia', iso: 'AM' },
  { code: '+297', country: 'Aruba', iso: 'AW' },
  { code: '+61', country: 'Australia', iso: 'AU' },
  { code: '+43', country: 'Austria', iso: 'AT' },
  { code: '+994', country: 'Azerbaijan', iso: 'AZ' },
  { code: '+1242', country: 'Bahamas', iso: 'BS' },
  { code: '+973', country: 'Bahrain', iso: 'BH' },
  { code: '+880', country: 'Bangladesh', iso: 'BD' },
  { code: '+1246', country: 'Barbados', iso: 'BB' },
  { code: '+375', country: 'Belarus', iso: 'BY' },
  { code: '+501', country: 'Belize', iso: 'BZ' },
  { code: '+229', country: 'Benin', iso: 'BJ' },
  { code: '+1441', country: 'Bermuda', iso: 'BM' },
  { code: '+975', country: 'Bhutan', iso: 'BT' },
  { code: '+591', country: 'Bolivia', iso: 'BO' },
  { code: '+387', country: 'Bosnia and Herzegovina', iso: 'BA' },
  { code: '+267', country: 'Botswana', iso: 'BW' },
  { code: '+55', country: 'Brazil', iso: 'BR' },
  { code: '+673', country: 'Brunei', iso: 'BN' },
  { code: '+359', country: 'Bulgaria', iso: 'BG' },
  { code: '+226', country: 'Burkina Faso', iso: 'BF' },
  { code: '+257', country: 'Burundi', iso: 'BI' },
  { code: '+855', country: 'Cambodia', iso: 'KH' },
  { code: '+237', country: 'Cameroon', iso: 'CM' },
  { code: '+1', country: 'Canada', iso: 'CA' },
  { code: '+238', country: 'Cape Verde', iso: 'CV' },
  { code: '+1345', country: 'Cayman Islands', iso: 'KY' },
  { code: '+236', country: 'Central African Republic', iso: 'CF' },
  { code: '+235', country: 'Chad', iso: 'TD' },
  { code: '+56', country: 'Chile', iso: 'CL' },
  { code: '+86', country: 'China', iso: 'CN' },
  { code: '+57', country: 'Colombia', iso: 'CO' },
  { code: '+269', country: 'Comoros', iso: 'KM' },
  { code: '+242', country: 'Congo (Brazzaville)', iso: 'CG' },
  { code: '+243', country: 'Congo (Kinshasa)', iso: 'CD' },
  { code: '+682', country: 'Cook Islands', iso: 'CK' },
  { code: '+506', country: 'Costa Rica', iso: 'CR' },
  { code: '+225', country: "Côte d'Ivoire", iso: 'CI' },
  { code: '+385', country: 'Croatia', iso: 'HR' },
  { code: '+53', country: 'Cuba', iso: 'CU' },
  { code: '+357', country: 'Cyprus', iso: 'CY' },
  { code: '+420', country: 'Czech Republic', iso: 'CZ' },
  { code: '+45', country: 'Denmark', iso: 'DK' },
  { code: '+253', country: 'Djibouti', iso: 'DJ' },
  { code: '+1767', country: 'Dominica', iso: 'DM' },
  { code: '+1809', country: 'Dominican Republic', iso: 'DO' },
  { code: '+593', country: 'Ecuador', iso: 'EC' },
  { code: '+20', country: 'Egypt', iso: 'EG' },
  { code: '+503', country: 'El Salvador', iso: 'SV' },
  { code: '+240', country: 'Equatorial Guinea', iso: 'GQ' },
  { code: '+291', country: 'Eritrea', iso: 'ER' },
  { code: '+372', country: 'Estonia', iso: 'EE' },
  { code: '+268', country: 'Eswatini', iso: 'SZ' },
  { code: '+251', country: 'Ethiopia', iso: 'ET' },
  { code: '+679', country: 'Fiji', iso: 'FJ' },
  { code: '+358', country: 'Finland', iso: 'FI' },
  { code: '+33', country: 'France', iso: 'FR' },
  { code: '+594', country: 'French Guiana', iso: 'GF' },
  { code: '+689', country: 'French Polynesia', iso: 'PF' },
  { code: '+241', country: 'Gabon', iso: 'GA' },
  { code: '+220', country: 'Gambia', iso: 'GM' },
  { code: '+995', country: 'Georgia', iso: 'GE' },
  { code: '+49', country: 'Germany', iso: 'DE' },
  { code: '+233', country: 'Ghana', iso: 'GH' },
  { code: '+30', country: 'Greece', iso: 'GR' },
  { code: '+1473', country: 'Grenada', iso: 'GD' },
  { code: '+590', country: 'Guadeloupe', iso: 'GP' },
  { code: '+1671', country: 'Guam', iso: 'GU' },
  { code: '+502', country: 'Guatemala', iso: 'GT' },
  { code: '+224', country: 'Guinea', iso: 'GN' },
  { code: '+245', country: 'Guinea-Bissau', iso: 'GW' },
  { code: '+592', country: 'Guyana', iso: 'GY' },
  { code: '+509', country: 'Haiti', iso: 'HT' },
  { code: '+504', country: 'Honduras', iso: 'HN' },
  { code: '+852', country: 'Hong Kong', iso: 'HK' },
  { code: '+36', country: 'Hungary', iso: 'HU' },
  { code: '+354', country: 'Iceland', iso: 'IS' },
  { code: '+91', country: 'India', iso: 'IN' },
  { code: '+62', country: 'Indonesia', iso: 'ID' },
  { code: '+98', country: 'Iran', iso: 'IR' },
  { code: '+964', country: 'Iraq', iso: 'IQ' },
  { code: '+353', country: 'Ireland', iso: 'IE' },
  { code: '+972', country: 'Israel', iso: 'IL' },
  { code: '+39', country: 'Italy', iso: 'IT' },
  { code: '+1876', country: 'Jamaica', iso: 'JM' },
  { code: '+81', country: 'Japan', iso: 'JP' },
  { code: '+962', country: 'Jordan', iso: 'JO' },
  { code: '+7', country: 'Kazakhstan', iso: 'KZ' },
  { code: '+254', country: 'Kenya', iso: 'KE' },
  { code: '+686', country: 'Kiribati', iso: 'KI' },
  { code: '+965', country: 'Kuwait', iso: 'KW' },
  { code: '+996', country: 'Kyrgyzstan', iso: 'KG' },
  { code: '+856', country: 'Laos', iso: 'LA' },
  { code: '+371', country: 'Latvia', iso: 'LV' },
  { code: '+961', country: 'Lebanon', iso: 'LB' },
  { code: '+266', country: 'Lesotho', iso: 'LS' },
  { code: '+231', country: 'Liberia', iso: 'LR' },
  { code: '+218', country: 'Libya', iso: 'LY' },
  { code: '+423', country: 'Liechtenstein', iso: 'LI' },
  { code: '+370', country: 'Lithuania', iso: 'LT' },
  { code: '+352', country: 'Luxembourg', iso: 'LU' },
  { code: '+853', country: 'Macau', iso: 'MO' },
  { code: '+261', country: 'Madagascar', iso: 'MG' },
  { code: '+265', country: 'Malawi', iso: 'MW' },
  { code: '+60', country: 'Malaysia', iso: 'MY' },
  { code: '+960', country: 'Maldives', iso: 'MV' },
  { code: '+223', country: 'Mali', iso: 'ML' },
  { code: '+356', country: 'Malta', iso: 'MT' },
  { code: '+692', country: 'Marshall Islands', iso: 'MH' },
  { code: '+596', country: 'Martinique', iso: 'MQ' },
  { code: '+222', country: 'Mauritania', iso: 'MR' },
  { code: '+230', country: 'Mauritius', iso: 'MU' },
  { code: '+52', country: 'Mexico', iso: 'MX' },
  { code: '+691', country: 'Micronesia', iso: 'FM' },
  { code: '+373', country: 'Moldova', iso: 'MD' },
  { code: '+377', country: 'Monaco', iso: 'MC' },
  { code: '+976', country: 'Mongolia', iso: 'MN' },
  { code: '+382', country: 'Montenegro', iso: 'ME' },
  { code: '+212', country: 'Morocco', iso: 'MA' },
  { code: '+258', country: 'Mozambique', iso: 'MZ' },
  { code: '+95', country: 'Myanmar', iso: 'MM' },
  { code: '+264', country: 'Namibia', iso: 'NA' },
  { code: '+674', country: 'Nauru', iso: 'NR' },
  { code: '+977', country: 'Nepal', iso: 'NP' },
  { code: '+31', country: 'Netherlands', iso: 'NL' },
  { code: '+64', country: 'New Zealand', iso: 'NZ' },
  { code: '+505', country: 'Nicaragua', iso: 'NI' },
  { code: '+227', country: 'Niger', iso: 'NE' },
  { code: '+234', country: 'Nigeria', iso: 'NG' },
  { code: '+683', country: 'Niue', iso: 'NU' },
  { code: '+850', country: 'North Korea', iso: 'KP' },
  { code: '+389', country: 'North Macedonia', iso: 'MK' },
  { code: '+47', country: 'Norway', iso: 'NO' },
  { code: '+968', country: 'Oman', iso: 'OM' },
  { code: '+92', country: 'Pakistan', iso: 'PK' },
  { code: '+680', country: 'Palau', iso: 'PW' },
  { code: '+507', country: 'Panama', iso: 'PA' },
  { code: '+675', country: 'Papua New Guinea', iso: 'PG' },
  { code: '+595', country: 'Paraguay', iso: 'PY' },
  { code: '+51', country: 'Peru', iso: 'PE' },
  { code: '+63', country: 'Philippines', iso: 'PH' },
  { code: '+48', country: 'Poland', iso: 'PL' },
  { code: '+351', country: 'Portugal', iso: 'PT' },
  { code: '+1787', country: 'Puerto Rico', iso: 'PR' },
  { code: '+974', country: 'Qatar', iso: 'QA' },
  { code: '+40', country: 'Romania', iso: 'RO' },
  { code: '+7', country: 'Russia', iso: 'RU' },
  { code: '+250', country: 'Rwanda', iso: 'RW' },
  { code: '+1869', country: 'Saint Kitts and Nevis', iso: 'KN' },
  { code: '+1758', country: 'Saint Lucia', iso: 'LC' },
  { code: '+1784', country: 'Saint Vincent and the Grenadines', iso: 'VC' },
  { code: '+685', country: 'Samoa', iso: 'WS' },
  { code: '+378', country: 'San Marino', iso: 'SM' },
  { code: '+239', country: 'São Tomé and Príncipe', iso: 'ST' },
  { code: '+966', country: 'Saudi Arabia', iso: 'SA' },
  { code: '+221', country: 'Senegal', iso: 'SN' },
  { code: '+381', country: 'Serbia', iso: 'RS' },
  { code: '+248', country: 'Seychelles', iso: 'SC' },
  { code: '+232', country: 'Sierra Leone', iso: 'SL' },
  { code: '+65', country: 'Singapore', iso: 'SG' },
  { code: '+421', country: 'Slovakia', iso: 'SK' },
  { code: '+386', country: 'Slovenia', iso: 'SI' },
  { code: '+677', country: 'Solomon Islands', iso: 'SB' },
  { code: '+252', country: 'Somalia', iso: 'SO' },
  { code: '+27', country: 'South Africa', iso: 'ZA' },
  { code: '+82', country: 'South Korea', iso: 'KR' },
  { code: '+34', country: 'Spain', iso: 'ES' },
  { code: '+94', country: 'Sri Lanka', iso: 'LK' },
  { code: '+249', country: 'Sudan', iso: 'SD' },
  { code: '+597', country: 'Suriname', iso: 'SR' },
  { code: '+46', country: 'Sweden', iso: 'SE' },
  { code: '+41', country: 'Switzerland', iso: 'CH' },
  { code: '+963', country: 'Syria', iso: 'SY' },
  { code: '+886', country: 'Taiwan', iso: 'TW' },
  { code: '+992', country: 'Tajikistan', iso: 'TJ' },
  { code: '+255', country: 'Tanzania', iso: 'TZ' },
  { code: '+66', country: 'Thailand', iso: 'TH' },
  { code: '+670', country: 'Timor-Leste', iso: 'TL' },
  { code: '+228', country: 'Togo', iso: 'TG' },
  { code: '+676', country: 'Tonga', iso: 'TO' },
  { code: '+1868', country: 'Trinidad and Tobago', iso: 'TT' },
  { code: '+216', country: 'Tunisia', iso: 'TN' },
  { code: '+90', country: 'Turkey', iso: 'TR' },
  { code: '+993', country: 'Turkmenistan', iso: 'TM' },
  { code: '+688', country: 'Tuvalu', iso: 'TV' },
  { code: '+256', country: 'Uganda', iso: 'UG' },
  { code: '+380', country: 'Ukraine', iso: 'UA' },
  { code: '+971', country: 'United Arab Emirates', iso: 'AE' },
  { code: '+44', country: 'United Kingdom', iso: 'GB' },
  { code: '+1', country: 'United States', iso: 'US' },
  { code: '+598', country: 'Uruguay', iso: 'UY' },
  { code: '+998', country: 'Uzbekistan', iso: 'UZ' },
  { code: '+678', country: 'Vanuatu', iso: 'VU' },
  { code: '+58', country: 'Venezuela', iso: 'VE' },
  { code: '+84', country: 'Vietnam', iso: 'VN' },
  { code: '+967', country: 'Yemen', iso: 'YE' },
  { code: '+260', country: 'Zambia', iso: 'ZM' },
  { code: '+263', country: 'Zimbabwe', iso: 'ZW' },
];

// Expected number of digits in the local part (after country code, without leading zero)
// for Belgium and neighbouring countries
const LOCAL_DIGIT_LENGTHS: Record<string, { min: number; max: number; label: string; placeholder: string }> = {
  '+32':  { min: 8, max: 9, label: 'Belgian', placeholder: '4xx xx xx xx' },
  '+33':  { min: 9, max: 9, label: 'French', placeholder: '6 xx xx xx xx' },
  '+49':  { min: 10, max: 11, label: 'German', placeholder: '1xx xxxx xxxx' },
  '+31':  { min: 9, max: 9, label: 'Dutch', placeholder: '6 xxxx xxxx' },
  '+352': { min: 8, max: 9, label: 'Luxembourg', placeholder: '6xx xxx xxx' },
  '+44':  { min: 10, max: 10, label: 'UK', placeholder: '7xxx xxxxxx' },
};

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

export function PhoneInput({ value, onChange, required, disabled, id }: PhoneInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse existing value to extract country code and local number
  const parsePhone = (phone: string): { countryCode: string; localNumber: string } => {
    if (!phone) {
      return { countryCode: '+32', localNumber: '' }; // Default to Belgium
    }

    // Sort by code length descending to match longer codes first (e.g., +1868 before +1)
    const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);

    // Try to match a country code
    for (const { code } of sortedCodes) {
      if (phone.startsWith(code)) {
        return {
          countryCode: code,
          localNumber: phone.slice(code.length).replace(/\D/g, '').replace(/^0+/, ''),
        };
      }
    }

    // If no match, assume it's a local number with default country code
    return { countryCode: '+32', localNumber: phone.replace(/\D/g, '').replace(/^0+/, '') };
  };

  const [countryCode, setCountryCode] = useState('+32');
  const [localNumber, setLocalNumber] = useState('');

  // Initialize from value
  useEffect(() => {
    const { countryCode: cc, localNumber: ln } = parsePhone(value);
    setCountryCode(cc);
    setLocalNumber(ln);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update parent when either part changes
  const handleCountryChange = (newCode: string) => {
    setCountryCode(newCode);
    setIsOpen(false);
    // Re-strip leading zero when switching countries (user may have entered with zero for previous country)
    const stripped = localNumber.replace(/^0+/, '');
    setLocalNumber(stripped);
    if (stripped) {
      onChange(`${newCode}${stripped}`);
    }
  };

  const handleLocalChange = (newLocal: string) => {
    // Only allow digits, remove any non-numeric characters
    let digitsOnly = newLocal.replace(/\D/g, '');
    // Strip leading zero — in E.164 format the zero after the country code is dropped
    if (digitsOnly.startsWith('0')) {
      digitsOnly = digitsOnly.replace(/^0+/, '');
    }
    setLocalNumber(digitsOnly);
    if (digitsOnly) {
      onChange(`${countryCode}${digitsOnly}`);
    } else {
      onChange('');
    }
  };

  // Validate length for known countries
  const lengthRule = LOCAL_DIGIT_LENGTHS[countryCode];
  const digitCount = localNumber.length;
  let validationMsg = '';
  if (lengthRule && localNumber) {
    if (digitCount < lengthRule.min) {
      validationMsg = `${lengthRule.label} numbers need at least ${lengthRule.min} digits (currently ${digitCount})`;
    } else if (digitCount > lengthRule.max) {
      validationMsg = `${lengthRule.label} numbers have at most ${lengthRule.max} digits (currently ${digitCount})`;
    }
  }

  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

  return (
    <div className="phone-input">
      <div className="phone-country-dropdown" ref={dropdownRef}>
        <button
          type="button"
          className="phone-country-button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
        >
          <span className="phone-country-flag">{getFlagEmoji(selectedCountry.iso)}</span>
          <span className="phone-country-code">{selectedCountry.code}</span>
          <span className="phone-country-arrow">▼</span>
        </button>
        {isOpen && (
          <div className="phone-country-list">
            {COUNTRY_CODES.map(({ code, country, iso }) => (
              <button
                key={`${iso}-${code}`}
                type="button"
                className={`phone-country-option ${code === countryCode ? 'selected' : ''}`}
                onClick={() => handleCountryChange(code)}
              >
                <span className="phone-country-flag">{getFlagEmoji(iso)}</span>
                <span className="phone-country-code">{code}</span>
                <span className="phone-country-name">{country}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="phone-local-wrapper">
        <input
          id={id}
          type="tel"
          value={localNumber}
          onChange={(e) => handleLocalChange(e.target.value)}
          required={required}
          disabled={disabled}
          placeholder={LOCAL_DIGIT_LENGTHS[countryCode]?.placeholder ?? 'Phone number'}
          className={`phone-local-input${validationMsg ? ' phone-input-invalid' : ''}`}
          pattern="[0-9]*"
          inputMode="numeric"
        />
        {validationMsg && (
          <div className="phone-validation-msg">{validationMsg}</div>
        )}
      </div>
    </div>
  );
}

// WhatsApp icon SVG component
function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="#25D366"
      style={{ verticalAlign: 'middle' }}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// Helper component to display clickable phone links with WhatsApp
interface PhoneLinkProps {
  phone: string | undefined | null;
  className?: string;
}

export function PhoneLink({ phone, className }: PhoneLinkProps) {
  if (!phone) {
    return <span className={className}>-</span>;
  }

  // Format for display (add spaces for readability)
  const formatDisplay = (p: string): string => {
    // Sort by code length descending to match longer codes first
    const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);

    for (const { code } of sortedCodes) {
      if (p.startsWith(code)) {
        const local = p.slice(code.length);
        // Format local number in groups of 2-3
        const formatted = local.replace(/(\d{3})(\d{2})(\d{2})(\d{2})?/, '$1 $2 $3 $4').trim();
        return `${code} ${formatted}`;
      }
    }
    return p;
  };

  // WhatsApp URL uses number without + sign
  const whatsappNumber = phone.replace('+', '');
  const whatsappUrl = `https://wa.me/${whatsappNumber}`;

  return (
    <span className="phone-links">
      <a href={`tel:${phone}`} className={className}>
        {formatDisplay(phone)}
      </a>
      <a
        href={whatsappUrl}
        className="whatsapp-link"
        target="_blank"
        rel="noopener noreferrer"
        title="Chat on WhatsApp"
      >
        <WhatsAppIcon />
      </a>
    </span>
  );
}
