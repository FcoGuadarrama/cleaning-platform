import { ref, type Ref } from "vue";
import { errorMessage } from "./api";

export function useResource<T>(load: () => Promise<{ data?: T; error?: unknown }>) {
  const data = ref<T | null>(null) as Ref<T | null>;
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    loading.value = true;
    error.value = null;
    const result = await load();
    if (result.error !== undefined) error.value = errorMessage(result.error);
    else data.value = result.data ?? null;
    loading.value = false;
  }

  return { data, loading, error, refresh };
}
