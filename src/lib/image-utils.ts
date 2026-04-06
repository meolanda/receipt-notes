/**
 * Compress an image (base64 data URL) using canvas.
 * Returns a compressed JPEG data URL.
 */
export async function compressImage(
  dataUrl: string,
  maxWidth = 1200,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down if wider than maxWidth
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL("image/jpeg", quality);
      resolve(compressed);
    };
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = dataUrl;
  });
}

/**
 * Get approximate localStorage usage in bytes and percentage.
 */
export function getStorageUsage(): { usedBytes: number; percentage: number; usedMB: string } {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      total += (localStorage.getItem(key) || "").length * 2; // UTF-16
    }
  }
  const maxBytes = 5 * 1024 * 1024; // ~5MB typical limit
  return {
    usedBytes: total,
    percentage: Math.round((total / maxBytes) * 100),
    usedMB: (total / (1024 * 1024)).toFixed(1),
  };
}
