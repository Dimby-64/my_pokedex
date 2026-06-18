const STORAGE_KEY = "my-pokedex";

const form        = document.getElementById("searchForm");
const input       = document.getElementById("searchInput");
const grid        = document.getElementById("pokemonGrid");
const emptyState  = document.getElementById("emptyState");
const errorMsg    = document.getElementById("errorMsg");
const countLabel  = document.getElementById("countLabel");
const clearBtn    = document.getElementById("clearBtn");
const overlay          = document.getElementById("modalOverlay");
const modalClose       = document.getElementById("modalClose");
const shinyToggle      = document.getElementById("shinyToggle");
const shinyToggleLabel = document.getElementById("shinyToggleLabel");
const modalSprite      = document.getElementById("modalSprite");

let currentPoke = null;
let dragSrcId   = null;

function swapNodes(a, b) {
  const marker = document.createTextNode("");
  grid.insertBefore(marker, a);
  grid.insertBefore(a, b);
  grid.insertBefore(b, marker);
  marker.remove();
}

function addDragHandlers(card, poke) {
  card.draggable = true;

  card.addEventListener("dragstart", (e) => {
    dragSrcId = poke.id;
    e.dataTransfer.effectAllowed = "move";
    // Defer so the drag ghost is captured before the card fades
    requestAnimationFrame(() => card.classList.add("dragging"));
  });

  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    grid.querySelectorAll(".drag-over").forEach((c) => c.classList.remove("drag-over"));
    dragSrcId = null;
  });

  card.addEventListener("dragover", (e) => {
    if (!dragSrcId || dragSrcId === poke.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    grid.querySelectorAll(".drag-over").forEach((c) => c.classList.remove("drag-over"));
    card.classList.add("drag-over");
  });

  card.addEventListener("dragleave", (e) => {
    if (!card.contains(e.relatedTarget)) card.classList.remove("drag-over");
  });

  card.addEventListener("drop", (e) => {
    e.preventDefault();
    if (!dragSrcId || dragSrcId === poke.id) return;
    card.classList.remove("drag-over");

    const srcCard = document.getElementById(`card-${dragSrcId}`);
    swapNodes(srcCard, card);

    const srcIdx = pokedex.findIndex((p) => p.id === dragSrcId);
    const tgtIdx = pokedex.findIndex((p) => p.id === poke.id);
    [pokedex[srcIdx], pokedex[tgtIdx]] = [pokedex[tgtIdx], pokedex[srcIdx]];
    save();
  });
}

shinyToggle.addEventListener("change", () => {
  if (!currentPoke) return;
  const shiny = shinyToggle.checked;
  modalSprite.src = shiny ? currentPoke.shinySprite : currentPoke.sprite;
  modalSprite.classList.toggle("sprite-shiny", shiny);
});

const VERSION_PRIORITY = [
  "scarlet-violet", "sword-shield", "brilliant-diamond-and-shining-pearl",
  "the-isle-of-armor", "the-crown-tundra",
  "ultra-sun-ultra-moon", "sun-moon", "lets-go-pikachu-lets-go-eevee",
  "omega-ruby-alpha-sapphire", "x-y",
  "black-2-white-2", "black-white",
  "heartgold-soulsilver", "platinum", "diamond-pearl",
  "firered-leafgreen", "emerald", "ruby-sapphire",
  "crystal", "gold-silver", "red-blue", "yellow",
];

const learnsetCache = {};
let currentLearnsetMethods = null;
let activeLearnsetTab = "level-up";

function formatMoveName(name) {
  return name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function processLearnset(rawMoves) {
  const groups = { "level-up": [], machine: [], egg: [], tutor: [] };

  for (const entry of rawMoves) {
    const details = entry.version_group_details;
    if (!details.length) continue;

    let best = null;
    for (const v of VERSION_PRIORITY) {
      best = details.find((d) => d.version_group.name === v) || null;
      if (best) break;
    }
    if (!best) best = details[details.length - 1];

    const method = best.move_learn_method.name;
    const target = groups[method];
    if (!target) continue;

    target.push({ name: entry.move.name, level: best.level_learned_at });
  }

  groups["level-up"].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  groups.machine.sort((a, b) => a.name.localeCompare(b.name));
  groups.egg.sort((a, b) => a.name.localeCompare(b.name));
  groups.tutor.sort((a, b) => a.name.localeCompare(b.name));

  return groups;
}

function renderLearnsetTab(method) {
  const list   = document.getElementById("learnsetList");
  const query  = document.getElementById("learnsetSearch")?.value.trim().toLowerCase() ?? "";
  let   moves  = currentLearnsetMethods?.[method] ?? [];

  if (!moves.length) {
    list.innerHTML = '<span class="evo-none">No moves via this method.</span>';
    return;
  }

  if (query) {
    moves = moves.filter((m) => m.name.includes(query) || formatMoveName(m.name).toLowerCase().includes(query));
  }

  if (!moves.length) {
    list.innerHTML = '<span class="evo-none">No moves match your search.</span>';
    return;
  }

  if (method === "level-up") {
    list.innerHTML = moves.map((m) => `
      <div class="move-row">
        <span class="move-level">Lv.&nbsp;${m.level || "—"}</span>
        <span class="move-name-text">${formatMoveName(m.name)}</span>
      </div>`).join("");
  } else {
    list.innerHTML = `<div class="move-chip-grid">${
      moves.map((m) => `<span class="move-chip">${formatMoveName(m.name)}</span>`).join("")
    }</div>`;
  }
}

function setLearnsetTab(method) {
  activeLearnsetTab = method;
  document.querySelectorAll(".learnset-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.method === method);
  });
  renderLearnsetTab(method);
}

function updateLearnsetTabCounts(groups) {
  document.querySelectorAll(".learnset-tab").forEach((btn) => {
    const count = groups[btn.dataset.method]?.length ?? 0;
    btn.textContent = count ? `${btn.dataset.label} (${count})` : btn.dataset.label;
    btn.disabled    = count === 0;
  });
}

document.getElementById("learnsetTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".learnset-tab");
  if (btn && !btn.disabled) setLearnsetTab(btn.dataset.method);
});

document.getElementById("learnsetSearch").addEventListener("input", () => {
  if (currentLearnsetMethods) renderLearnsetTab(activeLearnsetTab);
});

const STAT_META = {
  hp:               { label: "HP",       cls: "stat-hp"  },
  attack:           { label: "Attack",   cls: "stat-atk" },
  defense:          { label: "Defense",  cls: "stat-def" },
  "special-attack": { label: "Sp. Atk", cls: "stat-spa" },
  "special-defense":{ label: "Sp. Def", cls: "stat-spd" },
  speed:            { label: "Speed",    cls: "stat-spe" },
};

const MAX_STAT = 255;
const REGIONAL_SUFFIXES = ["-alola", "-galar", "-hisui", "-paldea"];

let pokedex = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

// Migration: old cached evolutionChain entries lack isDefault — clear so they re-fetch
// with full regional variant data.
let migrated = false;
pokedex.forEach((p) => {
  const first = p.evolutionChain?.[0]?.[0];
  if (p.evolutionChain && first?.isDefault === undefined) {
    delete p.evolutionChain;
    migrated = true;
  }
});
if (migrated) save();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pokedex));
}

function updateCount() {
  const n = pokedex.length;
  countLabel.textContent = `${n} Pokémon caught`;
  emptyState.style.display = n === 0 ? "block" : "none";
}

function renderCard(poke) {
  if (document.getElementById(`card-${poke.id}`)) return;

  const card = document.createElement("div");
  card.className = "poke-card";
  card.id = `card-${poke.id}`;

  const types = poke.types
    .map((t) => `<span class="poke-type type-${t}">${t}</span>`)
    .join("");

  card.innerHTML = `
    <button class="remove-btn" aria-label="Remove ${poke.name}" data-id="${poke.id}">✕</button>
    <img src="${poke.sprite}" alt="${poke.name}" />
    <span class="poke-name">${poke.name}</span>
    <span class="poke-number">#${String(poke.id).padStart(3, "0")}</span>
    <div class="poke-types">${types}</div>
  `;

  card.querySelector(".remove-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    removePokemon(poke.id);
  });

  card.addEventListener("click", () => openModal(poke));
  addDragHandlers(card, poke);
  grid.appendChild(card);
}

function removePokemon(id) {
  pokedex = pokedex.filter((p) => p.id !== id);
  save();
  updateCount();
  document.getElementById(`card-${id}`)?.remove();
}

// --- Evolution chain helpers ---

function idFromUrl(url) {
  return parseInt(url.split("/").filter(Boolean).pop(), 10);
}

function parseChain(link) {
  const stages = [];
  function walk(node, depth) {
    if (!stages[depth]) stages[depth] = [];
    stages[depth].push({ name: node.species.name, id: idFromUrl(node.species.url) });
    node.evolves_to.forEach((child) => walk(child, depth + 1));
  }
  walk(link, 0);
  return stages;
}

function isRegionalForm(name) {
  return REGIONAL_SUFFIXES.some((s) => name.endsWith(s));
}

function regionLabel(name) {
  if (name.endsWith("-alola"))  return "Alola";
  if (name.endsWith("-galar"))  return "Galar";
  if (name.endsWith("-hisui"))  return "Hisui";
  if (name.endsWith("-paldea")) return "Paldea";
  return null;
}

function displayName(name) {
  // Strip regional suffix, then capitalize
  const cleaned = name.replace(/-(alola|galar|hisui|paldea)$/, "");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// Fetch all varieties for a species, keeping only the default and true regional forms.
// Excludes cap/promo/costume variants (pikachu-original-cap, etc.).
async function fetchVarieties(speciesId) {
  const res  = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}`);
  const data = await res.json();
  return data.varieties
    .filter((v) => v.is_default || isRegionalForm(v.pokemon.name))
    .map((v) => ({
      name:      v.pokemon.name,
      id:        idFromUrl(v.pokemon.url),
      isDefault: v.is_default,
    }));
}

async function ensureEvolutionChain(poke) {
  if (poke.evolutionChain) return;

  // Regional forms (e.g. ninetales-alola) have high pokemon IDs that don't map to
  // species IDs. We stored speciesUrl on add; fall back to fetching it if missing.
  let speciesUrl = poke.speciesUrl;
  if (!speciesUrl) {
    const r    = await fetch(`https://pokeapi.co/api/v2/pokemon/${poke.id}`);
    const data = await r.json();
    speciesUrl  = data.species.url;
    poke.speciesUrl = speciesUrl;
    save();
  }

  const speciesRes  = await fetch(speciesUrl);
  const speciesData = await speciesRes.json();
  const chainRes    = await fetch(speciesData.evolution_chain.url);
  const chainData   = await chainRes.json();
  const baseStages  = parseChain(chainData.chain);

  // Fetch varieties for every species in the chain in parallel so regional
  // forms (Alolan Raichu, Hisuian Arcanine, etc.) appear alongside defaults.
  const speciesIds = [...new Set(baseStages.flat().map((m) => m.id))];
  const results    = await Promise.all(
    speciesIds.map((id) =>
      fetchVarieties(id)
        .then((varieties) => ({ id, varieties }))
        .catch(() => ({ id, varieties: [] }))
    )
  );
  const varietiesMap = Object.fromEntries(results.map((r) => [r.id, r.varieties]));

  poke.evolutionChain = baseStages.map((stage) =>
    stage.flatMap((mon) => {
      const varieties = varietiesMap[mon.id];
      if (!varieties || varieties.length <= 1) {
        return [{ name: mon.name, id: mon.id, isDefault: true }];
      }
      return varieties;
    })
  );

  save();
}

function renderEvolutionChain(poke) {
  const container = document.getElementById("evoChain");
  const chain     = poke.evolutionChain;

  if (!chain || chain.length === 0) {
    container.innerHTML = '<span class="evo-none">No evolution data.</span>';
    return;
  }

  if (chain.length === 1) {
    container.innerHTML = '<span class="evo-none">This Pokémon does not evolve.</span>';
    return;
  }

  const SPRITE = (id) =>
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

  const parts = chain.map((stage) => {
    const branching = stage.length > 1 ? " branching" : "";
    const mons = stage.map((mon) => {
      const isCurrent  = mon.id === poke.id;
      const caughtPoke = pokedex.find((p) => p.id === mon.id);
      const classes    = [
        "evo-mon",
        isCurrent              ? "evo-current"   : "",
        !isCurrent && caughtPoke ? "evo-clickable" : "",
        !caughtPoke            ? "evo-not-caught" : "",
      ].filter(Boolean).join(" ");
      const region = regionLabel(mon.name);
      const badge  = region ? `<span class="evo-region">${region}</span>` : "";
      return `
        <div class="${classes}" data-mon-id="${mon.id}">
          <img src="${SPRITE(mon.id)}" alt="${mon.name}" loading="lazy" />
          <span class="evo-name">${displayName(mon.name)}</span>
          ${badge}
        </div>`;
    }).join("");
    return `<div class="evo-stage${branching}">${mons}</div>`;
  });

  container.innerHTML = parts.join('<span class="evo-arrow">→</span>');

  container.querySelectorAll(".evo-clickable").forEach((el) => {
    el.addEventListener("click", () => {
      const target = pokedex.find((p) => p.id === parseInt(el.dataset.monId, 10));
      if (target) openModal(target);
    });
  });
}

// --- Modal ---

async function openModal(poke) {
  currentPoke = poke;

  // Reset toggle before populating
  shinyToggle.checked = false;
  modalSprite.classList.remove("sprite-shiny");
  shinyToggleLabel.classList.add("no-shiny"); // disabled until we confirm shiny exists

  // Reset learnset UI
  currentLearnsetMethods = null;
  activeLearnsetTab = "level-up";
  document.getElementById("learnsetSearch").value = "";
  document.getElementById("learnsetList").innerHTML = '<span class="evo-loading">Loading…</span>';
  document.querySelectorAll(".learnset-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.method === "level-up");
    btn.disabled    = false;
    btn.textContent = btn.dataset.label;
  });

  modalSprite.src = poke.sprite;
  modalSprite.alt = poke.name;
  document.getElementById("modalNumber").textContent = `#${String(poke.id).padStart(3, "0")}`;
  document.getElementById("modalName").textContent   = poke.name;

  document.getElementById("modalTypes").innerHTML = poke.types
    .map((t) => `<span class="poke-type type-${t}">${t}</span>`)
    .join("");

  overlay.classList.add("open");

  // Fetch any fields missing from old saves in one request
  if (!poke.stats || poke.shinySprite === undefined || !poke.abilities || !learnsetCache[poke.id]) {
    try {
      const res  = await fetch(`https://pokeapi.co/api/v2/pokemon/${poke.id}`);
      const data = await res.json();
      if (!poke.stats) {
        poke.stats = data.stats.map((s) => ({ name: s.stat.name, value: s.base_stat }));
      }
      if (poke.shinySprite === undefined) {
        poke.shinySprite = data.sprites.front_shiny || null;
      }
      if (!poke.abilities) {
        poke.abilities = data.abilities.map((a) => ({
          name:     a.ability.name,
          isHidden: a.is_hidden,
        }));
      }
      if (!learnsetCache[poke.id]) {
        learnsetCache[poke.id] = data.moves;
      }
      save();
    } catch {
      poke.stats       = poke.stats    || [];
      poke.shinySprite = poke.shinySprite ?? null;
      poke.abilities   = poke.abilities || [];
    }
  }

  // Enable shiny toggle only if a shiny sprite is available
  if (poke.shinySprite) {
    shinyToggleLabel.classList.remove("no-shiny");
  }

  // Render abilities
  const abilityList = document.getElementById("abilityList");
  abilityList.innerHTML = (poke.abilities || []).map((a) => {
    const label = a.name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const hiddenBadge = a.isHidden ? '<span class="hidden-badge">Hidden</span>' : "";
    return `<div class="ability-chip${a.isHidden ? " is-hidden" : ""}">${label}${hiddenBadge}</div>`;
  }).join("");

  const list = document.getElementById("statsList");
  list.innerHTML = poke.stats.map((s) => {
    const meta = STAT_META[s.name] || { label: s.name, cls: "stat-hp" };
    return `
      <div class="stat-row">
        <span class="stat-label">${meta.label}</span>
        <span class="stat-value">${s.value}</span>
        <div class="stat-bar-track">
          <div class="stat-bar-fill ${meta.cls}" data-pct="${(s.value / MAX_STAT) * 100}"></div>
        </div>
      </div>`;
  }).join("");

  requestAnimationFrame(() => {
    list.querySelectorAll(".stat-bar-fill").forEach((bar) => {
      bar.style.width = `${bar.dataset.pct}%`;
    });
  });

  document.getElementById("evoChain").innerHTML = '<span class="evo-loading">Loading…</span>';
  try {
    await ensureEvolutionChain(poke);
    renderEvolutionChain(poke);
  } catch {
    document.getElementById("evoChain").innerHTML =
      '<span class="evo-none">Could not load evolution data.</span>';
  }

  try {
    currentLearnsetMethods = processLearnset(learnsetCache[poke.id] || []);
    updateLearnsetTabCounts(currentLearnsetMethods);
    renderLearnsetTab(activeLearnsetTab);
  } catch {
    document.getElementById("learnsetList").innerHTML =
      '<span class="evo-none">Could not load learnset.</span>';
  }
}

function closeModal() {
  overlay.classList.remove("open");
  currentPoke = null;
  shinyToggle.checked = false;
  modalSprite.classList.remove("sprite-shiny");
  document.querySelectorAll(".stat-bar-fill").forEach((b) => (b.style.width = "0"));
}

modalClose.addEventListener("click", closeModal);
overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

// --- Add Pokémon ---

async function addPokemon(query) {
  const key = query.trim().toLowerCase();
  if (!key) return;

  errorMsg.textContent = "";
  const addBtn = form.querySelector("button");
  addBtn.disabled = true;

  try {
    const res  = await fetch(`https://pokeapi.co/api/v2/pokemon/${key}`);
    if (!res.ok) throw new Error("not found");
    const data = await res.json();

    if (pokedex.some((p) => p.id === data.id)) {
      errorMsg.textContent = `${data.name} is already in your list!`;
      return;
    }

    const poke = {
      id:          data.id,
      name:        data.name,
      sprite:      data.sprites.front_default,
      shinySprite: data.sprites.front_shiny || null,
      types:       data.types.map((t) => t.type.name),
      stats:       data.stats.map((s) => ({ name: s.stat.name, value: s.base_stat })),
      abilities:   data.abilities.map((a) => ({ name: a.ability.name, isHidden: a.is_hidden })),
      speciesUrl:  data.species.url,
    };

    pokedex.push(poke);
    save();
    updateCount();
    renderCard(poke);
    input.value = "";
  } catch {
    errorMsg.textContent = `No Pokémon found for "${query}". Try a name or number.`;
  } finally {
    addBtn.disabled = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  addPokemon(input.value);
});

clearBtn.addEventListener("click", () => {
  if (!pokedex.length) return;
  if (!confirm("Remove all Pokémon from your list?")) return;
  pokedex = [];
  save();
  grid.querySelectorAll(".poke-card").forEach((c) => c.remove());
  updateCount();
});

pokedex.forEach(renderCard);
updateCount();
