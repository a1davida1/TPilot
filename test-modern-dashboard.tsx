// Test file to verify component structure
import React from "react";

export function TestComponent() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  
  return (
    <div className="min-h-screen bg-gradient-purple">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <p>Test</p>
    </div>
  );
}
