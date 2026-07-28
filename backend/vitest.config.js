import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Reseed à l'état connu avant CHAQUE fichier de test (isolation).
    setupFiles: ["./vitest.setup.js"],
    // Base unique partagée : on sérialise les fichiers pour que le reseed
    // d'un fichier ne piétine pas la lecture d'un autre en parallèle.
    // Troc assumé : un peu plus lent, mais déterministe (fini le flaky d'ordre).
    fileParallelism: false,
  },
});
