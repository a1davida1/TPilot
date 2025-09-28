/**
 * Image caption generation and processing utilities
 */

// Mock image caption generator for testing
export async function generateImageCaption(imageData, options = {}) {
  // Mock implementation
  return {
    caption: "A beautiful image showcasing great composition and lighting",
    confidence: 0.92,
    keywords: ["beautiful", "composition", "lighting"],
    suggestions: ["Consider adding filters", "Great for social media"]
  };
}

export function imageToBase64(imagePath) {
  // Mock implementation for testing
  return "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD//mock_base64_data";
}

export function validateImageFormat(file) {
  // Mock validation
  const validFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const extension = file.name ? file.name.split('.').pop().toLowerCase() : 'jpg';
  
  return {
    isValid: validFormats.includes(extension),
    format: extension,
    message: validFormats.includes(extension) ? 'Valid format' : 'Unsupported format'
  };
}