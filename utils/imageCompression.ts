/**
 * Compress image to a maximum file size (in bytes)
 * Uses Canvas API for client-side compression
 * @param file - The image file to compress
 * @param maxSizeKB - Maximum file size in KB (default: 80KB)
 * @param maxWidth - Maximum width in pixels (default: 800)
 * @param maxHeight - Maximum height in pixels (default: 800)
 * @returns Compressed image as Blob
 */
export async function compressImage(
  file: File,
  maxSizeKB: number = 80,
  maxWidth: number = 800,
  maxHeight: number = 800
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const img = new Image();
      
      img.onload = async () => {
        try {
          // Calculate new dimensions while maintaining aspect ratio
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth || height > maxHeight) {
            const aspectRatio = width / height;
            
            if (width > height) {
              width = maxWidth;
              height = width / aspectRatio;
            } else {
              height = maxHeight;
              width = height * aspectRatio;
            }
          }
          
          // Create canvas and draw resized image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // Draw image with better quality settings
          ctx.drawImage(img, 0, 0, width, height);
          
          // Try different quality levels to get under maxSizeKB
          const maxSizeBytes = maxSizeKB * 1024;
          
          // Binary search for optimal quality (faster and more accurate)
          const compressWithQuality = (q: number): Promise<Blob> => {
            return new Promise((resolveCompress, rejectCompress) => {
              canvas.toBlob(
                (blob) => {
                  if (!blob) {
                    rejectCompress(new Error('Failed to compress image'));
                    return;
                  }
                  resolveCompress(blob);
                },
                'image/jpeg', // Use JPEG for better compression
                q
              );
            });
          };
          
          // Binary search for optimal quality
          let minQuality = 0.1;
          let maxQuality = 0.9;
          let bestBlob: Blob | null = null;
          let attempts = 0;
          const maxAttempts = 10; // Prevent infinite loops
          
          while (attempts < maxAttempts && (maxQuality - minQuality) > 0.05) {
            const currentQuality = (minQuality + maxQuality) / 2;
            
            const blob = await compressWithQuality(currentQuality);
            
            if (blob.size <= maxSizeBytes) {
              bestBlob = blob;
              minQuality = currentQuality; // Try higher quality
            } else {
              maxQuality = currentQuality; // Try lower quality
            }
            
            attempts++;
          }
          
          // If we found a good blob, use it
          if (bestBlob) {
            resolve(bestBlob);
          } else {
            // Fallback: try with minimum quality
            let fallbackBlob = await compressWithQuality(0.1);
            
            // If still too large, reduce dimensions further and try again
            if (fallbackBlob.size > maxSizeBytes) {
              // Reduce dimensions progressively until we get under the limit
              let currentWidth = width;
              let currentHeight = height;
              let attempts = 0;
              const maxReductionAttempts = 5;
              
              while (fallbackBlob.size > maxSizeBytes && attempts < maxReductionAttempts) {
                // Reduce by 15% each iteration
                currentWidth = Math.floor(currentWidth * 0.85);
                currentHeight = Math.floor(currentHeight * 0.85);
                
                canvas.width = currentWidth;
                canvas.height = currentHeight;
                
                const ctx2 = canvas.getContext('2d');
                if (ctx2) {
                  ctx2.drawImage(img, 0, 0, currentWidth, currentHeight);
                  fallbackBlob = await compressWithQuality(0.1);
                  attempts++;
                } else {
                  break;
                }
              }
            }
            
            resolve(fallbackBlob);
          }
        } catch (err: any) {
          reject(err);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Convert Blob to File
 */
export function blobToFile(blob: Blob, fileName: string, mimeType: string): File {
  return new File([blob], fileName, { type: mimeType });
}

/**
 * Get file size in KB
 */
export function getFileSizeKB(file: File | Blob): number {
  return Math.round((file.size / 1024) * 100) / 100;
}

