import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContentGeneration } from "@shared/schema";
import { Camera, Lightbulb, CameraIcon, Crop, Palette, Settings, Save, History, Download, ChevronDown, ChevronUp } from "lucide-react";

interface PhotoInstructionsProps {
  currentGeneration: ContentGeneration | null;
}

export function PhotoInstructions({ currentGeneration }: PhotoInstructionsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const instructions = currentGeneration?.photoInstructions;

  return (
    <div className="space-y-6">
      <Card className="bg-white rounded-xl shadow-sm border border-gray-200 sticky top-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center">
              <Camera className="text-accent mr-2 h-5 w-5" />
              Photo Instructions
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          {instructions ? (
            <div className={`space-y-4 ${!isExpanded ? 'hidden' : ''}`}>
              {/* Quick Setup */}
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4 border border-yellow-200">
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                  <Lightbulb className="text-yellow-600 mr-2 h-4 w-4" />
                  Setup
                </h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  {instructions.lighting.map((tip, index) => (
                    <li key={index}>• {tip}</li>
                  ))}
                </ul>
              </div>

              {/* Camera Tips */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                  <CameraIcon className="text-blue-600 mr-2 h-4 w-4" />
                  Camera Tips
                </h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  {instructions.angles.map((tip, index) => (
                    <li key={index}>• {tip}</li>
                  ))}
                </ul>
              </div>

              {/* Background */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                  <Crop className="text-green-600 mr-2 h-4 w-4" />
                  Background
                </h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  {instructions.composition.map((tip, index) => (
                    <li key={index}>• {tip}</li>
                  ))}
                </ul>
              </div>

              {/* What to Wear */}
              <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-lg p-4 border border-pink-200">
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                  <Palette className="text-pink-600 mr-2 h-4 w-4" />
                  What to Wear
                </h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  {instructions.styling.map((tip, index) => (
                    <li key={index}>• {tip}</li>
                  ))}
                </ul>
              </div>

              {/* Photo Sequence */}
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg p-4 border border-purple-200">
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                  <Settings className="text-purple-600 mr-2 h-4 w-4" />
                  Photo Sequence
                </h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  {instructions.technical.map((tip, index) => (
                    <li key={index}>• {tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Camera className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Generate content to see photography instructions</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled={!currentGeneration}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Current Content
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <History className="mr-2 h-4 w-4" />
              View History
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled={!currentGeneration}
            >
              <Download className="mr-2 h-4 w-4" />
              Export to File
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
