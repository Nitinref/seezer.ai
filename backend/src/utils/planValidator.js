/**
 * src/utils/planValidator.js
 *
 * Validates and repairs the PlannerAgent's JSON output.
 * LLMs sometimes wrap output in markdown code fences or return
 * partial JSON — this module handles all those cases gracefully.
 */

// ── Strip markdown fences ─────────────────────────────────────────────────
function stripMarkdown(raw) {
  return raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```$/im, '')
    .trim();
}

// ── Required plan schema ──────────────────────────────────────────────────
const DEFAULT_PLAN = {
  summary:       'Build the requested application',
  approach:      'Implement a maintainable React + Tailwind application split across the route page and focused components',
  homeComponent: 'src/pages/Home.jsx',
  files:         [],
  newPages:      [],
  packages:      [],
  steps:         [],
  ui: {
    visualDirection: '',
    palette: [],
    typography: '',
    sections: [],
    interactions: [],
    responsiveNotes: '',
  },
};

// ── Validate a single file entry ──────────────────────────────────────────
function validateFile(f) {
  if (typeof f !== 'object' || !f) return null;
  return {
    path:        typeof f.path        === 'string' ? f.path        : 'src/pages/Home.jsx',
    action:      ['create', 'update', 'delete'].includes(f.action) ? f.action : 'update',
    description: typeof f.description === 'string' ? f.description : '',
  };
}

/**
 * Parse and validate the raw string output from PlannerAgent.
 *
 * @param {string} raw  - Whatever the agent returned
 * @returns {{ valid: boolean, plan: object, repaired: boolean, error?: string }}
 */
export function validatePlan(raw) {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, plan: DEFAULT_PLAN, repaired: true, error: 'Empty output from PlannerAgent' };
  }

  // Step 1: strip markdown if present
  const cleaned = stripMarkdown(raw);

  // Step 2: try direct parse
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e1) {
    // Step 3: try to extract JSON object from mixed content
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch (e2) {
        return {
          valid:    false,
          plan:     DEFAULT_PLAN,
          repaired: true,
          error:    `JSON parse failed: ${e2.message}`,
        };
      }
    } else {
      return {
        valid:    false,
        plan:     DEFAULT_PLAN,
        repaired: true,
        error:    `No JSON object found in PlannerAgent output`,
      };
    }
  }

  // Step 4: repair / fill missing fields
  let repaired = false;
  const plan   = { ...DEFAULT_PLAN };

  if (typeof parsed.summary       === 'string') plan.summary       = parsed.summary;       else repaired = true;
  if (typeof parsed.approach      === 'string') plan.approach      = parsed.approach;      else repaired = true;
  if (typeof parsed.homeComponent === 'string') plan.homeComponent = parsed.homeComponent; else repaired = true;

  if (Array.isArray(parsed.files)) {
    plan.files = parsed.files.map(validateFile).filter(Boolean);
  } else {
    repaired = true;
  }

  if (Array.isArray(parsed.newPages))  plan.newPages  = parsed.newPages.filter((p) => typeof p === 'string');
  if (Array.isArray(parsed.packages))  plan.packages  = parsed.packages.filter((p) => typeof p === 'string');
  if (Array.isArray(parsed.steps))     plan.steps     = parsed.steps.filter((s) => typeof s === 'string');

  // Persist a compact visual brief so the builder can create a deliberate UI
  // without repeatedly rediscovering the design from the whole codebase.
  if (parsed.ui && typeof parsed.ui === 'object') {
    plan.ui = {
      visualDirection: typeof parsed.ui.visualDirection === 'string' ? parsed.ui.visualDirection : '',
      palette: Array.isArray(parsed.ui.palette) ? parsed.ui.palette.filter((v) => typeof v === 'string').slice(0, 8) : [],
      typography: typeof parsed.ui.typography === 'string' ? parsed.ui.typography : '',
      sections: Array.isArray(parsed.ui.sections) ? parsed.ui.sections.filter((v) => typeof v === 'string').slice(0, 12) : [],
      interactions: Array.isArray(parsed.ui.interactions) ? parsed.ui.interactions.filter((v) => typeof v === 'string').slice(0, 8) : [],
      responsiveNotes: typeof parsed.ui.responsiveNotes === 'string' ? parsed.ui.responsiveNotes : '',
    };
  }

  return { valid: true, plan, repaired };
}
