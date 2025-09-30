module.exports = {
  apps: [
    {
      name: "tpilot-api",
      script: "production-server.js",
      instances: "max",
      exec_mode: "cluster",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
