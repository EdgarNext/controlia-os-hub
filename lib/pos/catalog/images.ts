export const CATALOG_IMAGES_BUCKET = "catalog-images";

const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function getExtension(file: File): string {
  const fromType = MIME_EXTENSION[file.type];
  if (fromType) {
    return fromType;
  }

  const name = typeof file.name === "string" ? file.name : "";
  const match = name.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : "bin";
}

export function getCatalogImagePath(input: {
  tenantId: string;
  kind: "items" | "categories";
  id: string;
  file: File;
}): string {
  const ext = getExtension(input.file);
  return `${input.tenantId}/${input.kind}/${input.id}.${ext}`;
}

export function getPublicCatalogImageUrl(path: string | null | undefined): string {
  if (!path) {
    return "";
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) {
    return "";
  }

  return `${baseUrl}/storage/v1/object/public/${CATALOG_IMAGES_BUCKET}/${path}`;
}
