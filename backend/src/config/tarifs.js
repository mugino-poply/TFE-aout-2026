// Tarifs confirmés par Diego — Le Cénacle

export const TARIFS = {
  // ─── Repas ───────────────────────────────────────────────
  diner_resident: 17.00,      // Diner résident
  diner_invite:   23.00,      // Diner invité externe
  // Les résidents invités par d'autres résidents paient le tarif resident (17€)
  souper_complet:     10.00,  // Souper : soupe + plat froid + dessert
  souper_soupe:        5.00,  // Souper : soupe seule
  petit_dejeuner:      5.00,  // Petit déjeuner (lun–sam)

  // ─── Boissons chaudes ─────────────────────────────────────
  cafe_the:            3.00,  // Café ou thé (encodé par le serveur après le repas)

  // ─── Eau ──────────────────────────────────────────────────
  eau_quart:           1.50,  // Eau 1/4 L
  eau_demi:            2.00,  // Eau 1/2 L
  eau_litre:           2.50,  // Eau 1 L

  // ─── Softs / Bières ───────────────────────────────────────
  coca_soft:           2.50,  // Coca-cola / softs
  jupiler:             2.50,  // Jupiler
  jupiler_zero:        2.50,  // Jupiler 0%
  jus_fruit_bio:       3.50,  // Jus de fruit bio

  // ─── Vins / Bulles ────────────────────────────────────────
  vin_verre:           3.00,  // Vin au verre
  vin_bouteille:      14.00,  // Vin bouteille
  cava_verre:          4.00,  // Cava / prosecco au verre
  cava_bouteille:     15.00,  // Cava / prosecco bouteille
};