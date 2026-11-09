import type { Schemas } from "@repo/api-client";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { api } from "./api";
import { useResource } from "./useResource";

export type Address = Schemas["AddressOut"];

/** "Colima 214, int. 3, Roma Norte": enough to recognise the place in a list row. */
export function shortAddress(a: Address) {
  const street = a.interior ? `${a.street}, int. ${a.interior}` : a.street;
  return `${street}, ${a.neighbourhood}`;
}

/** Saved addresses, default first. Reloads when the screen regains focus (after the form closes). */
export function useAddresses() {
  const resource = useResource(() => api.GET("/addresses"));
  const firstFocus = useRef(true);
  const { refresh } = resource;
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else void refresh();
    }, [refresh]),
  );
  return resource;
}
