import { reactive, ref, type Ref } from "vue";
import { errorMessage } from "./api";

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  loaded: boolean;
  /** `background`: a failed poll keeps the data already on screen instead of showing the error state. */
  refresh: (options?: { background?: boolean }) => Promise<void>;
}

export function useResource<T>(load: () => Promise<{ data?: T; error?: unknown }>): Resource<T> {
  const data = ref<T | null>(null) as Ref<T | null>;
  const loading = ref(false);
  const loaded = ref(false);
  const error = ref<string | null>(null);

  async function refresh({ background = false } = {}): Promise<void> {
    loading.value = !loaded.value;
    if (!background) error.value = null;
    const result = await load();
    if (result.error === undefined) {
      data.value = result.data ?? null;
      loaded.value = true;
      error.value = null;
    } else if (!(background && loaded.value)) {
      error.value = errorMessage(result.error);
    }
    loading.value = false;
  }

  return reactive({ data, loading, error, loaded, refresh }) as Resource<T>;
}
