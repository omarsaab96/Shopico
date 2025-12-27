import AsyncStorage from "@react-native-async-storage/async-storage";

export type SavedAddress = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

const STORAGE_KEY = "saved-addresses";

export const loadAddresses = async (): Promise<SavedAddress[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedAddress[]) : [];
  } catch {
    return [];
  }
};

export const saveAddresses = async (addresses: SavedAddress[]) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
  } catch {
    // ignore
  }
};
