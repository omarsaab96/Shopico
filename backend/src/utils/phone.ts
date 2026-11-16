import { isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

export function normalizePhone(value: string, country: string) {
  if (!isSupportedCountry(country) || !value.trim()) return null;
  const parsed = parsePhoneNumberFromString(value, { defaultCountry: country as CountryCode, extract: false });
  if (!parsed || !parsed.isValid() || parsed.country !== country || parsed.ext) return null;
  return { phone: String(parsed.nationalNumber), phoneCountryCode: `+${parsed.countryCallingCode}`, phoneCountry: country };
}
