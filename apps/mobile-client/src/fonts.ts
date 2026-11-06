import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/outfit";
import { FONT_FAMILIES } from "./font-families.cjs";

/** Loads every weight of the brand typeface under the family names the Tailwind `font-*` classes use. */
export function useBrandFonts() {
  const [loaded, error] = useFonts({
    [FONT_FAMILIES.normal]: Outfit_400Regular,
    [FONT_FAMILIES.medium]: Outfit_500Medium,
    [FONT_FAMILIES.semibold]: Outfit_600SemiBold,
    [FONT_FAMILIES.bold]: Outfit_700Bold,
    [FONT_FAMILIES.extrabold]: Outfit_800ExtraBold,
  });
  // A font failure falls back to the system face rather than blocking the app.
  return loaded || !!error;
}
