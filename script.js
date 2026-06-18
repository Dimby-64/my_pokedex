// Fade in sections as they scroll into view
const observer = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("visible")),
  { threshold: 0.15 }
);

document.querySelectorAll(".section, .card").forEach((el) => {
  el.classList.add("fade-in");
  observer.observe(el);
});

// Smooth active nav highlight
const sections = document.querySelectorAll("section[id]");
const navLinks = document.querySelectorAll("nav a");

window.addEventListener("scroll", () => {
  let current = "";
  sections.forEach((s) => {
    if (window.scrollY >= s.offsetTop - 120) current = s.id;
  });
  navLinks.forEach((a) => {
    a.style.color = a.getAttribute("href") === `#${current}` ? "var(--text)" : "";
  });
});
