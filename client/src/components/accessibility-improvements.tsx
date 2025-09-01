import React from 'react';
import { Button } from '@/components/ui/button';
import { Ban, UserX, RotateCcw, LogOut, KeyRound, Copy, Plus, Upload } from 'lucide-react';

// Example accessibility improvements based on ACCESSIBILITY_AUDIT.md

interface User {
  id: number;
  username?: string;
  email: string;
}

interface AccessibilityImprovedButtonsProps {
  user: User;
  onBanUser: (user: User) => void;
  onSuspendUser: (user: User) => void;
  onUnbanUser: (user: User) => void;
  onForceLogout: (user: User) => void;
  onResetPassword: (user: User) => void;
  onCopyPassword: () => void;
  onCreateTrial: () => void;
  onAddExpense: () => void;
  onUploadReceipt: () => void;
}

export function AccessibilityImprovedButtons({
  user,
  onBanUser,
  onSuspendUser,
  onUnbanUser,
  onForceLogout,
  onResetPassword,
  onCopyPassword,
  onCreateTrial,
  onAddExpense,
  onUploadReceipt
}: AccessibilityImprovedButtonsProps) {
  const userDisplayName = user.username || user.email;

  return (
    <div className="space-y-4">
      {/* Admin Portal Actions - Enhanced ARIA Labels */}
      <div className="space-x-2">
        <Button
          onClick={() => onBanUser(user)}
          size="sm"
          variant="destructive"
          className="h-7 text-xs"
          aria-label={`Ban user ${userDisplayName}`}
        >
          <Ban className="h-3 w-3 mr-1" />
          Ban
        </Button>

        <Button
          onClick={() => onSuspendUser(user)}
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          aria-label={`Suspend user ${userDisplayName}`}
        >
          <UserX className="h-3 w-3 mr-1" />
          Suspend
        </Button>

        <Button
          onClick={() => onUnbanUser(user)}
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          aria-label={`Unban user ${userDisplayName}`}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Unban
        </Button>

        <Button
          onClick={() => onForceLogout(user)}
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          aria-label={`Force logout user ${userDisplayName}`}
        >
          <LogOut className="h-3 w-3 mr-1" />
          Force Logout
        </Button>

        <Button
          onClick={() => onResetPassword(user)}
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          aria-label={`Reset password for user ${userDisplayName}`}
        >
          <KeyRound className="h-3 w-3 mr-1" />
          Reset Password
        </Button>

        <Button
          onClick={onCopyPassword}
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          aria-label="Copy temporary password to clipboard"
        >
          <Copy className="h-3 w-3 mr-1" />
          Copy Password
        </Button>

        <Button
          onClick={onCreateTrial}
          size="sm"
          variant="default"
          className="h-7 text-xs"
          aria-label="Create trial subscription for user"
        >
          <Plus className="h-3 w-3 mr-1" />
          Create Trial
        </Button>
      </div>

      {/* Tax Tracker Actions - Enhanced ARIA Labels */}
      <div className="space-x-2">
        <Button
          onClick={onAddExpense}
          size="sm"
          variant="default"
          aria-label="Open form to add a new tax-deductible expense"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </Button>

        <Button
          onClick={onUploadReceipt}
          size="sm"
          variant="outline"
          aria-label="Upload receipt image or PDF for existing expense"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Receipt
        </Button>
      </div>

      {/* Dynamic Status Messages - ARIA Live Regions */}
      <div 
        id="status-messages" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {/* Screen reader announcements for dynamic content updates */}
      </div>

      <div 
        id="error-messages" 
        aria-live="assertive" 
        aria-atomic="true"
        className="sr-only"
      >
        {/* Screen reader announcements for urgent error messages */}
      </div>
    </div>
  );
}

// Content Generation Actions with Enhanced Accessibility
interface ContentGenerationActionsProps {
  selectedMode: 'text' | 'image';
  selectedPlatform: string;
  selectedStyle: string;
  onGenerate: () => void;
  isGenerating: boolean;
  onCopyContent: (contentType: string) => void;
  generatedContent?: {
    title?: string;
    body?: string;
    hashtags?: string[];
  };
}

export function AccessibleContentGenerationActions({
  selectedMode,
  selectedPlatform,
  selectedStyle,
  onGenerate,
  isGenerating,
  onCopyContent,
  generatedContent
}: ContentGenerationActionsProps) {
  const generateButtonLabel = `Generate ${selectedStyle} content for ${selectedPlatform} using ${selectedMode} mode`;
  
  return (
    <div className="space-y-4">
      <Button
        onClick={onGenerate}
        disabled={isGenerating}
        aria-label={generateButtonLabel}
        aria-describedby="generation-settings"
      >
        {isGenerating ? 'Generating...' : 'Generate Content'}
      </Button>

      <div id="generation-settings" className="sr-only">
        Current settings: {selectedMode} mode, {selectedPlatform} platform, {selectedStyle} style
      </div>

      {generatedContent && (
        <div className="space-x-2">
          {generatedContent.title && (
            <Button
              onClick={() => onCopyContent('title')}
              size="sm"
              variant="outline"
              aria-label="Copy generated title to clipboard"
            >
              Copy Title
            </Button>
          )}

          {generatedContent.body && (
            <Button
              onClick={() => onCopyContent('body')}
              size="sm"
              variant="outline"
              aria-label="Copy generated body text to clipboard"
            >
              Copy Body
            </Button>
          )}

          {generatedContent.hashtags && generatedContent.hashtags.length > 0 && (
            <Button
              onClick={() => onCopyContent('hashtags')}
              size="sm"
              variant="outline"
              aria-label={`Copy ${generatedContent.hashtags.length} generated hashtags to clipboard`}
            >
              Copy Hashtags
            </Button>
          )}
        </div>
      )}

      {/* Progress indicator for generation process */}
      {isGenerating && (
        <div 
          role="progressbar"
          aria-label="Content generation in progress"
          aria-describedby="progress-description"
          className="w-full bg-gray-200 rounded-full h-2"
        >
          <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '45%' }}></div>
        </div>
      )}

      <div id="progress-description" className="sr-only">
        Generating content using AI providers, this may take a few moments
      </div>
    </div>
  );
}

// File Upload with Enhanced Accessibility
interface AccessibleFileUploadProps {
  onFileSelect: (file: File) => void;
  acceptedTypes: string;
  maxSize?: number;
  currentFile?: File;
}

export function AccessibleFileUpload({
  onFileSelect,
  acceptedTypes,
  maxSize = 10,
  currentFile
}: AccessibleFileUploadProps) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const fileDescription = `Upload ${acceptedTypes} files up to ${maxSize}MB`;
  const currentFileInfo = currentFile ? `Currently selected: ${currentFile.name}` : 'No file selected';

  return (
    <div className="space-y-2">
      <label 
        htmlFor="file-upload"
        className="block text-sm font-medium"
      >
        File Upload
      </label>
      
      <input
        id="file-upload"
        type="file"
        accept={acceptedTypes}
        onChange={handleFileChange}
        className="sr-only"
        aria-describedby="file-description file-status"
      />
      
      <Button
        onClick={() => document.getElementById('file-upload')?.click()}
        variant="outline"
        aria-label={`Choose file to upload. ${fileDescription}`}
      >
        <Upload className="h-4 w-4 mr-2" />
        Choose File
      </Button>

      <div id="file-description" className="text-sm text-gray-600">
        {fileDescription}
      </div>

      <div 
        id="file-status" 
        aria-live="polite"
        className="text-sm text-gray-800"
      >
        {currentFileInfo}
      </div>
    </div>
  );
}