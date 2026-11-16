import { isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

export type { CountryCode } from "libphonenumber-js/max";
export { getCountries, getCountryCallingCode } from "libphonenumber-js/max";

export function normalizePhone(value: string, country: string) {
  if (!isSupportedCountry(country) || !value.trim()) return null;
  const parsed = parsePhoneNumberFromString(value, { defaultCountry: country as CountryCode, extract: false });
  if (!parsed || !parsed.isValid() || parsed.country !== country || parsed.ext) return null;
  return { phone: String(parsed.nationalNumber), phoneCountryCode: `+${parsed.countryCallingCode}`, phoneCountry: country };
}

export function profilePhone(user: { phone?: string; phoneCountry?: string; phoneCountryCode?: string } | undefined) {
  const phone = user?.phone || "";
  if (user?.phoneCountry && isSupportedCountry(user.phoneCountry)) return { country: user.phoneCountry as CountryCode, phone };
  const parsed = parsePhoneNumberFromString(phone.startsWith("+") ? phone : `${user?.phoneCountryCode || "+963"}${phone.replace(/^0/, "")}`);
  return { country: parsed?.country || "SY" as CountryCode, phone: parsed?.isValid() ? String(parsed.nationalNumber) : phone };
}

export function formatProfilePhone(user: { phone?: string; phoneCountryCode?: string } | undefined) {
  return user?.phone ? `${user.phoneCountryCode || ""}${user.phoneCountryCode ? " " : ""}${user.phone}` : "";
}
