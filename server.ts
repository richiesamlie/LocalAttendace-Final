import express from "express";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import path from "path";
import apiRoutes from "./routes";

async function startServer() {
  const args = process.argv.slice(2);
  const isNetwork = args.includes('--network');
  const HOST = isNetwork ? '0.0.0.0' : '127.0.0.1';
  
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  // Use separated API routes
  app.use("/api", apiRoutes);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static("dist"));
  }

  app.listen(PORT, HOST, () => {
    console.log(`\n========================================`);
    console.log(` Teacher Assistant Server Started`);
    console.log(`========================================`);
    if (isNetwork) {
      console.log(`\n 🌍 INTERNAL-SITE MODE ACTIVE`);
      console.log(` -> Local:   http://localhost:${PORT}`);
      console.log(` -> Network: http://<YOUR_IP_ADDRESS>:${PORT}`);
      console.log(`\n (To find your IP, open cmd and type 'ipconfig')`);
    } else {
      console.log(`\n 🔒 LOCAL MODE ACTIVE`);
      console.log(` -> Local:   http://127.0.0.1:${PORT}`);
      console.log(`\n (Only this computer can access the app.)`);
      console.log(` (Run with 'npm run dev:network' to share on Wi-Fi)`);
    }
    console.log(`========================================\n`);
  });
}

startServer();
