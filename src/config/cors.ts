import cors from "cors";
import { config } from "./environment";

export const corsOptions: cors.CorsOptions = {
  origin: config.isDevelopment
    ? [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
      ]
    : config.frontendUrl === "*"
    ? true
    : config.frontendUrl.split(","),
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
