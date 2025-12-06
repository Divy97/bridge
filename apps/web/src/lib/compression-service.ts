import imageCompression from "browser-image-compression";
import { PDFDocument } from "pdf-lib";

// Helper function to format file size (avoid circular dependency)
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

const MAX_SIZE_KB = 500; // 500KB limit
const MAX_IMAGE_DIMENSION = 1920; // Max width/height for images

export interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export interface CompressionEstimate {
  originalSize: number;
  estimatedSize: number;
  canCompress: boolean;
}

/**
 * Check if a file type supports compression
 */
export function shouldOfferCompression(file: File): boolean {
  const imageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const pdfType = "application/pdf";
  
  return imageTypes.includes(file.type) || file.type === pdfType;
}

/**
 * Estimate compressed file size (more accurate estimate)
 * Uses a quick test compression for better accuracy
 */
export async function getCompressionEstimate(file: File, quality: number = 0.8): Promise<CompressionEstimate> {
  if (!shouldOfferCompression(file)) {
    return {
      originalSize: file.size,
      estimatedSize: file.size,
      canCompress: false,
    };
  }

  const originalSize = file.size;

  if (file.type.startsWith("image/")) {
    // For images, do a quick test compression for accurate estimate
    try {
      const testOptions = {
        maxSizeMB: 0.5, // Target 500KB
        maxWidthOrHeight: MAX_IMAGE_DIMENSION,
        useWebWorker: false, // Faster for estimation
        fileType: file.type,
        initialQuality: quality,
        alwaysKeepResolution: false,
      };

      // Quick test compression (smaller sample for speed)
      const testFile = await imageCompression(file, {
        ...testOptions,
        maxSizeMB: 1, // Allow larger for estimation
      });

      const estimatedSize = testFile.size;
      
      return {
        originalSize,
        estimatedSize: Math.max(estimatedSize, 0),
        canCompress: estimatedSize < originalSize && estimatedSize > 0,
      };
    } catch (error) {
      // Fallback to conservative estimate if test compression fails
      console.warn("Test compression failed, using fallback estimate:", error);
      return getFallbackEstimate(file, originalSize);
    }
  } else if (file.type === "application/pdf") {
    // PDF compression is limited, use conservative estimate
    // PDF compression typically achieves 5-15% reduction
    const estimatedSize = originalSize * 0.9; // 10% reduction estimate (conservative)
    
    return {
      originalSize,
      estimatedSize: Math.max(estimatedSize, 0),
      canCompress: estimatedSize < originalSize,
    };
  }

  return {
    originalSize,
    estimatedSize: originalSize,
    canCompress: false,
  };
}

/**
 * Fallback estimation when test compression fails
 */
function getFallbackEstimate(file: File, originalSize: number): CompressionEstimate {
  let estimatedSize = originalSize;

  if (file.type.startsWith("image/")) {
    // More realistic estimates based on typical compression results
    // Modern image compression can achieve 70-85% reduction for unoptimized images
    if (originalSize > 2000 * 1024) {
      // Very large images (>2MB) - can compress significantly
      estimatedSize = originalSize * 0.2; // 80% reduction
    } else if (originalSize > 1000 * 1024) {
      // Large images (1-2MB) - good compression
      estimatedSize = originalSize * 0.25; // 75% reduction
    } else if (originalSize > 500 * 1024) {
      // Medium-large images (500KB-1MB) - moderate compression
      estimatedSize = originalSize * 0.35; // 65% reduction
    } else {
      // Smaller images - less compression potential
      estimatedSize = originalSize * 0.5; // 50% reduction
    }
  }

  return {
    originalSize,
    estimatedSize: Math.max(estimatedSize, 0),
    canCompress: estimatedSize < originalSize,
  };
}

/**
 * Compress an image file
 */
export async function compressImage(
  file: File,
  maxSizeKB: number = MAX_SIZE_KB,
  quality: number = 0.8,
  onProgress?: (progress: number) => void
): Promise<CompressionResult> {
  const originalSize = file.size;

  const options = {
    maxSizeMB: maxSizeKB / 1024,
    maxWidthOrHeight: MAX_IMAGE_DIMENSION,
    useWebWorker: true,
    fileType: file.type,
    initialQuality: quality,
    alwaysKeepResolution: false,
    onProgress: onProgress,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    const compressedSize = compressedFile.size;
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

    return {
      compressedFile,
      originalSize,
      compressedSize,
      compressionRatio,
    };
  } catch (error) {
    console.error("Image compression error:", error);
    throw new Error("Failed to compress image. Please try a different file or reduce quality.");
  }
}

/**
 * Attempt to compress a PDF file
 * Note: Client-side PDF compression is limited
 */
export async function compressPDF(
  file: File,
  maxSizeKB: number = MAX_SIZE_KB,
  onProgress?: (progress: number) => void
): Promise<CompressionResult> {
  const originalSize = file.size;

  try {
    // Simulate progress
    if (onProgress) onProgress(10);

    // Read PDF
    const arrayBuffer = await file.arrayBuffer();
    if (onProgress) onProgress(30);

    // Load PDF document
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    if (onProgress) onProgress(50);

    // Attempt to optimize by removing unnecessary objects
    // Note: pdf-lib doesn't have built-in compression, so we can only remove unused objects
    const pages = pdfDoc.getPages();
    
    // Try to reduce quality of embedded images if any
    // This is limited - pdf-lib doesn't support image compression directly
    
    if (onProgress) onProgress(70);

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    if (onProgress) onProgress(90);

    // Create new file - convert Uint8Array to proper ArrayBuffer for File constructor
    // pdfBytes is Uint8Array, we need to ensure it's a proper ArrayBuffer
    const pdfBuffer = pdfBytes.buffer instanceof ArrayBuffer
      ? pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength)
      : new Uint8Array(pdfBytes).buffer;
    
    const compressedFile = new File([pdfBuffer], file.name, {
      type: file.type,
      lastModified: Date.now(),
    });

    if (onProgress) onProgress(100);

    const compressedSize = compressedFile.size;
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

    // If compression didn't help or made it worse, return original
    if (compressedSize >= originalSize) {
      return {
        compressedFile: file,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 0,
      };
    }

    return {
      compressedFile,
      originalSize,
      compressedSize,
      compressionRatio,
    };
  } catch (error) {
    console.error("PDF compression error:", error);
    throw new Error("Failed to compress PDF. PDF compression has limited effectiveness. Please try a different file.");
  }
}

/**
 * Compress a file based on its type
 */
export async function compressFile(
  file: File,
  maxSizeKB: number = MAX_SIZE_KB,
  quality?: number,
  onProgress?: (progress: number) => void
): Promise<CompressionResult> {
  if (file.type.startsWith("image/")) {
    return compressImage(file, maxSizeKB, quality, onProgress);
  } else if (file.type === "application/pdf") {
    return compressPDF(file, maxSizeKB, onProgress);
  } else {
    throw new Error(`Compression not supported for file type: ${file.type}`);
  }
}
