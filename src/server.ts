import app from "./app";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(
    `🚀 Servidor rodando em http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`,
  );
});
