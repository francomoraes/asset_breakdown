import helmet from "helmet";
import { config } from "./environment";

export const helmetOptions = helmet({
  contentSecurityPolicy: config.isProduction
    ? {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      }
    : false,
  crossOriginEmbedderPolicy: config.isProduction,
  crossOriginResourcePolicy: config.isProduction
    ? { policy: "same-site" }
    : false,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
});
