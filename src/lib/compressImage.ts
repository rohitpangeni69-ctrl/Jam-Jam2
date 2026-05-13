/**
 * Highly aggressive client-side image compression for low-bandwidth environments (Nepal 3G/Edge).
 * Compresses images to WebP (or JPEG if unsupported) targeting < 400KB.
 */
export async function compressImage(file: File, targetSizeKb: number = 400): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first, fallback to JPEG
        let quality = 0.8;
         
        const tryCompression = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Compression failed'));
                return;
              }
              
              if (blob.size / 1024 > targetSizeKb && quality > 0.4) {
                // If still too large, reduce quality and try again
                quality -= 0.15;
                tryCompression();
              } else {
                // Done
                const format = blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
                const extension = format === 'image/webp' ? 'webp' : 'jpg';
                const newFile = new File([blob], `${file.name.split('.')[0]}_compressed.${extension}`, {
                  type: format,
                  lastModified: Date.now(),
                });
                resolve(newFile);
              }
            },
            // Try WEBP for size savings, fallback natively if not supported
            'image/webp',
            quality
          );
        };
        
        tryCompression();
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}
