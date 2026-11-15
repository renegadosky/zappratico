import { supabase } from "@/integrations/supabase/client";

/** Envia uma imagem para o bucket público e devolve a URL. */
export async function uploadStoreImage(file: File, userId: string, kind: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
