const SOURCE_COUNTRY_MAP: Record<string, string> = {
  'bbc.co.uk': 'GB',
  'bbc.com': 'GB',
  'nytimes.com': 'US',
  'reuters.com': 'US',
  'aljazeera.com': 'QA',
  'theguardian.com': 'GB',
  'cnn.com': 'US',
  'washingtonpost.com': 'US',
  'forbes.com': 'US',
  'techcrunch.com': 'US',
  'wired.com': 'US',
  'bloomberg.com': 'US',
  'wsj.com': 'US',
  'ft.com': 'GB',
  'economist.com': 'GB',
  'lemonde.fr': 'FR',
  'der Spiegel': 'DE',
  'spiegel.de': 'DE',
  'zeit.de': 'DE',
  'hackernews.com': 'US',
  'reddit.com': 'US',
};

const DOMAIN_TLD_MAP: Record<string, string> = {
  uk: 'GB',
  gb: 'GB',
  cn: 'CN',
  jp: 'JP',
  in: 'IN',
  ru: 'RU',
  de: 'DE',
  fr: 'FR',
  ca: 'CA',
  au: 'AU',
  br: 'BR',
  kr: 'KR',
  sg: 'SG',
  hk: 'HK',
  tw: 'TW',
  il: 'IL',
  ae: 'AE',
  sa: 'SA',
  nl: 'NL',
  se: 'SE',
  no: 'NO',
  dk: 'DK',
  fi: 'FI',
  ch: 'CH',
  at: 'AT',
  be: 'BE',
  ie: 'IE',
  pl: 'PL',
  it: 'IT',
  es: 'ES',
  pt: 'PT',
  gr: 'GR',
  cz: 'CZ',
  hu: 'HU',
  ro: 'RO',
  ua: 'UA',
  tr: 'TR',
  id: 'ID',
  my: 'MY',
  th: 'TH',
  ph: 'PH',
  vn: 'VN',
  nz: 'NZ',
  za: 'ZA',
  eg: 'EG',
  ng: 'NG',
  ke: 'KE',
};

export function getCountryFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    for (const [source, country] of Object.entries(SOURCE_COUNTRY_MAP)) {
      if (hostname.includes(source)) {
        return country;
      }
    }

    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const tld = parts[parts.length - 1];
      const countryCode = DOMAIN_TLD_MAP[tld];
      if (countryCode) {
        return countryCode;
      }
    }

    return 'US';
  } catch {
    return 'US';
  }
}