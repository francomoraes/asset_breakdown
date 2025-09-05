import cors from "cors";

const isDevelopment = process.env.NODE_ENV === "development";

export const corsOptions: cors.CorsOptions = {
  origin: isDevelopment
    ? [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
      ]
    : process.env.FRONTEND_URL || "https://seudominio.com",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],

  optionsSuccessStatus: 200,
};
