import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
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
  Unlock
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
  const [activeSection, setActiveSection] = useState("create");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  
  // Content generation states
  const [platform, setPlatform] = useState("reddit");
  const [style, setStyle] = useState("playful");
  const [theme, setTheme] = useState("teasing");
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

  const generateContentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/generate-ai", {
        ...data,
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
    } catch (error) {
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

  const navigationItems = [
    { id: "create", label: "Create", icon: <Sparkles className="h-4 w-4" /> },
    { id: "protect", label: "Protect", icon: <Shield className="h-4 w-4" /> },
    { id: "insights", label: "Insights", icon: <TrendingUp className="h-4 w-4" /> }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Fixed Header with Glass Effect */}
      <motion.header 
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrollY > 10 && "backdrop-blur-xl border-b border-gray-200/50"
        )}
        style={{
          backgroundColor: `rgba(255, 255, 255, ${headerOpacity})`
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <motion.div 
              className="flex items-center space-x-3"
              whileHover={{ scale: 1.02 }}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">ThottoPilot</h1>
                <p className="text-xs text-gray-500">Content Creation Suite</p>
              </div>
            </motion.div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {navigationItems.map((item) => (
                <motion.button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-all",
                    activeSection === item.id
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="flex items-center space-x-2">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                </motion.button>
              ))}
            </nav>

            {/* Get Started Button */}
            <motion.button
              className="hidden md:flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-medium text-sm shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span>Get Started</span>
              <ArrowRight className="h-4 w-4" />
            </motion.button>

            {/* Mobile Menu */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="pt-20">
        <AnimatePresence mode="wait">
          {activeSection === "create" && (
            <motion.div
              key="create"
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
                  Create Engaging Content
                </motion.h2>
                <motion.p 
                  className="text-xl text-gray-600 max-w-2xl mx-auto"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  Generate personalized content with professional photo guidance in seconds
                </motion.p>
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
                        { value: "playful", label: "Playful & Flirty" },
                        { value: "mysterious", label: "Mysterious" },
                        { value: "confident", label: "Bold & Confident" },
                        { value: "intimate", label: "Intimate" }
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
                        { value: "teasing", label: "Teasing" },
                        { value: "behind-scenes", label: "Behind Scenes" },
                        { value: "outfit", label: "Outfit Reveal" },
                        { value: "lifestyle", label: "Lifestyle" }
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
                      placeholder="Add any specific ideas or requirements..."
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
            </motion.div>
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
                  className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-4"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  Image Protection
                </motion.h2>
                <motion.p 
                  className="text-xl text-gray-600 max-w-2xl mx-auto"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  Shield your images from reverse searches while maintaining quality
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                >
                  <Unlock className="h-4 w-4" />
                  <span>Free for Everyone</span>
                </motion.div>
              </div>

              {/* Image Shield Card */}
              <motion.div
                className="bg-white rounded-3xl shadow-xl p-8"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                {/* Upload Area */}
                <div className="mb-8">
                  {originalImage ? (
                    <div className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-3">Original</h4>
                          <img
                            src={originalImage}
                            alt="Original"
                            className="w-full h-auto rounded-2xl shadow-lg"
                          />
                        </div>
                        {protectedImage && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-3">Protected</h4>
                            <img
                              src={protectedImage}
                              alt="Protected"
                              className="w-full h-auto rounded-2xl shadow-lg"
                            />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-center space-x-3">
                        <motion.button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium flex items-center space-x-2"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Upload className="h-4 w-4" />
                          <span>Change Image</span>
                        </motion.button>
                        {protectedImage && (
                          <motion.button
                            onClick={downloadProtected}
                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-medium flex items-center space-x-2 shadow-lg"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Download className="h-4 w-4" />
                            <span>Download</span>
                          </motion.button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <motion.div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer hover:border-gray-400 transition-colors"
                      whileHover={{ scale: 1.01 }}
                    >
                      <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Upload Image</h3>
                      <p className="text-gray-500 mb-4">Click to select or drag and drop</p>
                      <p className="text-sm text-gray-400">PNG, JPG up to 20MB</p>
                    </motion.div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>

                {/* Protection Settings */}
                {originalImage && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Protection Level</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { value: "smart", label: "Smart", desc: "Subtle protection" },
                          { value: "balanced", label: "Balanced", desc: "Recommended" },
                          { value: "maximum", label: "Maximum", desc: "Strongest protection" }
                        ].map((level) => (
                          <motion.button
                            key={level.value}
                            onClick={() => setProtectionLevel(level.value as any)}
                            className={cn(
                              "p-4 rounded-xl transition-all",
                              protectionLevel === level.value
                                ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            )}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="font-semibold">{level.label}</div>
                            <div className="text-xs mt-1 opacity-80">{level.desc}</div>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Apply Button */}
                    <motion.button
                      onClick={applyImageProtection}
                      disabled={isProcessing}
                      className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold text-lg shadow-lg flex items-center justify-center space-x-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="h-5 w-5 animate-spin" />
                          <span>Protecting...</span>
                        </>
                      ) : (
                        <>
                          <Shield className="h-5 w-5" />
                          <span>Apply Protection</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                )}

                {/* Features */}
                <div className="grid md:grid-cols-3 gap-6 mt-8 pt-8 border-t">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                    <h4 className="font-semibold mb-1">EXIF Removal</h4>
                    <p className="text-sm text-gray-500">Strips all metadata</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Zap className="h-6 w-6 text-white" />
                    </div>
                    <h4 className="font-semibold mb-1">Instant Processing</h4>
                    <p className="text-sm text-gray-500">No upload required</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Lock className="h-6 w-6 text-white" />
                    </div>
                    <h4 className="font-semibold mb-1">100% Private</h4>
                    <p className="text-sm text-gray-500">Never leaves your device</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {activeSection === "insights" && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-6xl mx-auto px-6 py-12"
            >
              <div className="text-center mb-12">
                <motion.h2 
                  className="text-5xl font-bold bg-gradient-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent mb-4"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  Coming Soon
                </motion.h2>
                <motion.p 
                  className="text-xl text-gray-600 max-w-2xl mx-auto"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  Analytics and insights to grow your audience
                </motion.p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}