const links = [...document.querySelectorAll(".docs-sidebar a[href^='#']")];
const sections = links
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

if (sections.length) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    links.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`);
    });
  }, { rootMargin: "-15% 0px -70% 0px", threshold: [0, .2, .6] });
  sections.forEach((section) => observer.observe(section));
}

document.querySelectorAll("[data-year]").forEach((node) => {
  node.textContent = String(new Date().getFullYear());
});
