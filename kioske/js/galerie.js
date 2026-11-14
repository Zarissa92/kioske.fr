// Branche les flèches d'une galerie : défilement continu au survol, saut de 250 px au clic.
// Sert à la galerie de l'accueil et à celles des panneaux de catégorie.
function brancherGalerie(slider) {
        const galerie = slider.querySelector(".galerie");
        const gauche = slider.querySelector(".galerie-arrow-left");
        const droite = slider.querySelector(".galerie-arrow-right");

        if (!galerie || !gauche || !droite) return;

        let direction = 0;
        let animationId = null;
        let lastTime = 0;
        const vitesse = 420; // pixels par seconde

        function animation(time) {
            if (direction === 0) return;

            if (lastTime) {
                const delta = Math.min(time - lastTime, 50);
                galerie.scrollLeft += direction * vitesse * delta / 1000;
            }

            lastTime = time;
            animationId = requestAnimationFrame(animation);
        }

        function arreter() {
            direction = 0;
            lastTime = 0;

            if (animationId !== null) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        }

        function demarrer(sens) {
            arreter();

            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                return;
            }

            direction = sens;
            animationId = requestAnimationFrame(animation);
        }

        gauche.addEventListener("mouseenter", () => demarrer(-1));
        droite.addEventListener("mouseenter", () => demarrer(1));

        gauche.addEventListener("mouseleave", arreter);
        droite.addEventListener("mouseleave", arreter);

        gauche.addEventListener("click", () => {
            arreter();
            galerie.scrollBy({ left: -250, behavior: "smooth" });
        });

        droite.addEventListener("click", () => {
            arreter();
            galerie.scrollBy({ left: 250, behavior: "smooth" });
        });

        window.addEventListener("blur", arreter);
}
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".galerie-slider").forEach(brancherGalerie);
});
