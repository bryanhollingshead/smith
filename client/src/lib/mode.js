// Smith — Mode (Tradesman ↔ Homeowner) helpers
//
// One account, two modes. The mode is persisted server-side as users.role
// ('tradesperson' on the DB side, 'tradesman' as the product-facing label;
// 'homeowner' on both sides). The homeowner side's DISPLAYED LABEL is
// derived from users.hiring_context — never stored — so a property manager
// sees "Property manager" everywhere a regular homeowner would see
// "Homeowner". This file is the single source for that derivation.

export const MODE = {
  TRADESMAN: 'tradesman',
  HOMEOWNER: 'homeowner',
};

// users.role uses 'tradesperson' (legacy from migration 013) but the product
// language is 'tradesman'. Translate at the edges; never store 'tradesman'.
export function modeOf(user) {
  if (!user) return null;
  return user.role === 'homeowner' ? MODE.HOMEOWNER : MODE.TRADESMAN;
}

const HOMEOWNER_LABELS = {
  own_home:         'Homeowner',
  property_manager: 'Property manager',
};

/**
 * The label to render for the user's CURRENT mode.
 * Tradesman mode always renders 'Tradesman'.
 * Homeowner mode renders the derived hiring_context label, defaulting to
 * 'Homeowner' when hiring_context is NULL or unknown.
 */
export function modeLabel(user) {
  if (modeOf(user) === MODE.HOMEOWNER) {
    return HOMEOWNER_LABELS[user?.hiring_context] || 'Homeowner';
  }
  return 'Tradesman';
}

/**
 * Label for a SPECIFIC mode (not necessarily the user's current one). Used
 * inside the ModeToggle dropdown so each option renders the right label —
 * the homeowner option still derives from the user's hiring_context.
 */
export function labelForMode(user, mode) {
  if (mode === MODE.HOMEOWNER) {
    return HOMEOWNER_LABELS[user?.hiring_context] || 'Homeowner';
  }
  return 'Tradesman';
}

/**
 * Has the user set up the given mode's underlying profile?
 *   tradesman: completed trade selection (user_trades exists)
 *   homeowner: owns at least one home
 * Server returns this as user.profiles.{tradesman,homeowner}; we fall back
 * conservatively (false) when the flag isn't present.
 */
export function hasProfile(user, mode) {
  return !!(user?.profiles?.[mode]);
}

// Icon name used in the role-badge circle for each mode (matches what
// ProjectShell already uses for the homeowner footer).
export function iconForMode(mode) {
  return mode === MODE.HOMEOWNER ? 'home' : 'tool';
}
