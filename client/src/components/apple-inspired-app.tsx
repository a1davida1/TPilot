import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  Brain, 
  Shield, 
  ImageIcon,
  TrendingUp,
  Zap,
  Star,
  ArrowRight,
  Check,
  Menu,
  X,
  Camera,
  Hash,
  Gift,
  Users,
  ChevronRight,
  ChevronLeft,
  Plus,
  Upload,
  Wand2,
  Copy,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle,
  Lock,
  Unlock,
  FileText,
  BarChart3,
  History,
  Settings,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface GeneratedContent {
  titles: string[];
  content: string;
  photoInstructions?: {
    lighting: string;
    angles: string[];
    composition: string;
    styling: string;
    technical: string;
  };
}

export function AppleInspiredApp() {
  const [activeSection, setActiveSection] = useState("generate");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  
  // Content generation states
  const [platform, setPlatform] = useState("reddit");
  const [style, setStyle] = useState("playful");
  const [theme, setTheme] = useState("casual");
  const [customPrompt, setCustomPrompt] = useState("");
  
  // Image Shield states
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [protectedImage, setProtectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [protectionLevel, setProtectionLevel] = useState<"smart" | "balanced" | "maximum">("balanced");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const headerOpacity = Math.min(scrollY / 100, 0.98);

  const navigationItems = [
    { id: "generate", label: "Content Creator", icon: <Brain className="h-4 w-4" />, badge: "NEW" },
    { id: "dual", label: "Dual Workflow", icon: <Zap className="h-4 w-4" />, badge: "HOT" },
    { id: "protect", label: "Image Shield", icon: <Shield className="h-4 w-4" />, badge: "FREE" },
    { id: "finetune", label: "Personalization", icon: <Sparkles className="h-4 w-4" />, badge: "PRO" },
    { id: "perks", label: "ProPerks", icon: <Gift className="h-4 w-4" />, badge: "15+" },
    { id: "gallery", label: "Image Gallery", icon: <ImageIcon className="h-4 w-4" /> },
    { id: "communities", label: "Reddit Communities", icon: <Users className="h-4 w-4" />, badge: "50+" },
    { id: "trending", label: "Trending Tags", icon: <Hash className="h-4 w-4" /> },
    { id: "insights", label: "Audience Insights", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "analytics", label: "Analytics", icon: <TrendingUp className="h-4 w-4" /> },
    { id: "history", label: "History", icon: <History className="h-4 w-4" /> },
    { id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> }
  ];

  const generateContentMutation = useMutation({
    mutationFn: async (data: unknown) => {
      const response = await apiRequest("POST", "/api/generate-ai", {
        ...(data as Record<string, any>),
        generationType: "prompt",
        userProfile: {
          toneOfVoice: "confident",
          contentStyle: "authentic", 
          personalBrand: "girl-next-door",
          contentLength: "medium",
          includeEmojis: true,
          promotionLevel: "moderate"
        }
      });
      return await response.json();
    },
    onSuccess: (data) => {
      const displayData: GeneratedContent = {
        titles: Array.isArray(data.titles) ? data.titles : 
                typeof data.titles === 'string' ? [data.titles] :
                data.titles ? Object.values(data.titles).filter(Boolean) : [],
        content: data.content || "",
        photoInstructions: data.photoInstructions
      };
      
      setGeneratedContent(displayData);
      
      toast({
        title: "✨ Content Created",
        description: "Your content is ready",
        className: "bg-white/95 backdrop-blur-xl border-gray-200"
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleGenerate = () => {
    generateContentMutation.mutate({
      platform,
      customPrompt: `${style} ${theme} content. ${customPrompt}`.trim(),
      photoType: theme,
      textTone: style,
      includePromotion: true,
      includeHashtags: true,
      selectedHashtags: []
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Content copied to clipboard",
      className: "bg-white/95 backdrop-blur-xl border-gray-200"
    });
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image under 20MB",
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setOriginalImage(e.target?.result as string);
        setProtectedImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const applyImageProtection = async () => {
    if (!originalImage || !canvasRef.current) return;

    setIsProcessing(true);
    
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Apply protection based on level
        const settings = {
          smart: { blur: 1.5, noise: 12, color: 3 },
          balanced: { blur: 2.5, noise: 18, color: 6 },
          maximum: { blur: 4, noise: 28, color: 10 }
        };
        
        const { blur, noise, color } = settings[protectionLevel];

        // Apply noise
        for (let i = 0; i < data.length; i += 4) {
          const noiseValue = (Math.random() - 0.5) * noise;
          data[i] = Math.max(0, Math.min(255, data[i] + noiseValue));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noiseValue));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noiseValue));
        }

        // Apply color shift
        for (let i = 0; i < data.length; i += 4) {
          const shift = (Math.random() - 0.5) * color;
          data[i] = Math.max(0, Math.min(255, data[i] + shift));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] - shift));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + shift));
        }

        ctx.putImageData(imageData, 0, 0);

        // Apply blur
        if (blur > 0) {
          ctx.filter = `blur(${blur}px)`;
          ctx.drawImage(canvas, 0, 0);
          ctx.filter = 'none';
        }

        const protectedDataUrl = canvas.toDataURL('image/jpeg', 0.94);
        setProtectedImage(protectedDataUrl);

        toast({
          title: "🛡️ Protected",
          description: "Your image is now protected",
          className: "bg-white/95 backdrop-blur-xl border-gray-200"
        });

        setIsProcessing(false);
      };

      img.src = originalImage;
    } catch (_error) {
      toast({
        title: "Protection Failed",
        description: "Unable to process image",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };

  const downloadProtected = () => {
    if (!protectedImage) return;

    const link = document.createElement('a');
    link.download = 'protected-image.jpg';
    link.href = protectedImage;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Downloaded",
      description: "Protected image saved",
      className: "bg-white/95 backdrop-blur-xl border-gray-200"
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex">
      {/* Apple-style Sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 h-full w-72 bg-white/95 backdrop-blur-xl border-r border-gray-200/50 z-40 overflow-y-auto transition-transform duration-500 ease-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-72"
        )}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b border-gray-200/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img
                src="/thottopilot-logo.png"
                alt="ThottoPilot"
                className="h-10 w-10 object-contain"
              />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">ThottoPilot</h1>
                <p className="text-xs text-gray-500">Content Suite</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors md:hidden"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4">
          <div className="space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]",
                  activeSection === item.id
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                <span className="flex items-center space-x-3">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {item.badge && (
                  <span className={cn(
                    "px-2 py-0.5 text-xs rounded-full font-semibold",
                    activeSection === item.id
                      ? "bg-white/20 text-white"
                      : item.badge === "FREE" ? "bg-green-100 text-green-700"
                      : item.badge === "PRO" ? "bg-purple-100 text-purple-700"
                      : item.badge === "HOT" ? "bg-red-100 text-red-700"
                      : item.badge === "NEW" ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-700"
                  )}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Pro Upgrade Card */}
        <div className="p-4 mt-4">
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-4 text-white">
            <h3 className="font-semibold mb-2">Upgrade to Pro</h3>
            <p className="text-xs opacity-90 mb-3">Unlock all features and premium content</p>
            <button className="w-full bg-white text-purple-600 rounded-lg py-2 text-sm font-semibold hover:bg-gray-100 transition-colors">
              Get Pro Access
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 transition-all duration-300",
        sidebarOpen ? "ml-72" : "ml-0"
      )}>
        {/* Fixed Header with Glass Effect */}
        <header 
          className={cn(
            "fixed top-0 left-0 right-0 z-30 transition-all duration-300",
            scrollY > 10 && "backdrop-blur-xl border-b border-gray-200/50"
          )}
          style={{
            backgroundColor: `rgba(255, 255, 255, ${headerOpacity})`,
            left: sidebarOpen ? "288px" : "0"
          }}
        >
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Menu Toggle */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Page Title */}
              <div className="flex-1 text-center">
                <h2 className="text-lg font-semibold text-gray-900">
                  {navigationItems.find(item => item.id === activeSection)?.label || "Content Creator"}
                </h2>
              </div>

              {/* Auth Buttons */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => { window.location.href = '/login'; }}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-all hover:scale-105 active:scale-95"
                >
                  Login
                </button>
                <button
                  onClick={() => { window.location.href = '/login'; }}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
                >
                  Sign Up Free
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main id="main-content" className="pt-20">
          <AnimatePresence mode="wait">
            {activeSection === "generate" && (
              <div className="max-w-6xl mx-auto px-6 py-12">
                {/* Hero Section */}
                <div className="text-center mb-12">
                  <h2 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
                    Create Engaging Content
                  </h2>
                  <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                    Generate personalized content with professional photo guidance in seconds
                  </p>
                </div>

                {/* Content Generator Card */}
                <motion.div
                  className="bg-white rounded-3xl shadow-xl p-8 mb-8"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="space-y-6">
                    {/* Platform Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Platform</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {["reddit", "twitter", "instagram", "onlyfans"].map((p) => (
                          <motion.button
                            key={p}
                            onClick={() => setPlatform(p)}
                            className={cn(
                              "py-3 px-4 rounded-xl font-medium capitalize transition-all",
                              platform === p
                                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            )}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            {p}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Style Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Style</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { value: "playful", label: "Playful" },
                          { value: "mysterious", label: "Mysterious" },
                          { value: "confident", label: "Confident" },
                          { value: "authentic", label: "Authentic" }
                        ].map((s) => (
                          <motion.button
                            key={s.value}
                            onClick={() => setStyle(s.value)}
                            className={cn(
                              "py-3 px-4 rounded-xl font-medium transition-all",
                              style === s.value
                                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            )}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            {s.label}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Theme Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Theme</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { value: "casual", label: "Casual" },
                          { value: "workout", label: "Workout" },
                          { value: "spicy", label: "Spicy" },
                          { value: "very-spicy", label: "Very Spicy" }
                        ].map((t) => (
                          <motion.button
                            key={t.value}
                            onClick={() => setTheme(t.value)}
                            className={cn(
                              "py-3 px-4 rounded-xl font-medium transition-all",
                              theme === t.value
                                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            )}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            {t.label}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Prompt */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Additional Instructions (Optional)
                      </label>
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none h-24"
                      />
                    </div>

                    {/* Generate Button */}
                    <motion.button
                      onClick={handleGenerate}
                      disabled={generateContentMutation.isPending}
                      className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold text-lg shadow-lg flex items-center justify-center space-x-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {generateContentMutation.isPending ? (
                        <>
                          <RefreshCw className="h-5 w-5 animate-spin" />
                          <span>Creating Magic...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-5 w-5" />
                          <span>Generate Content</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>

                {/* Generated Content */}
                {generatedContent && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Content Output */}
                    <div className="bg-white rounded-3xl shadow-xl p-8">
                      <h3 className="text-2xl font-bold mb-6">Your Content</h3>
                      
                      {/* Titles */}
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Titles</h4>
                        <div className="space-y-2">
                          {generatedContent.titles.map((title, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                              className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl"
                            >
                              <span className="text-gray-800">{title}</span>
                              <button
                                onClick={() => copyToClipboard(title)}
                                className="p-2 hover:bg-white rounded-lg transition-colors"
                              >
                                <Copy className="h-4 w-4 text-gray-600" />
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Content</h4>
                        <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                          <p className="text-gray-800 whitespace-pre-wrap">{generatedContent.content}</p>
                          <button
                            onClick={() => copyToClipboard(generatedContent.content)}
                            className="mt-4 px-4 py-2 bg-white hover:bg-gray-50 rounded-lg font-medium text-sm flex items-center space-x-2 transition-colors"
                          >
                            <Copy className="h-4 w-4" />
                            <span>Copy Content</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Photo Instructions */}
                    {generatedContent.photoInstructions && (
                      <div className="bg-white rounded-3xl shadow-xl p-8">
                        <h3 className="text-2xl font-bold mb-6 flex items-center">
                          <Camera className="mr-3 h-6 w-6 text-purple-600" />
                          Photo Guide
                        </h3>
                        
                        <div className="grid md:grid-cols-2 gap-4">
                          {Object.entries(generatedContent.photoInstructions).map(([key, value]) => (
                            <motion.div
                              key={key}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl"
                            >
                              <h4 className="font-semibold text-purple-600 capitalize mb-2">{key}</h4>
                              {Array.isArray(value) ? (
                                <ul className="space-y-1">
                                  {value.map((item, i) => (
                                    <li key={i} className="flex items-start text-sm text-gray-700">
                                      <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-gray-700">{value}</p>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            )}

            {activeSection === "protect" && (
              <motion.div
                key="protect"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-6xl mx-auto px-6 py-12"
              >
                {/* Hero Section */}
                <div className="text-center mb-12">
                  <motion.h2 
                    className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    Image Shield
                  </motion.h2>
                  <motion.p 
                    className="text-xl text-gray-600 max-w-2xl mx-auto"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    Protect your photos from reverse image searches while maintaining quality
                  </motion.p>
                </div>

                {/* Protection Interface */}
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Upload Section */}
                  <motion.div
                    className="bg-white rounded-3xl shadow-xl p-8"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <h3 className="text-xl font-semibold mb-6">Upload Image</h3>
                    
                    {!originalImage ? (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer hover:border-purple-500 transition-colors"
                      >
                        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 font-medium">Click to upload image</p>
                        <p className="text-sm text-gray-500 mt-2">PNG, JPG up to 20MB</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <img
                          src={originalImage}
                          alt="Original"
                          className="w-full rounded-xl shadow-lg"
                        />
                        <button
                          onClick={() => setOriginalImage(null)}
                          className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                        >
                          Remove Image
                        </button>
                      </div>
                    )}
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </motion.div>

                  {/* Protection Controls */}
                  <motion.div
                    className="bg-white rounded-3xl shadow-xl p-8"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <h3 className="text-xl font-semibold mb-6">Protection Settings</h3>
                    
                    <div className="space-y-6">
                      {/* Protection Level */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Protection Level
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { value: "smart", label: "Smart", desc: "Minimal changes" },
                            { value: "balanced", label: "Balanced", desc: "Good protection" },
                            { value: "maximum", label: "Maximum", desc: "Best security" }
                          ].map((level) => (
                            <button
                              key={level.value}
                              onClick={() => setProtectionLevel(level.value as any)}
                              className={cn(
                                "p-3 rounded-xl text-center transition-all",
                                protectionLevel === level.value
                                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                                  : "bg-gray-100 hover:bg-gray-200"
                              )}
                            >
                              <div className="font-medium">{level.label}</div>
                              <div className="text-xs opacity-80 mt-1">{level.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Apply Protection Button */}
                      <button
                        onClick={applyImageProtection}
                        disabled={!originalImage || isProcessing}
                        className={cn(
                          "w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center space-x-2",
                          originalImage && !isProcessing
                            ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg hover:shadow-xl"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        )}
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="h-5 w-5 animate-spin" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <Shield className="h-5 w-5" />
                            <span>Apply Protection</span>
                          </>
                        )}
                      </button>

                      {/* Protected Image Preview */}
                      {protectedImage && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-4"
                        >
                          <h4 className="font-medium text-gray-700">Protected Image</h4>
                          <img
                            src={protectedImage}
                            alt="Protected"
                            className="w-full rounded-xl shadow-lg"
                          />
                          <button
                            onClick={downloadProtected}
                            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"
                          >
                            <Download className="h-5 w-5" />
                            <span>Download Protected Image</span>
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                </div>

                {/* Canvas for processing */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </motion.div>
            )}

            {activeSection !== "generate" && activeSection !== "protect" && (
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-6xl mx-auto px-6 py-12"
              >
                <div className="bg-white rounded-3xl shadow-xl p-12 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    {React.cloneElement(
                      navigationItems.find(item => item.id === activeSection)?.icon || <Sparkles className="h-8 w-8" />,
                      { className: "h-8 w-8 text-purple-600" }
                    )}
                  </div>
                  <h2 className="text-3xl font-bold mb-4">
                    {navigationItems.find(item => item.id === activeSection)?.label}
                  </h2>
                  <p className="text-gray-600 mb-8">This feature is coming soon in the next update.</p>
                  <motion.button
                    onClick={() => setActiveSection("generate")}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold shadow-lg"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Back to Content Creator
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}