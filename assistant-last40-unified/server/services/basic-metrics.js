/**
 * Basic metrics service for tracking authentication and other metrics
 */

// Mock metrics implementation for testing
export const authMetrics = {
  track: (operation, success, duration, error) => {
    // Mock implementation - in real app this would track metrics
    console.log(`Metric: ${operation}, success: ${success}, duration: ${duration}ms`);
    if (error) {
      console.log(`Error: ${error}`);
    }
  }
};

export const basicMetrics = {
  increment: (metric, tags = {}) => {
    // Mock implementation
    console.log(`Increment metric: ${metric}`, tags);
  },
  
  gauge: (metric, value, tags = {}) => {
    // Mock implementation  
    console.log(`Gauge metric: ${metric} = ${value}`, tags);
  },
  
  timing: (metric, duration, tags = {}) => {
    // Mock implementation
    console.log(`Timing metric: ${metric} = ${duration}ms`, tags);
  }
};