import { loadConfig } from "./config.js";
import { MicoAgent } from "./agent/agent.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const agent = new MicoAgent(config);

  // Manejo de apagar agente limpiamente con señales del OS
  const shutdown = () => {
    console.log("\n[Mico 🐒] Recibida señal de apagado. Deteniendo...");
    agent.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await agent.start();
}

main().catch((error) => {
  console.error("[Mico 🐒] Error fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});

