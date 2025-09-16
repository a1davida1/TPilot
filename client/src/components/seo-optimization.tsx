import { useEffect } from "react";

interface SEOOptimizationProps {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  url?: string;
}

export function SEOOptimization({ 
  title = "ThottoPilot - AI-Powered Content Creation Platform",
  description = "Create engaging Reddit posts with AI, protect your images from reverse searches, and optimize your content strategy for maximum engagement. Join thousands of successful creators.",
  keywords = ["content creation", "AI content generator", "Reddit posts", "image protection", "social media tools", "creator platform"],
  image = "/og-image.jpg",
  url = typeof window !== 'undefined' ? window.location.href : "https://thottopilot.com"
}: SEOOptimizationProps) {
  
  useEffect(() => {
    // Update document title
    document.title = title;
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', description);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = description;
      document.head.appendChild(meta);
    }
    
    // Update meta keywords
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      metaKeywords.setAttribute('content', keywords.join(', '));
    } else {
      const meta = document.createElement('meta');
      meta.name = 'keywords';
      meta.content = keywords.join(', ');
      document.head.appendChild(meta);
    }
    
    // Update Open Graph tags
    updateOrCreateMetaTag('property', 'og:title', title);
    updateOrCreateMetaTag('property', 'og:description', description);
    updateOrCreateMetaTag('property', 'og:image', image);
    updateOrCreateMetaTag('property', 'og:url', url);
    updateOrCreateMetaTag('property', 'og:type', 'website');
    updateOrCreateMetaTag('property', 'og:site_name', 'ThottoPilot');
    
    // Update Twitter Card tags
    updateOrCreateMetaTag('name', 'twitter:card', 'summary_large_image');
    updateOrCreateMetaTag('name', 'twitter:title', title);
    updateOrCreateMetaTag('name', 'twitter:description', description);
    updateOrCreateMetaTag('name', 'twitter:image', image);
    
    // Update canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (canonical) {
      canonical.href = url;
    } else {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.href = url;
      document.head.appendChild(canonical);
    }

    // Add JSON-LD structured data
    const prevLd = document.querySelector('script[data-seo="ldjson"]');
    if (prevLd) prevLd.remove();
    
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "ThottoPilot",
      "description": "AI-powered content creation platform for social media creators",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "1250"
      },
      "author": {
        "@type": "Organization",
        "name": "ThottoPilot"
      }
    };
    
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo', 'ldjson');
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);

    // Cleanup function
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [title, description, keywords, image, url]);
  
  function updateOrCreateMetaTag(attribute: string, value: string, content: string) {
    let meta = document.querySelector(`meta[${attribute}="${value}"]`) as HTMLMetaElement;
    if (meta) {
      meta.content = content;
    } else {
      meta = document.createElement('meta');
      meta.setAttribute(attribute, value);
      meta.content = content;
      document.head.appendChild(meta);
    }
  }
  
  return null; // This component doesn't render anything visible
}

// SEO-optimized page configurations
export const seoConfigs = {
  landing: {
    title: "ThottoPilot - AI Content Creation Platform for Creators",
    description: "Generate viral Reddit posts with AI, protect your images from reverse searches, and optimize content strategy. Join successful creators and start your free trial today.",
    keywords: ["AI content generator", "Reddit post creator", "social media automation", "content creation tools", "creator platform", "viral content"]
  },
  dashboard: {
    title: "Dashboard - ThottoPilot",
    description: "Create engaging content with AI-powered tools. Generate Reddit posts, protect images, and track performance with advanced analytics.",
    keywords: ["content dashboard", "AI generator", "social media management", "creator tools"]
  },
  aiGenerator: {
    title: "AI Content Generator - ThottoPilot",
    description: "Generate engaging Reddit posts with advanced AI. Create personalized titles, content, and photo instructions tailored to your brand and audience.",
    keywords: ["AI content generator", "Reddit post generator", "automated content creation", "AI writing assistant"]
  },
  imageProtection: {
    title: "Image Protection Tools - ThottoPilot",
    description: "Protect your photos from reverse image searches while maintaining visual quality. Advanced anti-reverse search technology for content creators.",
    keywords: ["image protection", "reverse image search protection", "photo privacy", "content security"]
  },
  pricing: {
    title: "Pricing Plans - ThottoPilot",
    description: "Choose the perfect plan for your content creation needs. Free trial available. Premium features for serious creators starting at $9/month.",
    keywords: ["pricing", "subscription plans", "content creation pricing", "creator tools cost"]
  }
};

