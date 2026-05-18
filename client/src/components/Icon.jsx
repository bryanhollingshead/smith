// Smith — Icon set
// Stroke icons, no emoji. Ported 1:1 from smith-shared.jsx so visuals match.

import React from 'react';

export const Icon = ({ name, size = 18, stroke = 1.6, ...rest }) => {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: stroke,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    ...rest,
  };
  switch (name) {
    case 'home':       return <svg {...common}><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></svg>;
    case 'search':     return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case 'users':      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case 'message':    return <svg {...common}><path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 21 11.5z"/></svg>;
    case 'bell':       return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>;
    case 'user':       return <svg {...common}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'briefcase':  return <svg {...common}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
    case 'mappin':     return <svg {...common}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
    case 'check':      return <svg {...common}><path d="M20 6L9 17l-5-5"/></svg>;
    case 'verified':   return <svg {...common}><path d="M12 2l2.4 2.2 3.2-.4.8 3.2 2.6 2-1.4 3 1.4 3-2.6 2-.8 3.2-3.2-.4L12 22l-2.4-2.2-3.2.4-.8-3.2-2.6-2 1.4-3-1.4-3 2.6-2 .8-3.2 3.2.4z"/><path d="M9 12l2 2 4-4"/></svg>;
    case 'plus':       return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'arrow-r':    return <svg {...common}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case 'arrow-l':    return <svg {...common}><path d="M19 12H5M11 19l-7-7 7-7"/></svg>;
    case 'chevron-r':  return <svg {...common}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chevron-d':  return <svg {...common}><path d="M6 9l6 6 6-6"/></svg>;
    case 'chevron-l':  return <svg {...common}><path d="M15 6l-6 6 6 6"/></svg>;
    case 'send':       return <svg {...common}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>;
    case 'image':      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>;
    case 'newspaper':  return <svg {...common}><path d="M4 22h16a2 2 0 0 0 2-2V6a1 1 0 0 0-1-1h-3v15a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1h13"/><path d="M6 8h6M6 12h6M6 16h6M14 8h2M14 12h2M14 16h2"/></svg>;
    case 'tool':       return <svg {...common}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 1 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z"/></svg>;
    case 'mail':       return <svg {...common}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>;
    case 'hardhat':    return <svg {...common}><path d="M3 17h18M5 17v-3a7 7 0 0 1 14 0v3M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
    case 'building':   return <svg {...common}><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01"/></svg>;
    case 'calendar':   return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
    case 'award':      return <svg {...common}><circle cx="12" cy="8" r="6"/><path d="M15.5 12.5L17 22l-5-3-5 3 1.5-9.5"/></svg>;
    case 'shield':     return <svg {...common}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>;
    case 'star':       return <svg {...common}><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>;
    case 'menu':       return <svg {...common}><path d="M3 6h18M3 12h18M3 18h18"/></svg>;
    case 'x':          return <svg {...common}><path d="M18 6L6 18M6 6l12 12"/></svg>;
    case 'filter':     return <svg {...common}><path d="M22 3H2l8 9.5V19l4 2v-8.5z"/></svg>;
    case 'logout':     return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>;
    case 'eye':        return <svg {...common}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'thumb':      return <svg {...common}><path d="M7 10v12M15 5.9L14 10h6.6a2 2 0 0 1 2 2.4l-1.4 8a2 2 0 0 1-2 1.6H7V10l5-9a3 3 0 0 1 3 3z"/></svg>;
    case 'comment':    return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case 'share':      return <svg {...common}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>;
    case 'edit':       return <svg {...common}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>;
    case 'more':       return <svg {...common}><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>;
    case 'trash':      return <svg {...common}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>;
    default: return null;
  }
};
