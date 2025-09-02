import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
// Content Generation Skeleton
export function ContentSkeleton() {
    return (<div className="space-y-4 animate-in fade-in duration-500">
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4"/>
        <Skeleton className="h-4 w-1/2"/>
      </div>
      <Skeleton className="h-32 w-full"/>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20"/>
        <Skeleton className="h-8 w-20"/>
        <Skeleton className="h-8 w-20"/>
      </div>
    </div>);
}
// Post Card Skeleton
export function PostCardSkeleton() {
    return (<Card className="animate-in fade-in duration-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-1/3"/>
            <Skeleton className="h-3 w-1/4"/>
          </div>
          <Skeleton className="h-8 w-8 rounded-full"/>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-20 w-full mb-3"/>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full"/>
          <Skeleton className="h-6 w-16 rounded-full"/>
        </div>
      </CardContent>
    </Card>);
}
// Image Gallery Skeleton
export function ImageGallerySkeleton() {
    return (<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (<div key={i} className="aspect-square animate-in fade-in" style={{ animationDelay: `${i * 50}ms` }}>
          <Skeleton className="h-full w-full rounded-lg"/>
        </div>))}
    </div>);
}
// User Profile Skeleton
export function UserProfileSkeleton() {
    return (<div className="flex items-center gap-4 animate-in fade-in duration-500">
      <Skeleton className="h-16 w-16 rounded-full"/>
      <div className="space-y-2 flex-1">
        <Skeleton className="h-6 w-32"/>
        <Skeleton className="h-4 w-48"/>
      </div>
      <Skeleton className="h-10 w-24"/>
    </div>);
}
// Stats Card Skeleton
export function StatsCardSkeleton() {
    return (<Card className="animate-in fade-in duration-500">
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24"/>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-32 mb-1"/>
        <Skeleton className="h-3 w-20"/>
      </CardContent>
    </Card>);
}
// Dashboard Stats Skeleton
export function DashboardStatsSkeleton() {
    return (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (<div key={i} style={{ animationDelay: `${i * 100}ms` }}>
          <StatsCardSkeleton />
        </div>))}
    </div>);
}
// Table Skeleton
export function TableSkeleton({ rows = 5, columns = 4 }) {
    return (<div className="w-full animate-in fade-in duration-500">
      <div className="border rounded-lg">
        {/* Header */}
        <div className="border-b p-4 bg-muted/50">
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, i) => (<Skeleton key={i} className="h-4 flex-1"/>))}
          </div>
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (<div key={rowIndex} className="border-b last:border-0 p-4">
            <div className="flex gap-4">
              {Array.from({ length: columns }).map((_, colIndex) => (<Skeleton key={colIndex} className="h-4 flex-1" style={{
                    width: `${Math.random() * 30 + 70}%`,
                    animationDelay: `${(rowIndex * columns + colIndex) * 50}ms`
                }}/>))}
            </div>
          </div>))}
      </div>
    </div>);
}
// Form Skeleton
export function FormSkeleton() {
    return (<div className="space-y-6 animate-in fade-in duration-500">
      {Array.from({ length: 3 }).map((_, i) => (<div key={i} className="space-y-2" style={{ animationDelay: `${i * 100}ms` }}>
          <Skeleton className="h-4 w-24"/>
          <Skeleton className="h-10 w-full"/>
        </div>))}
      <div className="flex gap-2 justify-end">
        <Skeleton className="h-10 w-24"/>
        <Skeleton className="h-10 w-24"/>
      </div>
    </div>);
}
// Comment Skeleton
export function CommentSkeleton() {
    return (<div className="flex gap-3 animate-in fade-in duration-500">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0"/>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24"/>
          <Skeleton className="h-3 w-16"/>
        </div>
        <Skeleton className="h-16 w-full"/>
      </div>
    </div>);
}
// Notification Skeleton
export function NotificationSkeleton() {
    return (<div className="flex items-start gap-3 p-3 animate-in fade-in duration-500">
      <Skeleton className="h-2 w-2 rounded-full mt-2"/>
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4"/>
        <Skeleton className="h-3 w-1/2"/>
      </div>
      <Skeleton className="h-3 w-12"/>
    </div>);
}
// Loading State with Context
export function LoadingState({ message = "Loading...", submessage = "This won't take long" }) {
    return (<div className="flex flex-col items-center justify-center py-12 animate-in fade-in duration-500">
      <div className="relative">
        <div className="h-12 w-12 rounded-full border-4 border-primary/20 animate-pulse"/>
        <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin"/>
      </div>
      <p className="mt-4 text-sm font-medium">{message}</p>
      <p className="mt-1 text-xs text-muted-foreground">{submessage}</p>
    </div>);
}
// AI Generation Loading State
export function AIGenerationLoader({ stage = 1 }) {
    const stages = [
        { icon: "🤔", text: "Analyzing your request..." },
        { icon: "✨", text: "Generating content..." },
        { icon: "🎨", text: "Adding the finishing touches..." },
        { icon: "✅", text: "Almost ready!" }
    ];
    const currentStage = stages[Math.min(stage - 1, stages.length - 1)];
    return (<div className="flex flex-col items-center justify-center py-8 animate-in fade-in duration-500">
      <div className="text-4xl mb-4 animate-bounce">{currentStage.icon}</div>
      <p className="text-sm font-medium">{currentStage.text}</p>
      <div className="flex gap-1 mt-4">
        {stages.map((_, i) => (<div key={i} className={`h-1 w-8 rounded-full transition-colors ${i < stage ? 'bg-primary' : 'bg-muted'}`}/>))}
      </div>
    </div>);
}
// Upload Progress Skeleton
export function UploadProgressSkeleton({ progress = 0 }) {
    return (<div className="space-y-2 animate-in fade-in duration-500">
      <div className="flex justify-between text-sm">
        <span>Uploading...</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${progress}%` }}/>
      </div>
    </div>);
}
