/**
 * Bulk Captioning Page
 * Three-pane layout: Upload → Library → Calendar
 * Drag images from library to calendar to schedule
 */

import { useState } from 'react';
import { DndContext, DragOverlay, closestCenter, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useAuth } from '@/hooks/useAuth';
import { BulkUploadZone, type UploadedImage } from '@/components/upload/BulkUploadZone';
import { ImageLibraryGrid, useImageLibrarySelection } from '@/components/scheduling/ImageLibraryGrid';
import { CalendarDropZone } from '@/components/scheduling/CalendarDropZone';
import { ScheduleModal } from '@/components/scheduling/ScheduleModal';
import { DraggableImage, DragOverlay as DraggableImageOverlay } from '@/components/scheduling/DraggableImage';
import { CaptionEditorModal } from '@/components/scheduling/CaptionEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Upload, Image as ImageIcon, Calendar as CalendarIcon, Sparkles } from 'lucide-react';

interface ScheduledPost {
  id: string;
  imageUrl: string;
  subreddit: string;
  scheduledFor: Date;
}

export default function BulkCaptionPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [activeImage, setActiveImage] = useState<UploadedImage | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'upload' | 'library' | 'calendar'>('upload');

  // Image selection hook
  const {
    selectedIds,
    toggleSelection,
    selectAll,
    deselectAll,
    getSelectedImages,
  } = useImageLibrarySelection(uploadedImages);

  const userTier = (user?.tier || 'free') as 'free' | 'starter' | 'pro' | 'premium';

  // Handle new images uploaded
  const handleImagesUploaded = (newImages: UploadedImage[]) => {
    setUploadedImages((prev) => [...prev, ...newImages]);
    
    // Auto-switch to library view on mobile after upload
    if (window.innerWidth < 1024) {
      setCurrentView('library');
    }
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const image = uploadedImages.find((img) => img.id === event.active.id);
    if (image) {
      setActiveImage(image);
    }
  };

  // Handle drag end (drop on calendar)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveImage(null);

    if (!over) return;

    // Check if dropped on calendar
    if (over.id.toString().startsWith('calendar-')) {
      const image = uploadedImages.find((img) => img.id === active.id);
      const date = over.data.current?.date as Date;

      if (image && date) {
        setActiveImage(image);
        setSelectedDate(date);
        setScheduleModalOpen(true);
      }
    }
  };

  // Handle date drop from calendar component
  const handleDateDrop = (date: Date, image: UploadedImage) => {
    setActiveImage(image);
    setSelectedDate(date);
    setScheduleModalOpen(true);
  };

  // Handle schedule confirmation
  const handleSchedule = (scheduleData: { subreddit: string; scheduledFor: string; title: string; nsfw: boolean; imageUrl: string; caption?: string }) => {
    // Create scheduled post
    const newPost: ScheduledPost = {
      id: `${Date.now()}`,
      imageUrl: scheduleData.imageUrl,
      subreddit: scheduleData.subreddit,
      scheduledFor: new Date(scheduleData.scheduledFor),
    };

    setScheduledPosts((prev) => [...prev, newPost]);
    setScheduleModalOpen(false);
    setActiveImage(null);
    setSelectedDate(null);

    toast({
      title: 'Post scheduled',
      description: 'Post scheduled successfully',
    });
  };

  // Handle caption edit
  const handleEditCaption = (imageId: string) => {
    setEditingImageId(imageId);
  };

  // Handle caption save
  const handleCaptionSave = (imageId: string, caption: string) => {
    setUploadedImages((prev) =>
      prev.map((img) => (img.id === imageId ? { ...img, caption } : img))
    );
    setEditingImageId(null);
    toast({
      title: 'Caption saved',
      description: 'Caption updated successfully',
    });
  };

  // Handle image delete
  const handleDeleteImage = (imageId: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== imageId));
    toast({
      title: 'Image removed',
      description: 'Image removed from library',
    });
  };

  // Bulk actions
  const handleBulkDelete = () => {
    const selected = getSelectedImages();
    setUploadedImages((prev) =>
      prev.filter((img) => !selectedIds.has(img.id))
    );
    deselectAll();
    toast({
      title: 'Images removed',
      description: `${selected.length} image${selected.length > 1 ? 's' : ''} removed`,
    });
  };

  const editingImage = uploadedImages.find((img) => img.id === editingImageId);

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="mb-2 text-3xl font-bold">Bulk Captioning</h1>
          <p className="text-muted-foreground">
            Upload multiple images, generate captions, and schedule posts
          </p>
        </div>

        {/* Mobile Tabs */}
        <div className="mb-6 lg:hidden">
          <Tabs value={currentView} onValueChange={(v) => setCurrentView(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload">
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="library">
                <ImageIcon className="mr-2 h-4 w-4" />
                Library
                {uploadedImages.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {uploadedImages.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="calendar">
                <CalendarIcon className="mr-2 h-4 w-4" />
                Calendar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4">
              <BulkUploadZone
                onImagesUploaded={handleImagesUploaded}
                maxFiles={20}
                autoGenerateCaptions={true}
              />
            </TabsContent>

            <TabsContent value="library" className="mt-4">
              {uploadedImages.length > 0 ? (
                <>
                  {selectedIds.size > 0 && (
                    <div className="mb-4 flex items-center justify-between rounded-lg border bg-muted/50 p-3">
                      <span className="text-sm font-medium">
                        {selectedIds.size} selected
                      </span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDelete}
                      >
                        Delete Selected
                      </Button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {uploadedImages.map((image) => (
                      <DraggableImage
                        key={image.id}
                        image={image}
                        showCaption={true}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                    <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No images uploaded yet
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setCurrentView('upload')}
                    >
                      Upload Images
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="calendar" className="mt-4">
              <CalendarDropZone
                userTier={userTier}
                scheduledPosts={scheduledPosts}
                onDateDrop={handleDateDrop}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Desktop Three-Pane Layout */}
        <div className="hidden gap-6 lg:flex">
          {/* Left Pane - Upload (20%) */}
          <div className="w-[20%] flex-shrink-0">
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Upload className="h-4 w-4" />
                  Upload
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BulkUploadZone
                  onImagesUploaded={handleImagesUploaded}
                  maxFiles={20}
                  autoGenerateCaptions={true}
                />

                {/* Stats */}
                {uploadedImages.length > 0 && (
                  <div className="mt-4 space-y-2 rounded-lg border bg-muted/50 p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-medium">{uploadedImages.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ready</span>
                      <span className="font-medium text-green-600">
                        {uploadedImages.filter((img) => img.status === 'success' && img.caption).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Scheduled</span>
                      <span className="font-medium text-blue-600">
                        {scheduledPosts.length}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Center Pane - Image Library (50%) */}
          <div className="flex-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Image Library
                  {uploadedImages.length > 0 && (
                    <Badge variant="secondary">{uploadedImages.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {uploadedImages.length > 0 ? (
                  <>
                    {selectedIds.size > 0 && (
                      <div className="mb-4 flex items-center justify-between rounded-lg border bg-muted/50 p-3">
                        <span className="text-sm font-medium">
                          {selectedIds.size} selected
                        </span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleBulkDelete}
                        >
                          Delete Selected
                        </Button>
                      </div>
                    )}
                    <ImageLibraryGrid
                      images={uploadedImages}
                      selectedIds={selectedIds}
                      onToggleSelection={toggleSelection}
                      onSelectAll={selectAll}
                      onDeselectAll={deselectAll}
                      onEditCaption={handleEditCaption}
                      onDeleteImage={handleDeleteImage}
                      columns={3}
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Sparkles className="mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="mb-2 font-medium">No images yet</p>
                    <p className="text-sm text-muted-foreground">
                      Upload images to get started with bulk captioning
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Pane - Calendar (30%) */}
          <div className="w-[30%] flex-shrink-0">
            <div className="sticky top-20">
              <CalendarDropZone
                userTier={userTier}
                scheduledPosts={scheduledPosts}
                onDateDrop={handleDateDrop}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeImage ? <DraggableImageOverlay image={activeImage} /> : null}
      </DragOverlay>

      {/* Schedule Modal */}
      {scheduleModalOpen && activeImage && selectedDate && (
        <ScheduleModal
          isOpen={scheduleModalOpen}
          onClose={() => {
            setScheduleModalOpen(false);
            setActiveImage(null);
            setSelectedDate(null);
          }}
          image={activeImage}
          selectedDate={selectedDate}
          onSchedule={handleSchedule}
        />
      )}

      {/* Caption Editor Modal */}
      {editingImage && (
        <CaptionEditorModal
          isOpen={true}
          onClose={() => setEditingImageId(null)}
          imageId={editingImage.id}
          imageUrl={editingImage.url}
          initialCaption={editingImage.caption}
          onSave={handleCaptionSave}
          onCancel={() => setEditingImageId(null)}
        />
      )}
    </DndContext>
  );
}
