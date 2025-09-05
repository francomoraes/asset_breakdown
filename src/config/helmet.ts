import helmet from "helmet";

export const helmetOptions = helmet({
  contentSecurityPolicy:
    process.env.NODE_ENV === "production" ? undefined : false,
  crossOriginEmbedderPolicy: false,
});
