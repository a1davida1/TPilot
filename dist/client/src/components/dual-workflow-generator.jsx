import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Camera, FileText, Sparkles, Copy, Image, Wand2, RefreshCw, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
export function DualWorkflowGenerator() {
    const [workflowMode, setWorkflowMode] = useState('text-first');
    const [uploadedImage, setUploadedImage] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [platform, setPlatform] = useState("reddit");
    const [style, setStyle] = useState("playful");
    const [theme, setTheme] = useState("teasing");
    const [customPrompt, setCustomPrompt] = useState("");
    const [generatedContent, setGeneratedContent] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef(null);
    const { toast } = useToast();
    const handleImageUpload = (event) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                setUploadedImage(e.target?.result);
            };
            reader.readAsDataURL(file);
            toast({
                title: "Image Uploaded",
                description: "Your image has been uploaded successfully!"
            });
        }
    };
    const handleGenerateFromImage = async () => {
        if (!uploadedImage) {
            toast({
                title: "No Image",
                description: "Please upload an image first",
                variant: "destructive"
            });
            return;
        }
        setIsGenerating(true);
        // Simulate AI generation
        setTimeout(() => {
            setGeneratedContent({
                titles: [
                    "Feeling cute in this lighting 💕 What do you think?",
                    "Golden hour hits different... agree?",
                    "New angles, who dis? 😏",
                ],
                content: `Just experimenting with some new photography techniques today! Love how the natural lighting brings out different moods in each shot. 

Been working on my angles and composition - photography is such an art form! What's your favorite time of day for photos? 

Drop a comment if you want to see more content like this! Your support means everything 💖

#photography #goldenHour #naturalLight #contentCreator`
            });
            setIsGenerating(false);
            toast({
                title: "Content Generated!",
                description: "Caption and titles created from your image"
            });
        }, 2000);
    };
    const handleGenerateFromText = async () => {
        setIsGenerating(true);
        // Simulate AI generation
        setTimeout(() => {
            setGeneratedContent({
                titles: [
                    "Feeling playful today... come play? 😈",
                    "New content alert! You won't want to miss this 🔥",
                    "Your favorite creator is back with something special 💋"
                ],
                content: `Hey loves! 💕 

Just dropped some exclusive new content that I think you're going to absolutely love! I've been working on something special just for my amazing supporters.

Been feeling extra creative lately and wanted to share that energy with all of you. Your support and messages always brighten my day!

What kind of content do you want to see more of? Let me know in the comments! 

XOXO 💋`,
                photoInstructions: {
                    lighting: "Soft, warm lighting - preferably golden hour (1 hour before sunset) or use warm LED panels. Avoid harsh overhead lighting.",
                    angles: [
                        "Eye-level for intimate connection",
                        "Slightly above for flattering perspective",
                        "Profile shot to show silhouette",
                        "Over-shoulder looking back"
                    ],
                    composition: "Rule of thirds - place yourself off-center. Leave negative space for text overlay. Include interesting background elements but keep them soft/blurred.",
                    styling: "Casual-chic outfit, natural makeup with emphasis on glowing skin, loose hair with movement, minimal jewelry for elegance",
                    technical: "Use portrait mode or f/1.8-2.8 for background blur. ISO 100-400 for quality. Take multiple shots for variety. Shoot in RAW for editing flexibility."
                }
            });
            setIsGenerating(false);
            toast({
                title: "Content Generated!",
                description: "Content and photo instructions created"
            });
        }, 2000);
    };
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast({
            title: "Copied!",
            description: "Content copied to clipboard"
        });
    };
    return (<div className="space-y-6">
      {/* Workflow Mode Selector */}
      <Card className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-2xl">Dual Workflow Creator</CardTitle>
          <CardDescription className="text-gray-300">
            Choose your creative workflow - start with an image or generate content first
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={workflowMode} onValueChange={(v) => setWorkflowMode(v)}>
            <TabsList className="grid w-full grid-cols-2 bg-gray-900/50">
              <TabsTrigger value="text-first" className="data-[state=active]:bg-purple-600">
                <FileText className="mr-2 h-4 w-4"/>
                Text First
              </TabsTrigger>
              <TabsTrigger value="image-first" className="data-[state=active]:bg-purple-600">
                <Image className="mr-2 h-4 w-4"/>
                Image First
              </TabsTrigger>
            </TabsList>

            {/* Text-First Workflow */}
            <TabsContent value="text-first" className="space-y-4 mt-6">
              <div className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger className="bg-gray-900/50 border-purple-500/20">
                      <SelectValue placeholder="Select platform"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reddit">Reddit</SelectItem>
                      <SelectItem value="twitter">Twitter</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="onlyfans">OnlyFans</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={style} onValueChange={setStyle}>
                    <SelectTrigger className="bg-gray-900/50 border-purple-500/20">
                      <SelectValue placeholder="Select style"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="playful">Playful & Flirty</SelectItem>
                      <SelectItem value="mysterious">Mysterious</SelectItem>
                      <SelectItem value="confident">Bold & Confident</SelectItem>
                      <SelectItem value="intimate">Intimate & Personal</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger className="bg-gray-900/50 border-purple-500/20">
                      <SelectValue placeholder="Select theme"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teasing">Teasing</SelectItem>
                      <SelectItem value="behind-scenes">Behind the Scenes</SelectItem>
                      <SelectItem value="outfit">Outfit Reveal</SelectItem>
                      <SelectItem value="lifestyle">Lifestyle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Textarea placeholder="Add any specific instructions or ideas... (optional)" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} className="bg-gray-900/50 border-purple-500/20 min-h-[100px]"/>

                <Button onClick={handleGenerateFromText} disabled={isGenerating} className="w-full bg-gradient-to-r from-purple-500 to-pink-500">
                  {isGenerating ? (<>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin"/>
                      Generating...
                    </>) : (<>
                      <Wand2 className="mr-2 h-4 w-4"/>
                      Generate Content & Photo Instructions
                    </>)}
                </Button>
              </div>

              {generatedContent && workflowMode === 'text-first' && (<div className="space-y-4 animate-in fade-in duration-500">
                  {/* Generated Content */}
                  <Card className="bg-gray-900/50 border-purple-500/20">
                    <CardHeader>
                      <CardTitle className="text-lg">Generated Content</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-400 mb-2">Titles (pick one):</p>
                        {generatedContent.titles.map((title, i) => (<div key={i} className="flex items-center justify-between p-2 bg-purple-500/10 rounded mb-2">
                            <span className="text-sm">{title}</span>
                            <Button size="sm" variant="ghost" onClick={() => copyToClipboard(title)}>
                              <Copy className="h-3 w-3"/>
                            </Button>
                          </div>))}
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-400 mb-2">Content:</p>
                        <div className="p-3 bg-purple-500/10 rounded">
                          <p className="whitespace-pre-wrap text-sm">{generatedContent.content}</p>
                          <Button size="sm" variant="ghost" className="mt-2" onClick={() => copyToClipboard(generatedContent.content)}>
                            <Copy className="h-3 w-3 mr-2"/>
                            Copy Content
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Photo Instructions */}
                  {generatedContent.photoInstructions && (<Card className="bg-gray-900/50 border-pink-500/20">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                          <Camera className="mr-2 h-5 w-5"/>
                          Photo Instructions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="p-3 bg-pink-500/10 rounded">
                          <p className="text-sm font-semibold text-pink-300 mb-1">Lighting:</p>
                          <p className="text-sm">{generatedContent.photoInstructions.lighting}</p>
                        </div>
                        
                        <div className="p-3 bg-pink-500/10 rounded">
                          <p className="text-sm font-semibold text-pink-300 mb-1">Angles:</p>
                          <ul className="text-sm space-y-1">
                            {generatedContent.photoInstructions.angles.map((angle, i) => (<li key={i} className="flex items-start">
                                <CheckCircle className="h-3 w-3 mr-2 mt-0.5 text-green-400"/>
                                {angle}
                              </li>))}
                          </ul>
                        </div>
                        
                        <div className="p-3 bg-pink-500/10 rounded">
                          <p className="text-sm font-semibold text-pink-300 mb-1">Composition:</p>
                          <p className="text-sm">{generatedContent.photoInstructions.composition}</p>
                        </div>
                        
                        <div className="p-3 bg-pink-500/10 rounded">
                          <p className="text-sm font-semibold text-pink-300 mb-1">Styling:</p>
                          <p className="text-sm">{generatedContent.photoInstructions.styling}</p>
                        </div>
                        
                        <div className="p-3 bg-pink-500/10 rounded">
                          <p className="text-sm font-semibold text-pink-300 mb-1">Technical:</p>
                          <p className="text-sm">{generatedContent.photoInstructions.technical}</p>
                        </div>
                      </CardContent>
                    </Card>)}
                </div>)}
            </TabsContent>

            {/* Image-First Workflow */}
            <TabsContent value="image-first" className="space-y-4 mt-6">
              <div className="space-y-4">
                {!uploadedImage ? (<div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-purple-500/30 rounded-lg p-12 text-center cursor-pointer hover:border-purple-500/50 transition-colors">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-purple-400"/>
                    <p className="text-lg font-medium mb-2">Upload Your Photo</p>
                    <p className="text-sm text-gray-400">Click to browse or drag and drop</p>
                    <p className="text-xs text-gray-500 mt-2">Supports JPG, PNG up to 10MB</p>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden"/>
                  </div>) : (<div className="space-y-4">
                    <div className="relative rounded-lg overflow-hidden">
                      <img src={uploadedImage} alt="Uploaded" className="w-full h-64 object-cover"/>
                      <Button size="sm" variant="destructive" className="absolute top-2 right-2" onClick={() => {
                setUploadedImage(null);
                setImageFile(null);
            }}>
                        Remove
                      </Button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <Select value={platform} onValueChange={setPlatform}>
                        <SelectTrigger className="bg-gray-900/50 border-purple-500/20">
                          <SelectValue placeholder="Select platform"/>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="reddit">Reddit</SelectItem>
                          <SelectItem value="twitter">Twitter</SelectItem>
                          <SelectItem value="instagram">Instagram</SelectItem>
                          <SelectItem value="onlyfans">OnlyFans</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={style} onValueChange={setStyle}>
                        <SelectTrigger className="bg-gray-900/50 border-purple-500/20">
                          <SelectValue placeholder="Select style"/>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="playful">Playful & Flirty</SelectItem>
                          <SelectItem value="mysterious">Mysterious</SelectItem>
                          <SelectItem value="confident">Bold & Confident</SelectItem>
                          <SelectItem value="intimate">Intimate & Personal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button onClick={handleGenerateFromImage} disabled={isGenerating} className="w-full bg-gradient-to-r from-purple-500 to-pink-500">
                      {isGenerating ? (<>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin"/>
                          Analyzing Image...
                        </>) : (<>
                          <Sparkles className="mr-2 h-4 w-4"/>
                          Generate Caption & Titles
                        </>)}
                    </Button>
                  </div>)}

                {generatedContent && workflowMode === 'image-first' && (<Card className="bg-gray-900/50 border-purple-500/20 animate-in fade-in duration-500">
                    <CardHeader>
                      <CardTitle className="text-lg">Generated Captions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-400 mb-2">Title Options:</p>
                        {generatedContent.titles.map((title, i) => (<div key={i} className="flex items-center justify-between p-2 bg-purple-500/10 rounded mb-2">
                            <span className="text-sm">{title}</span>
                            <Button size="sm" variant="ghost" onClick={() => copyToClipboard(title)}>
                              <Copy className="h-3 w-3"/>
                            </Button>
                          </div>))}
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-400 mb-2">Caption:</p>
                        <div className="p-3 bg-purple-500/10 rounded">
                          <p className="whitespace-pre-wrap text-sm">{generatedContent.content}</p>
                          <Button size="sm" variant="ghost" className="mt-2" onClick={() => copyToClipboard(generatedContent.content)}>
                            <Copy className="h-3 w-3 mr-2"/>
                            Copy Caption
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>)}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Workflow Benefits */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-gray-900/50 border-purple-500/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <FileText className="mr-2 h-5 w-5"/>
              Text-First Benefits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start">
                <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-400"/>
                Plan your content before shooting
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-400"/>
                Get professional photo guidance
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-400"/>
                Ensure consistency across posts
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-pink-500/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Image className="mr-2 h-5 w-5"/>
              Image-First Benefits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start">
                <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-400"/>
                Perfect for spontaneous content
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-400"/>
                Captions match your actual photo
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-400"/>
                Quick turnaround for posting
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>);
}
