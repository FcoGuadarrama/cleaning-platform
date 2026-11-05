import { reactive, ref, type Ref } from "vue";
import { errorMessage } from "./api";

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  loaded: boolean;
  refresh: () => Promise<void>;
}

export function useResource<T>(load: () => Promise<{ data?: T; error?: unknown }>): Resource<T> {
  const data = ref<T | null>(null) as Ref<T | null>;
  const loading = ref(false);
  const loaded = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    loading.value = !loaded.value;
    error.value = null;
    const result = await load();
    if (result.error !== undefined) error.value = errorMessage(result.error);
    else {
      data.value = result.data ?? null;
      loaded.value = true;
    }
    loading.value = false;
  }

  return reactive({ data, loading, error, loaded, refresh }) as Resource<T>;
}
