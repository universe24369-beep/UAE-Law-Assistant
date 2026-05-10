import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Stripe from "stripe";
import {
  addDocument,
  commitBatch,
  deleteDocument,
  getDocument,
  queryCollection,
  setDocument,
  updateDocument,
  type FirestoreBatchRequest,
  type FirestoreAddRequest,
  type FirestoreDocRequest,
  type FirestoreQueryRequest,
  type FirestoreWriteRequest,
} from "./src/server/pocFirestoreStore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(process.cwd(), "dist");
const indexPath = path.join(distPath, "index.html");

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY) 
  : null;

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV,
      nodeVersion: process.versions.node
    });
  });

  app.get("/api/debug", (req, res) => {
    res.json({
      env: process.env.NODE_ENV,
      distPath,
      distExists: fs.existsSync(distPath),
      indexExists: fs.existsSync(indexPath),
      cwd: process.cwd(),
      files: fs.existsSync(distPath) ? fs.readdirSync(distPath) : []
    });
  });

  app.get("/api/firestore/health", (_req, res) => {
    res.json({ status: "ok", backend: "poc-firestore-store" });
  });

  app.post("/api/firestore/query", (req, res) => {
    const payload = req.body as FirestoreQueryRequest;
    res.json(queryCollection(payload));
  });

  app.post("/api/firestore/get", (req, res) => {
    const payload = req.body as FirestoreDocRequest;
    res.json(getDocument(payload));
  });

  app.post("/api/firestore/add", (req, res) => {
    const payload = req.body as FirestoreAddRequest;
    res.json(addDocument(payload));
  });

  app.post("/api/firestore/set", (req, res) => {
    const payload = req.body as FirestoreWriteRequest;
    res.json(setDocument(payload));
  });

  app.post("/api/firestore/update", (req, res) => {
    const payload = req.body as FirestoreWriteRequest;
    res.json(updateDocument(payload));
  });

  app.post("/api/firestore/delete", (req, res) => {
    const payload = req.body as FirestoreDocRequest;
    deleteDocument(payload);
    res.json({ ok: true });
  });

  app.post("/api/firestore/batch", (req, res) => {
    const payload = req.body as FirestoreBatchRequest;
    commitBatch(payload);
    res.json({ ok: true });
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    const { lawyerName, price, scheduledAt } = req.body;
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['host'];
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;

    if (!stripe) {
      // Mock for AI Studio preview without Stripe keys
      return res.json({ id: `mock_session_${Date.now()}` });
    }
    
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "aed",
            product_data: { name: `Consultation with ${lawyerName}`, description: `For ${scheduledAt}` },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${baseUrl}/appointments?success=true`,
        cancel_url: `${baseUrl}/lawyers?cancelled=true`,
      });
      res.json({ id: session.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    console.log(`>>> SERVING PRODUCTION ASSETS FROM: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (req.path.startsWith('/api')) return res.status(404).json({ error: "API not found" });
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`>>> ERROR: index.html not found at ${indexPath}`);
          res.status(500).send("Application assets missing. Please rebuild.");
        }
      });
    });
  } else {
    console.log(">>> STARTING VITE DEV SERVER (DEVELOPMENT MODE)");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error(">>> VITE INITIALIZATION FAILED:", e);
      app.use(express.static(distPath));
      app.get("*", (req, res) => res.sendFile(indexPath));
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> SERVER READY: http://0.0.0.0:${PORT} (ENV: ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer();
