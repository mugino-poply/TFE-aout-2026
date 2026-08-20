// Configuration PM2 du backend Le Cenacle.
// Fichier en .cjs car le package.json declare "type": "module" :
// PM2 lit sa configuration en CommonJS, un .js serait interprete comme ESM et echouerait.
// Lancement : pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: "cenacle-backend",

      // Point d'entree direct, jamais "npm start" :
      // PM2 supervise ainsi le processus Node lui-meme et recoit son code de sortie sans intermediaire.
      script: "src/index.js",

      // Repertoire de travail du processus.
      // Indispensable : dotenv cherche le .env relativement au repertoire courant,
      // pas relativement au fichier source qui l'importe.
      cwd: "/home/hippolyte/TFE-aout-2026/backend",

      // Un seul processus. Le compteur du limiteur de tentatives de connexion
      // vit en memoire dans le processus : plusieurs instances le fragmenteraient
      // et la limite serait multipliee par le nombre d'instances.
      exec_mode: "fork",
      instances: 1,

      // Relance automatique sur sortie non nulle ou crash.
      autorestart: true,

      // Delai avant chaque relance : 10 secondes.
      // Arbitrage assume : on allonge l'attente plutot que d'augmenter le nombre d'essais,
      // pour laisser a PostgreSQL le temps de se relever au lieu de bruler
      // les tentatives en boucle serree.
      restart_delay: 10000,
      max_restarts: 15,

      // Duree minimale de fonctionnement pour qu'un demarrage soit compte comme reussi.
      // En dessous, PM2 considere que le processus boucle et finit par le passer en errored.
      min_uptime: 20000,

      // Pas de surveillance de fichiers en production : le redemarrage passe
      // par le pipeline de deploiement (pm2 reload), pas par une ecriture disque.
      watch: false,

      // Arret propre : delai laisse au processus pour fermer ses connexions
      // apres reception du signal d'arret, avant que PM2 ne le tue.
      kill_timeout: 5000,

      env: {
        NODE_ENV: "production",
      },

      // Journaux horodates, sortie standard et erreurs separees.
      error_file: "/home/hippolyte/.pm2/logs/cenacle-backend-error.log",
      out_file: "/home/hippolyte/.pm2/logs/cenacle-backend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
  ],
};
